import { Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { normalizeOrder,priceItems,canTransition,withinServiceHours } from "./domain.js";
import { db,options,hash,requireUid,restaurantRef,roleFor,translate,isPlatformAdmin } from "./context.js";
import { requireSubscription,monthKey } from "./saas-domain.js";
export {savePlan,createRestaurant,updateRestaurantProfile,setRestaurantStatus,setSubscriptionStatus,createSubscriptionInvoice,recordSubscriptionPayment,activateFreeSubscription,manageRestaurantStaff,manageRestaurantTables,seedPilotPlan} from "./saas.js";
export * from "./billing.js";
export const placeOrder = onCall(options, async (request) => {
  try {
    const uid = requireUid(request),
      root = restaurantRef(request.data?.restaurantId);
    // Check a saved request first: delayed retries must return the original receipt.
    const requestId = request.data?.requestId;
    if (
      typeof requestId !== "string" ||
      !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)
    )
      throw new HttpsError("invalid-argument", "Invalid request ID.");
    const orderRef = root.collection("orders").doc(hash(`${uid}:${requestId}`));
    const payloadHash = hash(
      JSON.stringify({
        mode: request.data.mode,
        tableId: request.data.tableId || null,
        scheduledAt: request.data.scheduledAt || null,
        customer: request.data.customer || null,
        instructions: request.data.instructions || "",
        items: request.data.items,
      }),
    );
    const receipt = (snap) => ({
      id: snap.id,
      totalPaise: snap.data().totalPaise,
      status: snap.data().status,
    });
    const cached = await orderRef.get();
    if (cached.exists) {
      if (cached.data().payloadHash !== payloadHash)
        throw new HttpsError(
          "already-exists",
          "This request was used for a different order.",
        );
      return receipt(cached);
    }
    const order = normalizeOrder(request.data);
    const role = await roleFor(uid, root.id);
    return await db.runTransaction(async (tx) => {
      const existing = await tx.get(orderRef);
      if (existing.exists) {
        if (existing.data().payloadHash !== payloadHash)
          throw new HttpsError(
            "already-exists",
            "This request was used for a different order.",
          );
        return receipt(existing);
      }
      const restaurant = await tx.get(root);
      if (!restaurant.exists || restaurant.data().acceptingOrders !== true)
        throw new HttpsError(
          "failed-precondition",
          "Restaurant is not accepting orders.",
        );
      const settings = restaurant.data();
      if(settings.status === 'suspended') throw new HttpsError('failed-precondition','Restaurant is suspended.');
      const subscriptionRef=db.doc(`subscriptions/${root.id}`);
      const subscription=(await tx.get(subscriptionRef)).data();
      requireSubscription(subscription);
      const usageRef=root.collection('usage').doc(monthKey());
      const usage=(await tx.get(usageRef)).data() || {};
      const dayKey=new Date(Date.now()+330*60000).toISOString().slice(0,10);
      const dayRef=root.collection('dailyMetrics').doc(dayKey),metricsRef=root.collection('metrics').doc('current');
      const dayMetrics=(await tx.get(dayRef)).data() || {}, currentMetrics=(await tx.get(metricsRef)).data() || {};
      if((usage.orders || 0) >= subscription.limits.maxMonthlyOrders) throw new HttpsError('resource-exhausted','Online ordering is temporarily unavailable. Please contact the restaurant.');
      const serviceAt = order.mode === "table" ? Date.now() : order.scheduledAt;
      if (
        !withinServiceHours(
          serviceAt,
          settings.openingTime,
          settings.closingTime,
        )
      )
        throw new HttpsError(
          "failed-precondition",
          "Choose a time within restaurant service hours (India time).",
        );
      if (order.mode === "table") {
        const table = await tx.get(
          root.collection("tables").doc(order.tableId),
        );
        if (!table.exists || table.data().active !== true)
          throw new HttpsError(
            "failed-precondition",
            "This table is not active. Ask your waiter.",
          );
      }
      const snaps = await Promise.all(
        order.items.map((i) => tx.get(root.collection("menu").doc(i.id))),
      );
      const menu = Object.fromEntries(snaps.map((s) => [s.id, s.data()]));
      const { lines, totalPaise } = priceItems(order.items, menu);
      // A changed price requires customer reconfirmation, never silently charges more.
      if (request.data.expectedTotalPaise !== totalPaise)
        throw new HttpsError(
          "failed-precondition",
          "Menu prices changed. Review your cart and try again.",
        );
      const now = Timestamp.now();
      const rateRef = db.doc(`orderRateLimits/${hash(`${uid}:${root.id}`)}`);
      const rate = (await tx.get(rateRef)).data() || {};
      const minute = Math.floor(now.toMillis() / 60000),
        day = Math.floor(now.toMillis() / 86400000);
      const minuteCount = rate.minute === minute ? rate.minuteCount || 0 : 0;
      const dayCount = rate.day === day ? rate.dayCount || 0 : 0;
      if (minuteCount >= 5 || dayCount >= 50)
        throw new HttpsError(
          "resource-exhausted",
          "Too many orders. Ask a waiter or try again later.",
        );
      tx.set(rateRef, {
        minute,
        day,
        minuteCount: minuteCount + 1,
        dayCount: dayCount + 1,
      });
      tx.set(dayRef,{orders:(dayMetrics.orders||0)+1,updatedAt:now},{merge:true});
      tx.set(metricsRef,{activeOrders:(currentMetrics.activeOrders||0)+1,updatedAt:now},{merge:true});
      tx.set(usageRef,{orders:(usage.orders || 0)+1,updatedAt:now},{merge:true});
      tx.create(orderRef, {
        ...order,
        items: lines,
        totalPaise,
        payloadHash,
        customerUid: uid,
        createdBy: uid,
        source: role === "waiter" ? "waiter" : "customer",
        status: "new",
        paymentStatus: "unpaid",
        createdAt: now,
        updatedAt: now,
        statusHistory: [{ status: "new", at: now, by: uid }],
        scheduledAt: order.scheduledAt
          ? Timestamp.fromMillis(order.scheduledAt)
          : null,
      });
      return { id: orderRef.id, totalPaise, status: "new" };
    });
  } catch (error) {
    translate(error);
  }
});
export const updateOrder = onCall(options, async (request) => {
  try {
    const uid = requireUid(request),
      root = restaurantRef(request.data?.restaurantId);

    const id = request.data?.orderId;
    if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id))
      throw new HttpsError("invalid-argument", "Invalid order ID.");
    const ref = root.collection("orders").doc(id);
    await db.runTransaction(async (tx) => {
      const role = await roleFor(uid,root.id,tx) || (await isPlatformAdmin(uid,tx) ? "owner" : null);
      if (!role)
        throw new HttpsError("permission-denied", "Staff access required.");
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
      const order = snap.data(),
        now = Timestamp.now();
      if (request.data.action === "mark-paid") {
        if (role !== "owner" || order.status === "cancelled")
          throw new HttpsError(
            "permission-denied",
            "Owner can record payment for non-cancelled orders.",
          );
        if (order.paymentStatus === "paid") return;
        const dayKey=new Date(now.toMillis()+330*60000).toISOString().slice(0,10),dayRef=root.collection('dailyMetrics').doc(dayKey);
        const metrics=(await tx.get(dayRef)).data()||{};
        tx.set(dayRef,{salesPaise:(metrics.salesPaise||0)+order.totalPaise,paidOrders:(metrics.paidOrders||0)+1,updatedAt:now},{merge:true});
        tx.update(ref, {
          paymentStatus: "paid",
          paidAt: now,
          paidBy: uid,
          updatedAt: now,
        });
      } else {
        const status = request.data.status;
        if (status === order.status) return;
        if (!canTransition(role, order.status, status))
          throw new HttpsError(
            "failed-precondition",
            "This status change is not allowed.",
          );
        if (status === "cancelled" && order.paymentStatus === "paid")
          throw new HttpsError(
            "failed-precondition",
            "Paid orders require a refund process before cancellation.",
          );
        if(['completed','cancelled'].includes(status)){
          const metricsRef=root.collection('metrics').doc('current'),metrics=(await tx.get(metricsRef)).data()||{};
          tx.set(metricsRef,{activeOrders:Math.max(0,(metrics.activeOrders||0)-1),updatedAt:now},{merge:true});
        }
        tx.update(ref, {
          status,
          updatedAt: now,
          statusHistory: [...order.statusHistory, { status, at: now, by: uid }],
        });
      }
    });
    return { success: true };
  } catch (error) {
    translate(error);
  }
});
