import { createHash } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  normalizeOrder,
  priceItems,
  canTransition,
  ROLES,
  DomainError,
  withinServiceHours,
} from "./domain.js";
initializeApp();
const db = getFirestore();
const options = { region: "asia-south1", maxInstances: 10 };
const hash = (value) => createHash("sha256").update(value).digest("hex");
function requireUid(request) {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign in before ordering.");
  return request.auth.uid;
}
function restaurantRef(id) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(id))
    throw new HttpsError("invalid-argument", "Invalid restaurant.");
  return db.doc(`restaurants/${id}`);
}
async function roleFor(uid, restaurantId) {
  const snap = await db.doc(`staff/${uid}`).get();
  const staff = snap.data();
  return staff?.active === true &&
    staff.restaurantId === restaurantId &&
    ROLES.includes(staff.role)
    ? staff.role
    : null;
}
function translate(error) {
  if (error instanceof HttpsError) throw error;
  if (error instanceof DomainError)
    throw new HttpsError(error.code, error.message);
  console.error("QuickDine operation failed", error);
  throw new HttpsError(
    "internal",
    "Could not save. Retry with the same request.",
  );
}
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
      const staff = (await tx.get(db.doc(`staff/${uid}`))).data();
      const role =
        staff?.active === true &&
        staff.restaurantId === root.id &&
        ROLES.includes(staff.role)
          ? staff.role
          : null;
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
