/**
 * Capture the landing page hero as the social preview image (1200×630).
 * Usage: npm run og:generate
 * Requires dev server on PORT (default 5000) or set E2E_BASE_URL.
 */
import { chromium } from "@playwright/test";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

const port = process.env.PORT || "5000";
const baseURL = (process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, "");
const outPath = path.resolve("client/public/og-image.png");
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

async function isServerUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, timeoutMs = 90000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerUp(url)) return;
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error(`Server not reachable at ${url} after ${timeoutMs}ms`);
}

function startDevServer(): ChildProcess {
  return spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT: port, HOST: "127.0.0.1", NODE_ENV: "development" },
  });
}

async function dismissCookie(page: import("@playwright/test").Page) {
  await page.evaluate(() => localStorage.setItem("cookie_consent", "accepted"));
}

async function main() {
  let devProcess: ChildProcess | null = null;
  const startedServer = !(await isServerUp(baseURL));

  if (startedServer) {
    console.log(`Starting dev server on ${baseURL}…`);
    devProcess = startDevServer();
    await waitForServer(baseURL);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: OG_WIDTH, height: OG_HEIGHT } });

  try {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`${baseURL}/#/`);
    await dismissCookie(page);
    await page.reload({ waitUntil: "networkidle" });

    await page.locator("#home-hero").waitFor({ timeout: 30000 });
    await page.getByTestId("button-start-creating").waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);

    await page.screenshot({
      path: outPath,
      type: "png",
      clip: { x: 0, y: 0, width: OG_WIDTH, height: OG_HEIGHT },
    });

    console.log(`✓ OG image saved → ${outPath} (${OG_WIDTH}×${OG_HEIGHT})`);
  } finally {
    await browser.close();
    if (devProcess) {
      devProcess.kill("SIGTERM");
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
