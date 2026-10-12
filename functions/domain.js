export const MODES = ["table", "advance-dine-in", "takeaway"];
export const ROLES = ["owner", "kitchen", "waiter"];
export class DomainError extends Error {
  constructor(message, code = "invalid-argument") {
    super(message);
    this.code = code;
  }
}
const fail = (message) => {
  throw new DomainError(message);
};
export function normalizeOrder(input, now = Date.now()) {
  if (!input || typeof input !== "object") fail("Invalid order.");
  if (
    typeof input.requestId !== "string" ||
    !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId)
  )
    fail("Invalid request ID.");
  if (!MODES.includes(input.mode)) fail("Choose a valid order mode.");
  if (
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > 30
  )
    fail("Choose 1–30 dishes.");
  const ids = new Set();
  const items = input.items
    .map((item) => {
      if (
        !item ||
        typeof item.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) ||
        ids.has(item.id)
      )
        fail("Invalid or repeated dish.");
      ids.add(item.id);
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20)
        fail("Dish quantity must be 1–20.");
      return { id: item.id, qty: item.qty };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const text = (value, max) => {
    if (value == null) return "";
    if (typeof value !== "string" || value.length > max)
      fail("Invalid text field.");
    return value.trim();
  };
  const instructions = text(input.instructions, 500);
  let tableId = null,
    scheduledAt = null,
    customer = null;
  if (input.mode === "table") {
    tableId = text(input.tableId, 3);
    if (!/^[1-9][0-9]{0,2}$/.test(tableId)) fail("Scan a valid table QR.");
  } else {
    const name = text(input.customer?.name, 80);
    const phone = text(input.customer?.phone, 15).replace(/[\s-]/g, "");
    if (name.length < 2 || !/^(\+91)?[6-9][0-9]{9}$/.test(phone))
      fail("Enter your name and a valid Indian mobile number.");
    customer = { name, phone };
    scheduledAt = Number(input.scheduledAt);
    if (
      !Number.isFinite(scheduledAt) ||
      scheduledAt < now + 15 * 60_000 ||
      scheduledAt > now + 7 * 86400_000
    )
      fail("Choose a time 15 minutes to 7 days ahead.");
  }
  return {
    requestId: input.requestId,
    mode: input.mode,
    tableId,
    scheduledAt,
    customer,
    instructions,
    items,
  };
}
export function priceItems(items, menu) {
  let totalPaise = 0;
  const lines = items.map(({ id, qty }) => {
    const dish = menu[id];
    if (!dish || dish.available !== true)
      throw new DomainError(
        "A dish is unavailable. Refresh your menu.",
        "failed-precondition",
      );
    if (
      !Number.isInteger(dish.pricePaise) ||
      dish.pricePaise < 1 ||
      dish.pricePaise > 1000000
    )
      throw new DomainError("Invalid menu price.", "failed-precondition");
    const lineTotalPaise = dish.pricePaise * qty;
    totalPaise += lineTotalPaise;
    return {
      id,
      qty,
      name: dish.name,
      nameHi: dish.nameHi || "",
      pricePaise: dish.pricePaise,
      lineTotalPaise,
    };
  });
  return { lines, totalPaise };
}
export function canTransition(role, from, to) {
  const next = { new: "preparing", preparing: "ready", ready: "completed" };
  if (role === "owner")
    return (
      next[from] === to ||
      (["new", "preparing", "ready"].includes(from) && to === "cancelled")
    );
  if (role === "kitchen")
    return (from === "new" || from === "preparing") && next[from] === to;
  return role === "waiter" && from === "ready" && to === "completed";
}
export function paidSales(orders) {
  const paid = orders.filter(
    (o) => o.status !== "cancelled" && o.paymentStatus === "paid",
  );
  return paid.reduce((sum, o) => sum + o.totalPaise, 0);
}

export function withinServiceHours(epoch, opening, closing) {
  const valid = (value) =>
    typeof value === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
  if (
    !Number.isFinite(epoch) ||
    !valid(opening) ||
    !valid(closing) ||
    opening === closing
  )
    return false;
  const minutes = (value) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const local = (((Math.floor(epoch / 60000) + 330) % 1440) + 1440) % 1440;
  const start = minutes(opening),
    end = minutes(closing);
  return start < end
    ? local >= start && local < end
    : local >= start || local < end;
}
