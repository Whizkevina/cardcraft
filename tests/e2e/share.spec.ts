import { expect, test } from "@playwright/test";
import { createProjectViaApi } from "./helpers/api";
import { createTestUser } from "./helpers/user";
import { dismissCookieBanner, installDownloadSpy } from "./helpers/ui";

test("public share page renders and downloads", async ({ page, request }) => {
  await installDownloadSpy(page);
  const project = await createProjectViaApi(request, createTestUser());

  await page.goto(`/share/${project.shareToken}`);
  await dismissCookieBanner(page);
  await expect(page).toHaveURL(new RegExp(`#/share/${project.shareToken}$`));
  await expect(page.getByText(project.title)).toBeVisible();
  await expect(page.getByTestId("share-image")).toBeVisible();

  await page.getByRole("button", { name: /download/i }).first().click();
  await expect.poll(async () => page.evaluate(() => (window as any).__lastDownload?.name || ""))
    .toMatch(/\.png$/i);
});
