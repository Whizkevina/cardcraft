import { sql } from "drizzle-orm";
import { getDb } from "./db";

export async function setSystemMeta(key: string, value: string): Promise<void> {
  await getDb().execute(sql`
    INSERT INTO system_meta (key, value, updated_at) VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `);
}

export async function getSystemMeta(key: string): Promise<{ value: string; updatedAt: string | null } | null> {
  const result = await getDb().execute(sql`
    SELECT value, updated_at FROM system_meta WHERE key = ${key} LIMIT 1
  `);
  const row = (result as unknown as { value: string; updated_at: Date | string }[])[0];
  if (!row) return null;
  return {
    value: row.value,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}
