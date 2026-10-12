import { test, expect } from "@playwright/test";
test.skip(process.env.QUICKDINE_LIVE_TEST === "true", "Preview-only tests");
test("table context, quantities and cart survive refresh; preview cannot submit", async ({
  page,
}) => {
  await page.goto("/customer?table=7");
  await expect(page.locator(".menu-hero .eyebrow")).toHaveText("Table 7");
  await page
    .getByRole("button", { name: "Add +", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Cart 1", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Place order", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Increase Paneer Butter Masala" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("₹440.00");
  await page
    .getByRole("textbox", { name: "Special instructions" })
    .fill("Less spicy");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Cart 2", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Special instructions" }),
  ).toHaveValue("Less spicy");
});
test("language switch preserves cart and category/search/veg filtering works", async ({
  page,
}) => {
  await page.goto("/customer?table=20");
  await page
    .getByRole("button", { name: "Add +", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(
    page.getByRole("button", { name: "कार्ट 1", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".menu-hero .eyebrow")).toHaveText("टेबल 20");
  await page.getByRole("button", { name: "Switch language" }).click();
  await page.getByRole("textbox", { name: "Search dishes…" }).fill("chicken");
  await expect(page.locator(".menu-card")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Veg only" }).check();
  await expect(page.locator(".menu-card")).toHaveCount(0);
});
test("advance checkout captures contact/time and private screens are gated", async ({
  page,
}) => {
  await page.goto("/customer?mode=takeaway");
  await page
    .getByRole("button", { name: "Add +", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Cart 1", exact: true }).click();
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Arrival / pickup time")).toBeVisible();
  await page.goto("/owner");
  await expect(
    page.getByRole("heading", { name: "Staff access required" }),
  ).toBeVisible();
  await expect(page.getByText("₹8,450")).toHaveCount(0);
});
test("mobile cart has no horizontal overflow and restores focus on close", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/customer?table=1");
  await page
    .getByRole("button", { name: "Add +", exact: true })
    .first()
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator(".mobile-cart").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".mobile-cart")).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("mobile-menu.png"),
    fullPage: true,
  });
});

test('restaurant home links preserve the selected workspace instead of reverting to Yash',async({page})=>{
 await page.goto('/r/other-family-dhaba');
 await expect(page.locator('.hero .eyebrow')).toContainText('other-family-dhaba');
 await expect(page.locator('.hero-actions .primary')).toHaveAttribute('href','/r/other-family-dhaba/customer');
 await expect(page.locator('.hero-actions .secondary')).toHaveAttribute('href','/r/other-family-dhaba/customer?mode=advance-dine-in');
 await page.locator('.hero-actions .primary').click();
 await expect(page).toHaveURL(/\/r\/other-family-dhaba\/customer$/);
});
