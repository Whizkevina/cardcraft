import { expect, test } from "@playwright/test";
import { dismissCookieBanner } from "./helpers/ui";

test("admin can access dashboard", async ({ page, request }) => {
  await request.post("/api/admin/seed");

  await page.goto("/#/auth");
  await dismissCookieBanner(page);
  await page.getByTestId("input-email").fill("admin@cardcraft.com");
  await page.getByTestId("input-password").fill("admin123");
  await page.getByTestId("button-submit-auth").click();

  await page.getByTestId("input-new-password").fill("Admin1234!");
  await page.getByTestId("input-confirm-password").fill("Admin1234!");
  await page.getByRole("button", { name: /set new password/i }).click();
  await expect(page.getByTestId("input-new-password")).toBeHidden();

  await page.goto("/#/admin");
  await expect(page.getByText("Admin Panel")).toBeVisible();
});
