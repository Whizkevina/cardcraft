import { expect, test } from "@playwright/test";
import { createTestUser } from "./helpers/user";
import { loginUser, logoutUser, registerUser } from "./helpers/auth";
import { dismissCookieBanner } from "./helpers/ui";

test("change password from account settings", async ({ page }) => {
  const user = createTestUser();
  await registerUser(page, user);

  await page.goto("/#/settings");
  await dismissCookieBanner(page);
  await page.getByTestId("input-current-password").fill(user.password);
  await page.getByTestId("input-new-password").fill("Test5678!");
  await page.getByTestId("input-confirm-password").fill("Test5678!");
  await page.getByRole("button", { name: /update password/i }).click();
  await expect(page.getByRole("status").filter({ hasText: /password updated successfully/i }).first()).toBeVisible();

  await logoutUser(page);
  await loginUser(page, { ...user, password: "Test5678!" });
});
