/**
 * Generate JPEG preview_image data URLs for all templates.
 * Usage: npx tsx script/generate-template-previews.ts [--force]
 * Requires DATABASE_URL in .env.local / .env.test
 */
import dotenv from "dotenv";
import path from "path";
import { chromium } from "@playwright/test";
import postgres from "postgres";

dotenv.config({ path: path.resolve(".env.local") });
dotenv.config({ path: path.resolve(".env.test") });
dotenv.config({ path: path.resolve(".env") });

const FABRIC_CDN = "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js";
const PREVIEW_MULTIPLIER = 0.45;
const PREVIEW_QUALITY = 0.88;
const MAX_PREVIEW_LENGTH = 600_000;

const force = process.argv.includes("--force");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(process.env.DATABASE_URL);
  const rows = await sql<
    { id: number; title: string; canvas_json: string; preview_image: string | null }[]
  >`SELECT id, title, canvas_json, preview_image FROM templates ORDER BY id`;

  if (rows.length === 0) {
    console.log("[previews] No templates in database — run npm run db:seed first");
    await sql.end();
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`
    <!DOCTYPE html><html><head><script src="${FABRIC_CDN}"></script></head><body></body></html>
  `);
  await page.waitForFunction(() => !!(window as any).fabric, undefined, { timeout: 30000 });

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.preview_image && !force) {
      console.log(`[previews] skip (exists): ${row.title}`);
      skipped++;
      continue;
    }

    const preview = await page.evaluate(
      async ({ canvasJson, multiplier, quality }) => {
        const f = (window as any).fabric;
        if (!f) throw new Error("Fabric not loaded");

        const data = JSON.parse(canvasJson);
        const w = data.canvasWidth || 800;
        const h = data.canvasHeight || 1000;
        const el = document.createElement("canvas");
        const canvas = new f.StaticCanvas(el, { width: w, height: h });

        return new Promise<string>((resolve, reject) => {
          canvas.loadFromJSON(data, () => {
            canvas.renderAll();
            setTimeout(() => {
              try {
                resolve(canvas.toDataURL({ format: "jpeg", quality: quality, multiplier: multiplier }));
              } catch (e) {
                reject(e);
              } finally {
                canvas.dispose();
              }
            }, 350);
          });
        });
      },
      { canvasJson: row.canvas_json, multiplier: PREVIEW_MULTIPLIER, quality: PREVIEW_QUALITY },
    );

    if (!preview.startsWith("data:image/jpeg;base64,")) {
      console.warn(`[previews] ✗ ${row.title}: invalid data URL`);
      continue;
    }
    if (preview.length > MAX_PREVIEW_LENGTH) {
      console.warn(`[previews] ✗ ${row.title}: preview too large (${preview.length} bytes)`);
      continue;
    }

    await sql`UPDATE templates SET preview_image = ${preview} WHERE id = ${row.id}`;
    console.log(`[previews] ✓ ${row.title} (${Math.round(preview.length / 1024)} KB)`);
    updated++;
  }

  await browser.close();
  await sql.end();
  console.log(`[previews] Done — ${updated} updated, ${skipped} skipped`);
}

main().catch((err) => {
  console.error("[previews] Failed:", err.message);
  process.exit(1);
});
