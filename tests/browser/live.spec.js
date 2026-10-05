import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
test.skip(
  process.env.QUICKDINE_LIVE_TEST !== "true",
  "Requires Auth/Firestore emulators and callable HTTP server",
);
test("customer order reaches kitchen, owner edits live menu, waiter completes and payment appears in sales", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const db = getFirestore(
      initializeApp({ projectId: "demo-quickdine" }, "browser-test"),
    ),
    root = db.doc("restaurants/browser-restaurant");
  await db.recursiveDelete(root);
  const password = "QuickDine-test-123!";
  const users = {};
  for (const role of ["owner", "kitchen", "waiter"]) {
    const email = `${role}-${crypto.randomUUID()}@example.test`;
    const response = await fetch(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const account = await response.json();
    users[role] = { email, uid: account.localId };
    await db
      .doc(`staff/${account.localId}`)
      .set({ role, restaurantId: root.id, active: true });
  }
  await root.set({
    name: "Yash Test",
    nameHi: "यश टेस्ट",
    acceptingOrders: true,
    openingTime: "00:00",
    closingTime: "23:59",
  });
  await root.collection("menu").doc("paneer").set({
    name: "Paneer Butter Masala",
    nameHi: "पनीर बटर मसाला",
    description: "Fresh paneer",
    descriptionHi: "ताज़ा पनीर",
    category: "Main Course",
    categoryHi: "मुख्य भोजन",
    pricePaise: 22000,
    veg: true,
    available: true,
    emoji: "🍛",
  });
  await root.collection("tables").doc("7").set({ active: true });
  await page.goto("/customer?table=7");
  await expect(
    page.getByRole("heading", { name: "Paneer Butter Masala" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add +", exact: true }).click();
  await page.getByRole("button", { name: "Cart 1", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Special instructions" })
    .fill("No onion");
  await page.route("**/placeOrder", async (route) => {
    await route.fetch();
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page.locator(".drawer-items .error")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Special instructions" }),
  ).toBeDisabled();
  await page.unroute("**/placeOrder");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Retry", exact: true })
    .click();
  expect((await root.collection("orders").get()).size).toBe(1);

  await expect(page.getByRole("status")).toContainText("Order received");
  await expect(page.locator(".recent-orders .order-card")).toContainText(
    "Table 7",
  );
  const signIn = async (role) => {
    const context = await browser.newContext();
    const p = await context.newPage();
    await p.goto("/login");
    await p.getByLabel("Email", { exact: true }).fill(users[role].email);
    await p.getByLabel("Password", { exact: true }).fill(password);
    await p.getByRole("button", { name: "Staff login", exact: true }).click();
    await expect(
      p.getByRole("heading", { name: "Kitchen", exact: true }),
    ).toBeVisible();
    return { p, context };
  };
  const kitchen = await signIn("kitchen");
  await expect(kitchen.p.locator(".order-card")).toContainText("No onion");
  await kitchen.p
    .getByRole("button", { name: "Print kitchen ticket", exact: true })
    .click();
  await kitchen.p.emulateMedia({ media: "print" });
  await expect(kitchen.p.locator(".kitchen-ticket")).toContainText("No onion");
  await expect(kitchen.p.locator(".kitchen-ticket")).toContainText("Table 7");
  await expect(kitchen.p.locator(".topbar")).toBeHidden();
  await kitchen.p.screenshot({
    path: testInfo.outputPath("kitchen-ticket.png"),
    fullPage: true,
  });
  await kitchen.p.emulateMedia({ media: "screen" });
  await kitchen.p
    .getByRole("button", { name: "Accept order", exact: true })
    .click();
  await expect(page.locator(".recent-orders .order-status")).toContainText(
    "Preparing",
  );
  await kitchen.p
    .getByRole("button", { name: "Mark ready", exact: true })
    .click();
  await expect(page.locator(".recent-orders .order-status")).toContainText(
    "Ready",
  );
  const waiter = await signIn("waiter");
  await waiter.p
    .getByRole("button", { name: "Mark served / collected", exact: true })
    .click();
  await expect(page.locator(".recent-orders .order-status")).toContainText(
    "Completed",
  );
  const owner = await signIn("owner");
  await owner.p.goto("/admin");
  await expect(
    owner.p.getByRole("heading", { name: "Manage", exact: true }),
  ).toBeVisible();
  await owner.p.getByRole("button", { name: "Edit", exact: true }).click();
  await owner.p.getByLabel("Price (₹)").fill("230");
  await owner.p
    .getByRole("button", { name: "Save", exact: true })
    .first()
    .click();
  await expect(page.locator(".menu-card-footer")).toContainText("₹230.00");
  await owner.p.getByLabel("Number of tables").fill("3");
  await owner.p
    .getByRole("button", { name: "Table QR codes", exact: true })
    .click();
  await expect(owner.p.locator(".qr-grid article")).toHaveCount(3);
  await expect(owner.p.locator(".qr-grid img").first()).toHaveAttribute(
    "src",
    /^data:image\/png/,
  );
  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(
    page.getByRole("heading", { name: "पनीर बटर मसाला", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("hindi-live-menu.png"),
    fullPage: true,
  });
  await owner.p.goto("/owner");
  owner.p.once("dialog", (dialog) => dialog.accept());
  await owner.p
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(owner.p.locator(".stat-card").first()).toContainText("₹220.00");
  await expect(owner.p.locator(".order-card")).toContainText("₹220.00");
  await waiter.p.goto("/customer?table=7");
  await waiter.p.getByRole("button", { name: "Add +", exact: true }).click();
  await waiter.p.getByRole("button", { name: "Cart 1", exact: true }).click();
  await waiter.p
    .getByRole("button", { name: "Place order", exact: true })
    .click();
  await expect(waiter.p.getByRole("status")).toContainText("Order received");
  await page.getByRole("button", { name: "Switch language" }).click();
  for (const mode of ["advance-dine-in", "takeaway"]) {
    await page.goto(`/customer?mode=${mode}`);
    await page.getByRole("button", { name: "Add +", exact: true }).click();
    await page.getByRole("button", { name: "Cart 1", exact: true }).click();
    await page.getByLabel("Your name", { exact: true }).fill("Surendra");
    await page.getByLabel("Mobile number", { exact: true }).fill("9876543210");
    const indiaTime = new Date(Date.now() + 3600000 + 330 * 60000)
      .toISOString()
      .slice(0, 16);
    await page.getByLabel("Arrival / pickup time (IST)").fill(indiaTime);
    await page
      .getByRole("button", { name: "Place order", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Order received");
  }
  const saved = (await root.collection("orders").get()).docs.map((d) =>
    d.data(),
  );
  expect(saved).toHaveLength(4);
  expect(
    saved.some(
      (o) => o.source === "waiter" && o.createdBy === users.waiter.uid,
    ),
  ).toBe(true);
  expect(saved.filter((o) => o.mode === "takeaway")).toHaveLength(1);
  expect(saved.filter((o) => o.mode === "advance-dine-in")).toHaveLength(1);
  for (const c of [kitchen, waiter, owner]) await c.context.close();
});
