import { expect, test } from "@playwright/test";
import { createLegacySharedProject } from "./helpers/api";
import { createTestUser } from "./helpers/user";
import { dismissCookieBanner, installDownloadSpy } from "./helpers/ui";

test("legacy share without snapshot renders canvas from designJson", async ({ page }) => {
  await installDownloadSpy(page);
  const project = await createLegacySharedProject(page.request, createTestUser());

  await page.goto(`/share/${project.shareToken}`);
  await dismissCookieBanner(page);
  await expect(page).toHaveURL(new RegExp(`#/share/${project.shareToken}$`));
  await expect(page.getByText(project.title)).toBeVisible();
  await expect(page.getByTestId("share-canvas")).toBeVisible();
  await expect(page.getByTestId("share-image")).toHaveCount(0);

  await page.getByRole("button", { name: /download/i }).first().click();
  await expect.poll(async () => page.evaluate(() => (window as any).__lastDownload?.name || ""))
    .toMatch(/\.png$/i);
});
