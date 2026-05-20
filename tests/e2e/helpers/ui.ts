import { expect, Page } from "@playwright/test";

export const dismissCookieBanner = async (page: Page) => {
  const banner = page.getByText("We value your privacy");
  if (await banner.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /decline/i }).click();
    await expect(banner).toBeHidden();
  }
};

export const installDownloadSpy = async (page: Page) => {
  await page.addInitScript(() => {
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (...args: any[]) {
      const downloadName = this.download || "";
      if (downloadName || (this.href && this.href.startsWith("blob:"))) {
        (window as any).__downloadCount = ((window as any).__downloadCount || 0) + 1;
        (window as any).__lastDownload = { name: downloadName, href: this.href };
      }
      return originalClick.apply(this, args as any);
    };
  });
};

export const waitForCanvasReady = async (page: Page) => {
  await expect(page.getByTestId("canvas-editor")).toBeVisible();
  await page.waitForFunction(() => {
    const fabricReady = (window as any).fabric;
    return !!fabricReady && !!document.querySelector(".canvas-container");
  });
};
