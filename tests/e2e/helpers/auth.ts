import { expect, Page } from "@playwright/test";
import type { TestUser } from "./user";
import { dismissCookieBanner } from "./ui";

export const registerUser = async (page: Page, user: TestUser) => {
  await page.goto("/#/auth");
  await dismissCookieBanner(page);
  await page.getByTestId("button-toggle-mode").click();
  await page.getByTestId("input-name").fill(user.name);
  await page.getByTestId("input-email").fill(user.email);
  await page.getByTestId("input-password").fill(user.password);
  await page.getByTestId("button-submit-auth").click();
  await expect(page.getByRole("heading", { name: "My Cards" })).toBeVisible();
};

export const loginUser = async (page: Page, user: TestUser) => {
  await page.goto("/#/auth");
  await dismissCookieBanner(page);
  await page.getByTestId("input-email").fill(user.email);
  await page.getByTestId("input-password").fill(user.password);
  await page.getByTestId("button-submit-auth").click();
  await expect(page.getByRole("heading", { name: "My Cards" })).toBeVisible();
};

export const logoutUser = async (page: Page) => {
  await page.getByTestId("button-user-menu").click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await expect(page.getByTestId("button-login")).toBeVisible();
};
