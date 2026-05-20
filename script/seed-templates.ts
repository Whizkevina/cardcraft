/**
 * Reseed templates from local cardcraft.db into PostgreSQL.
 * Usage: npx tsx script/seed-templates.ts
 * Requires DATABASE_URL in .env.local or .env.test (via dotenv in storage).
 */
import dotenv from "dotenv";
import path from "path";
import Database from "better-sqlite3";
import postgres from "postgres";

dotenv.config({ path: path.resolve(".env.local") });
dotenv.config({ path: path.resolve(".env.test") });
dotenv.config({ path: path.resolve(".env") });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const sqliteDb = new Database("./cardcraft.db");
  const rows = sqliteDb.prepare("SELECT * FROM templates ORDER BY id").all() as any[];
  sqliteDb.close();

  if (rows.length === 0) {
    throw new Error("No templates found in cardcraft.db");
  }

  const sql = postgres(process.env.DATABASE_URL);
  console.log(`[seed] Found ${rows.length} templates in cardcraft.db`);

  await sql`TRUNCATE TABLE templates RESTART IDENTITY CASCADE`;
  console.log("[seed] Cleared templates table");

  let inserted = 0;
  for (const t of rows) {
    await sql`
      INSERT INTO templates (title, category, status, preview_image, canvas_json, thumbnail_color, is_pro, usage_count)
      VALUES (
        ${t.title},
        ${t.category},
        ${t.status},
        ${t.preview_image ?? null},
        ${t.canvas_json},
        ${t.thumbnail_color},
        ${Number(t.is_pro ? 1 : 0)},
        ${Number(t.usage_count ?? 0)}
      )
    `;
    inserted++;
    console.log(`[seed] ✓ ${t.title}`);
  }

  const [count] = await sql`SELECT COUNT(*)::int AS count FROM templates`;
  console.log(`[seed] Done — ${inserted} inserted, ${count.count} total in PostgreSQL`);
  await sql.end();
}

main().catch(err => {
  console.error("[seed] Failed:", err.message);
  process.exit(1);
});
