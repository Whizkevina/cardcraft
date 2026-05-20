import { expect, test } from "@playwright/test";
import { dismissCookieBanner, waitForCanvasReady } from "./helpers/ui";

test("open template in editor and export", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/#/templates");
  await dismissCookieBanner(page);

  await page.getByTestId("card-template-1").click();
  await page.getByTestId("button-use-template-1").click();

  await expect(page.getByTestId("canvas-editor")).toBeVisible();
  await waitForCanvasReady(page);

  const pngDownload = page.waitForEvent("download");
  await page.getByTestId("button-export-png").click();
  const pngFile = await pngDownload;
  expect(pngFile.suggestedFilename()).toMatch(/\.png$/i);

  await page.getByRole("tab", { name: "Export" }).click();
  await page.getByTestId("button-download-svg").click();
  await expect(page.getByRole("status").filter({ hasText: /Downloaded!/i }).first()).toBeVisible({ timeout: 30000 });
});
