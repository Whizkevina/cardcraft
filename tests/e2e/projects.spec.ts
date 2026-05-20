import { expect, test } from "@playwright/test";
import { createTestUser } from "./helpers/user";
import { registerUser } from "./helpers/auth";
import { dismissCookieBanner, waitForCanvasReady } from "./helpers/ui";

test("save a project and view it in My Cards", async ({ page }) => {
  const user = createTestUser();
  await registerUser(page, user);

  await page.goto("/#/editor/t/1");
  await dismissCookieBanner(page);
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      return response.ok() && (url.includes("/api/templates/1") || url.includes("/api/templates"));
    },
    { timeout: 30000 },
  );
  await waitForCanvasReady(page);

  const title = `E2E Project ${Date.now()}`;
  await page.getByTestId("input-project-title").fill(title);
  const saveResponse = page.waitForResponse(response => {
    return response.url().includes("/api/projects") && response.request().method() === "POST" && response.status() === 201;
  });
  await page.getByTestId("button-save").click();
  const response = await saveResponse;
  const project = await response.json();
  await expect(page.getByRole("status").filter({ hasText: "Saved!" }).first()).toBeVisible();

  const listResponse = page.waitForResponse(response =>
    response.url().includes("/api/projects") && response.request().method() === "GET" && response.ok()
  );
  await page.goto("/#/projects");
  await listResponse;
  await expect(page.getByText(project.title || title)).toBeVisible();
});
