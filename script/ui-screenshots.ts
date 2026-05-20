/**
 * One-off UI audit screenshots. Run: npx tsx script/ui-screenshots.ts
 * Requires dev server on PORT (default 5000) or set E2E_BASE_URL.
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const port = process.env.PORT || "5000";
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const outDir = path.resolve("test-results/ui-audit");

async function shot(page: import("@playwright/test").Page, name: string) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  console.log(`  ✓ ${name}.png`);
}

async function dismissCookie(page: import("@playwright/test").Page) {
  const btn = page.getByRole("button", { name: /accept|got it|dismiss/i });
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log(`Capturing UI screenshots → ${outDir}`);

  // Dark theme landing (default brand look)
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`${baseURL}/#/?ui-audit=dark`);
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  await page.waitForLoadState("networkidle");
  await dismissCookie(page);
  await shot(page, "01-landing-dark");

  // Public pages (light)
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload();
  await page.goto(`${baseURL}/#/`);
  await page.waitForLoadState("networkidle");
  await dismissCookie(page);
  await shot(page, "01-landing");

  await page.goto(`${baseURL}/#/templates`);
  await page.waitForLoadState("networkidle");
  await dismissCookie(page);
  await shot(page, "02-templates");

  await page.goto(`${baseURL}/#/auth`);
  await page.waitForLoadState("networkidle");
  await shot(page, "03-auth");

  await page.goto(`${baseURL}/#/pricing`);
  await page.waitForLoadState("networkidle");
  await shot(page, "04-pricing");

  // Editor (guest)
  await page.goto(`${baseURL}/#/templates`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("card-template-1").waitFor({ timeout: 30000 }).catch(() => {});
  const firstTemplate = page.getByTestId("card-template-1");
  if (await firstTemplate.isVisible().catch(() => false)) {
    await firstTemplate.click();
    await page.getByTestId("button-use-template-1").click();
    await page.getByTestId("canvas-editor").waitFor({ timeout: 20000 });
    await page.waitForTimeout(2500);
    await shot(page, "05-editor");
  }

  // Register + authenticated pages
  const email = `ui-audit-${Date.now()}@example.com`;
  await page.goto(`${baseURL}/#/auth`);
  await page.getByTestId("button-toggle-mode").click();
  await page.getByTestId("input-name").fill("UI Audit User");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("AuditPass123!");
  await page.getByTestId("button-submit-auth").click();
  await page.waitForURL(/#\/(templates|projects|)/, { timeout: 15000 }).catch(() => {});

  await page.goto(`${baseURL}/#/projects`);
  await page.waitForLoadState("networkidle");
  await shot(page, "06-projects-empty");

  await page.goto(`${baseURL}/#/bulk`);
  await page.waitForLoadState("networkidle");
  await shot(page, "07-bulk");

  await page.goto(`${baseURL}/#/settings`);
  await page.waitForLoadState("networkidle");
  await shot(page, "08-settings");

  // Light theme sample
  await page.getByTestId("button-theme-toggle").click();
  await page.goto(`${baseURL}/#/`);
  await page.waitForLoadState("networkidle");
  await shot(page, "09-landing-light");

  await browser.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
