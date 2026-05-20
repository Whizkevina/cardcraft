import { test } from "@playwright/test";
import { createTestUser } from "./helpers/user";
import { loginUser, logoutUser, registerUser } from "./helpers/auth";

test("register, logout, and login", async ({ page }) => {
  const user = createTestUser();
  await registerUser(page, user);
  await logoutUser(page);
  await loginUser(page, user);
});
