import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const project = "demo-quickdine",
  rid = "integration-restaurant";
let app, db, customer, owner, kitchen, waiter, server;
async function account() {
  const res = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const data = await res.json();
  assert.ok(data.idToken, JSON.stringify(data));
  return { uid: data.localId, token: data.idToken };
}
async function call(name, user, data) {
  const res = await fetch(
    `http://127.0.0.1:5001/${project}/asia-south1/${name}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      },
      body: JSON.stringify({ data }),
    },
  );
  return await res.json();
}
function payload(overrides = {}) {
  return {
    restaurantId: rid,
    requestId: crypto.randomUUID(),
    mode: "table",
    tableId: "7",
    items: [{ id: "paneer", qty: 2 }],
    instructions: "Less spicy",
    expectedTotalPaise: 44000,
    ...overrides,
  };
}
before(async () => {
  if (
    !process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.FIREBASE_AUTH_EMULATOR_HOST
  )
    throw Error("Emulators required.");
  const { startCallableServer } = await import("./helpers/callable-server.js");
  server = await startCallableServer();
  app = initializeApp({ projectId: project }, "integration");
  db = getFirestore(app);
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await deleteApp(app);
});
beforeEach(async () => {
  await db.recursiveDelete(db.doc(`restaurants/${rid}`));
  [customer, owner, kitchen, waiter] = await Promise.all([
    account(),
    account(),
    account(),
    account(),
  ]);
  await Promise.all([
    db.doc(`restaurants/${rid}`).set({
      name: "Test",
      nameHi: "टेस्ट",
      acceptingOrders: true,
      openingTime: "00:00",
      closingTime: "23:59",
    }),
    db.doc(`restaurants/${rid}/menu/paneer`).set({
      name: "Paneer",
      nameHi: "पनीर",
      pricePaise: 22000,
      available: true,
    }),
    db.doc(`restaurants/${rid}/tables/7`).set({ active: true }),
    ...[
      ["owner", owner],
      ["kitchen", kitchen],
      ["waiter", waiter],
    ].map(([role, u]) =>
      db.doc(`staff/${u.uid}`).set({ role, restaurantId: rid, active: true }),
    ),
  ]);
});
test("real callable creates one priced order for concurrent double-submit and returns the receipt on retry", async () => {
  const data = payload();
  const [a, b] = await Promise.all([
    call("placeOrder", customer, data),
    call("placeOrder", customer, data),
  ]);
  assert.ok(a.result, JSON.stringify(a));
  assert.ok(b.result, JSON.stringify(b));
  assert.equal(a.result.id, b.result.id);
  const orders = await db.collection(`restaurants/${rid}/orders`).get();
  assert.equal(orders.size, 1);
  const order = orders.docs[0].data();
  assert.equal(order.totalPaise, 44000);
  assert.equal(order.tableId, "7");
  assert.equal(order.instructions, "Less spicy");
  assert.equal(order.customerUid, customer.uid);
  await db.doc(`restaurants/${rid}/menu/paneer`).update({ available: false });
  const retry = await call("placeOrder", customer, data);
  assert.equal(retry.result.id, a.result.id);
  const changed = await call("placeOrder", customer, {
    ...data,
    instructions: "Different",
  });
  assert.equal(changed.error.status, "ALREADY_EXISTS");
});
test("server rejects unauthenticated, tampered price, unavailable dishes and invalid tables", async () => {
  assert.equal(
    (await call("placeOrder", null, payload())).error.status,
    "UNAUTHENTICATED",
  );
  assert.equal(
    (await call("placeOrder", customer, payload({ expectedTotalPaise: 1 })))
      .error.status,
    "FAILED_PRECONDITION",
  );
  assert.equal(
    (await call("placeOrder", customer, payload({ tableId: "20" }))).error
      .status,
    "FAILED_PRECONDITION",
  );
  await db.doc(`restaurants/${rid}/menu/paneer`).update({ available: false });
  assert.equal(
    (await call("placeOrder", customer, payload())).error.status,
    "FAILED_PRECONDITION",
  );
  assert.equal(
    (await db.collection(`restaurants/${rid}/orders`).get()).size,
    0,
  );
});
test("kitchen/waiter transitions and owner payments persist with authorization checks", async () => {
  const result = await call("placeOrder", customer, payload());
  const orderId = result.result.id;
  const update = (u, status) =>
    call("updateOrder", u, { restaurantId: rid, orderId, status });
  assert.equal(
    (await update(customer, "preparing")).error.status,
    "PERMISSION_DENIED",
  );
  assert.equal(
    (await update(waiter, "preparing")).error.status,
    "FAILED_PRECONDITION",
  );
  assert.ok((await update(kitchen, "preparing")).result);
  assert.ok((await update(kitchen, "ready")).result);
  assert.equal(
    (await update(kitchen, "completed")).error.status,
    "FAILED_PRECONDITION",
  );
  assert.ok((await update(waiter, "completed")).result);
  assert.equal(
    (
      await call("updateOrder", waiter, {
        restaurantId: rid,
        orderId,
        action: "mark-paid",
      })
    ).error.status,
    "PERMISSION_DENIED",
  );
  assert.ok(
    (
      await call("updateOrder", owner, {
        restaurantId: rid,
        orderId,
        action: "mark-paid",
      })
    ).result,
  );
  const order = (
    await db.doc(`restaurants/${rid}/orders/${orderId}`).get()
  ).data();
  assert.equal(order.status, "completed");
  assert.equal(order.paymentStatus, "paid");
  assert.equal(order.statusHistory.length, 4);
  await db.doc(`staff/${owner.uid}`).update({ active: false });
  assert.equal(
    (
      await call("updateOrder", owner, {
        restaurantId: rid,
        orderId,
        action: "mark-paid",
      })
    ).error.status,
    "PERMISSION_DENIED",
  );
});
test("advance orders store pickup time and waiter orders record attribution", async () => {
  const scheduledAt = Date.now() + 3600000;
  const r = await call(
    "placeOrder",
    customer,
    payload({
      mode: "takeaway",
      tableId: null,
      scheduledAt,
      customer: { name: "Surendra", phone: "9876543210" },
    }),
  );
  assert.ok(r.result, JSON.stringify(r));
  const order = (
    await db.doc(`restaurants/${rid}/orders/${r.result.id}`).get()
  ).data();
  assert.equal(order.mode, "takeaway");
  assert.equal(order.scheduledAt.toMillis(), scheduledAt);
  assert.equal(order.tableId, null);
  const w = await call("placeOrder", waiter, payload());
  assert.ok(w.result, JSON.stringify(w));
  assert.equal(
    (await db.doc(`restaurants/${rid}/orders/${w.result.id}`).get()).data()
      .source,
    "waiter",
  );
});
test("paused restaurants reject new submissions", async () => {
  await db.doc(`restaurants/${rid}`).update({ acceptingOrders: false });
  assert.equal(
    (await call("placeOrder", customer, payload())).error.status,
    "FAILED_PRECONDITION",
  );
});

test("service-hour validation and per-customer rate limits reject new orders", async () => {
  await db
    .doc(`restaurants/${rid}`)
    .update({ openingTime: "00:00", closingTime: "00:01" });
  const scheduledAt = Date.now() + 3600000;
  assert.equal(
    (
      await call(
        "placeOrder",
        customer,
        payload({
          mode: "advance-dine-in",
          tableId: null,
          scheduledAt,
          customer: { name: "Test person", phone: "9876543210" },
        }),
      )
    ).error.status,
    "FAILED_PRECONDITION",
  );
  await db
    .doc(`restaurants/${rid}`)
    .update({ openingTime: "00:00", closingTime: "23:59" });
  const rateId = createHash("sha256")
    .update(`${customer.uid}:${rid}`)
    .digest("hex");
  const now = Date.now();
  await db.doc(`orderRateLimits/${rateId}`).set({
    minute: Math.floor(now / 60000),
    minuteCount: 0,
    day: Math.floor(now / 86400000),
    dayCount: 50,
  });
  assert.equal(
    (await call("placeOrder", customer, payload())).error.status,
    "RESOURCE_EXHAUSTED",
  );
});
test("paid orders cannot be cancelled without a refund process", async () => {
  const r = await call("placeOrder", customer, payload());
  const orderId = r.result.id;
  assert.ok(
    (
      await call("updateOrder", owner, {
        restaurantId: rid,
        orderId,
        action: "mark-paid",
      })
    ).result,
  );
  assert.equal(
    (
      await call("updateOrder", owner, {
        restaurantId: rid,
        orderId,
        status: "cancelled",
      })
    ).error.status,
    "FAILED_PRECONDITION",
  );
});
