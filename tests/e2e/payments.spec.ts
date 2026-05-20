import { expect, test } from "@playwright/test";
import { createTestUser } from "./helpers/user";
import { registerUser } from "./helpers/auth";
import { dismissCookieBanner } from "./helpers/ui";

test("pricing and payments pages render with upgrade flow stubbed", async ({ page }) => {
  const user = createTestUser();
  await page.addInitScript(() => {
    window.PaystackPop = {
      setup: (cfg: any) => {
        (window as any).__paystackSetupCalled = true;
        setTimeout(() => {
          (window as any).__paystackClosed = true;
          cfg.onClose && cfg.onClose();
        }, 0);
        return { openIframe: () => {} };
      },
    };
  });

  await registerUser(page, user);

  await page.route("**/api/payments/initialize", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reference: "CC-TEST-0001",
        publicKey: "pk_test",
        amount: 10000,
        email: user.email,
      }),
    });
  });

  await page.goto("/#/pricing");
  await dismissCookieBanner(page);
  await page.getByTestId("button-upgrade-pro").click();
  await expect.poll(async () => page.evaluate(() => (window as any).__paystackSetupCalled)).toBeTruthy();
  await expect.poll(async () => page.evaluate(() => (window as any).__paystackClosed)).toBeTruthy();

  await page.goto("/#/payments");
  await expect(page.getByText(/no payments yet/i)).toBeVisible();
});
