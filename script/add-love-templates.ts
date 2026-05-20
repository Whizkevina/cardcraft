/**
 * Add romance / love templates (Bachelor + Lady).
 * Safe to re-run — skips templates that already exist by title.
 *
 * Usage: npm run db:seed-love
 */
import dotenv from "dotenv";
import path from "path";
import postgres from "postgres";

dotenv.config({ path: path.resolve(".env.local") });
dotenv.config({ path: path.resolve(".env.test") });
dotenv.config({ path: path.resolve(".env") });

const bachelorCanvas = {
  objects: [
    { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "#210313", selectable: false, evented: false, customType: "background", locked: true },
    { type: "circle", left: 400, top: 380, radius: 150, fill: "#3a0924", originX: "center", originY: "center", customType: "image-placeholder", stroke: "#ffd700", strokeWidth: 8, strokeUniform: true },
    { type: "text", text: "King of Hearts", left: 400, top: 150, fontSize: 56, fontFamily: "Georgia", fill: "#ffd700", textAlign: "center", originX: "center", customType: "title" },
    { type: "text", text: "SINGLE & THRIVING", left: 400, top: 220, fontSize: 24, fontFamily: "Arial", fill: "#fff", textAlign: "center", originX: "center", customType: "subtitle", charSpacing: 200 },
    { type: "text", text: "YOUR NAME", left: 400, top: 620, fontSize: 44, fontFamily: "Arial", fontWeight: "bold", fill: "#fff", textAlign: "center", originX: "center", customType: "name" },
    { type: "text", text: "Looking for real connection, deep conversations,\nand endless love.", left: 400, top: 720, fontSize: 28, fontFamily: "Georgia", fill: "rgba(255,255,255,0.8)", textAlign: "center", originX: "center", customType: "bio" },
  ],
  background: "#210313",
};

const ladyCanvas = {
  objects: [
    { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "#ffebef", selectable: false, evented: false, customType: "background", locked: true },
    { type: "circle", left: 400, top: 380, radius: 150, fill: "#fff", originX: "center", originY: "center", customType: "image-placeholder", stroke: "#ff668a", strokeWidth: 8, strokeUniform: true, shadow: { color: "rgba(255,102,138,0.3)", blur: 30 } },
    { type: "text", text: "Queen of Hearts", left: 400, top: 150, fontSize: 62, fontFamily: "Georgia", fontStyle: "italic", fill: "#ff3366", textAlign: "center", originX: "center", customType: "title" },
    { type: "text", text: "RADIATING ELEGANCE & LOVE", left: 400, top: 230, fontSize: 20, fontFamily: "Arial", fill: "#333", textAlign: "center", originX: "center", customType: "subtitle", charSpacing: 150 },
    { type: "text", text: "YOUR NAME", left: 400, top: 620, fontSize: 42, fontFamily: "Arial", fontWeight: "bold", fill: "#333", textAlign: "center", originX: "center", customType: "name" },
    { type: "text", text: "Captivating the room,\nleaving a little sparkle wherever I go.", left: 400, top: 720, fontSize: 28, fontFamily: "Georgia", fill: "#666", textAlign: "center", originX: "center", customType: "bio" },
    { type: "path", path: [["M", 400, 850], ["Q", 420, 830, 440, 850], ["Q", 460, 870, 400, 920], ["Q", 340, 870, 360, 850], ["Q", 380, 830, 400, 850]], fill: "#ff3366", originX: "center", originY: "center", scaleX: 0.6, scaleY: 0.6 },
  ],
  background: "#ffebef",
};

const LOVE_TEMPLATES = [
  {
    title: "Bachelor - King of Hearts",
    category: "romance",
    status: "published",
    thumbnailColor: "#210313",
    canvasJson: JSON.stringify(bachelorCanvas),
    isPro: 0,
  },
  {
    title: "Lady - Queen of Hearts",
    category: "romance",
    status: "published",
    thumbnailColor: "#ffebef",
    canvasJson: JSON.stringify(ladyCanvas),
    isPro: 0,
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  let added = 0;
  let skipped = 0;

  for (const t of LOVE_TEMPLATES) {
    const existing = await sql`SELECT id FROM templates WHERE title = ${t.title} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`[love] skip (exists): ${t.title}`);
      skipped++;
      continue;
    }

    await sql`
      INSERT INTO templates (title, category, status, preview_image, canvas_json, thumbnail_color, is_pro, usage_count)
      VALUES (
        ${t.title},
        ${t.category},
        ${t.status},
        NULL,
        ${t.canvasJson},
        ${t.thumbnailColor},
        ${t.isPro},
        0
      )
    `;
    console.log(`[love] ✓ added: ${t.title}`);
    added++;
  }

  const [count] = await sql`SELECT COUNT(*)::int AS count FROM templates WHERE category = 'romance'`;
  console.log(`[love] Done — ${added} added, ${skipped} skipped, ${count.count} romance template(s) total`);
  await sql.end();
}

main().catch((err) => {
  console.error("[love] Failed:", err.message);
  process.exit(1);
});
