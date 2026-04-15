import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('.env.local') });

import Database from 'better-sqlite3';
import postgres from 'postgres';

async function migrate() {
  try {
    // Load from SQLite
    const sqliteDb = new Database('./cardcraft.db');
    const templates = sqliteDb.prepare('SELECT * FROM templates').all();
    console.log('[MIGRATE] Found', templates.length, 'templates in SQLite');
    sqliteDb.close();

    // Connect to PostgreSQL
    const sql = postgres(process.env.DATABASE_URL);
    console.log('[MIGRATE] Connected to PostgreSQL');

    // Check current count
    const [result] = await sql`SELECT COUNT(*) as count FROM templates`;
    console.log('[MIGRATE] Current PostgreSQL templates:', result.count);

    // Insert templates
    let inserted = 0;
    for (const t of templates) {
      try {
        await sql`
          INSERT INTO templates (title, category, status, canvas_json, thumbnail_color, is_pro)
          VALUES (${t.title}, ${t.category}, ${t.status}, ${t.canvas_json}, ${t.thumbnail_color}, ${Boolean(t.is_pro)})
        `;
        inserted++;
      } catch (e) {
        console.error('[MIGRATE] Failed to insert', t.title, ':', e.message);
      }
    }

    console.log('[MIGRATE] Inserted', inserted, 'templates');

    // Verify
    const [final] = await sql`SELECT COUNT(*) as count FROM templates`;
    console.log('[MIGRATE] Final count in PostgreSQL:', final.count);

    await sql.end();
  } catch (e) {
    console.error('[MIGRATE] Error:', e.message);
    process.exit(1);
  }
}

migrate();
