import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOrder,
  priceItems,
  canTransition,
  paidSales,
  withinServiceHours,
} from "../functions/domain.js";
const now = Date.UTC(2026, 9, 2, 12),
  base = {
    requestId: "12345678-1234-5678-9999-123456789012",
    mode: "table",
    tableId: "7",
    items: [{ id: "paneer", qty: 2 }],
  };
test("normalization rejects missing/invalid table and duplicate items", () => {
  assert.equal(normalizeOrder(base, now).tableId, "7");
  for (const tableId of ["", "0", "01", "-1", "1/2"])
    assert.throws(() => normalizeOrder({ ...base, tableId }, now));
  assert.throws(() =>
    normalizeOrder({ ...base, items: [...base.items, ...base.items] }, now),
  );
});
test("quantities, instructions, request IDs and modes are bounded", () => {
  for (const qty of [0, 21, 1.5, "2", -1])
    assert.throws(() =>
      normalizeOrder({ ...base, items: [{ id: "paneer", qty }] }, now),
    );
  assert.throws(() =>
    normalizeOrder({ ...base, instructions: "a".repeat(501) }, now),
  );
  assert.throws(() => normalizeOrder({ ...base, requestId: "short" }, now));
  assert.throws(() => normalizeOrder({ ...base, mode: "delivery" }, now));
});
test("advance ordering requires contact and a time within the window", () => {
  const scheduled = {
    ...base,
    mode: "takeaway",
    scheduledAt: now + 3600000,
    customer: { name: "Surendra", phone: "9876543210" },
  };
  assert.deepEqual(normalizeOrder(scheduled, now).customer, {
    name: "Surendra",
    phone: "9876543210",
  });
  for (const scheduledAt of [now, now + 8 * 86400000, NaN])
    assert.throws(() => normalizeOrder({ ...scheduled, scheduledAt }, now));
  assert.throws(() =>
    normalizeOrder(
      { ...scheduled, customer: { name: "S", phone: "123" } },
      now,
    ),
  );
});
test("server totals use trusted menu prices and preserve snapshots", () => {
  const result = priceItems(
    [
      { id: "paneer", qty: 2 },
      { id: "naan", qty: 3 },
    ],
    {
      paneer: { name: "Paneer", pricePaise: 22000, available: true },
      naan: { name: "Naan", pricePaise: 4550, available: true },
    },
  );
  assert.equal(result.totalPaise, 57650);
  assert.equal(result.lines[1].lineTotalPaise, 13650);
  assert.throws(() => priceItems(base.items, {}));
  assert.throws(() =>
    priceItems(base.items, { paneer: { pricePaise: 22000, available: false } }),
  );
  assert.throws(() =>
    priceItems(base.items, { paneer: { pricePaise: 1.2, available: true } }),
  );
});
test("role transitions prevent customer changes and waiter/kitchen privilege escalation", () => {
  assert.equal(canTransition("kitchen", "new", "preparing"), true);
  assert.equal(canTransition("kitchen", "preparing", "ready"), true);
  assert.equal(canTransition("waiter", "ready", "completed"), true);
  assert.equal(canTransition("waiter", "new", "preparing"), false);
  assert.equal(canTransition("kitchen", "ready", "completed"), false);
  assert.equal(canTransition("customer", "new", "preparing"), false);
  assert.equal(canTransition("owner", "new", "cancelled"), true);
  assert.equal(canTransition("owner", "completed", "cancelled"), false);
  assert.equal(canTransition("owner", "new", "completed"), false);
});
test("sales exclude unpaid and cancelled orders", () => {
  assert.equal(
    paidSales([
      { status: "completed", paymentStatus: "paid", totalPaise: 45000 },
      { status: "new", paymentStatus: "unpaid", totalPaise: 50000 },
      { status: "cancelled", paymentStatus: "paid", totalPaise: 99999 },
    ]),
    45000,
  );
});

test("service hours use India time, exclusive closing time and overnight ranges", () => {
  const instant = Date.UTC(2026, 9, 2, 12, 0); // 17:30 IST
  assert.equal(withinServiceHours(instant, "10:00", "22:00"), true);
  assert.equal(withinServiceHours(instant, "10:00", "17:30"), false);
  assert.equal(withinServiceHours(instant, "18:00", "02:00"), false);
  assert.equal(
    withinServiceHours(Date.UTC(2026, 9, 2, 19), "18:00", "02:00"),
    true,
  );
  assert.equal(withinServiceHours(instant, "bad", "22:00"), false);
});
