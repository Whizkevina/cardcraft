import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import postgres from "postgres";

// One-time helper for databases that already have all tables created via
// `drizzle-kit push` (i.e. any environment running before migrations were
// introduced). It records the baseline migration as already-applied in
// drizzle's tracking table WITHOUT running its SQL, so `db:migrate` doesn't
// try to re-CREATE TABLEs that already exist. Safe to run multiple times.
//
// Do NOT run this against a fresh/empty database — use `npm run db:migrate`
// there instead so the baseline migration actually creates the tables.

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

  const journal = JSON.parse(fs.readFileSync("./migrations/meta/_journal.json", "utf-8"));
  const baseline = journal.entries.find((e: any) => e.tag === "0000_baseline");
  if (!baseline) throw new Error("Could not find 0000_baseline entry in migrations journal");

  const sql = fs.readFileSync("./migrations/0000_baseline.sql", "utf-8");
  const hash = crypto.createHash("sha256").update(sql).digest("hex");

  const client = postgres(DATABASE_URL, { prepare: false, max: 1 });

  const existingUsers = await client`select to_regclass('public.users') as reg`;
  if (!existingUsers[0]?.reg) {
    await client.end();
    throw new Error(
      "public.users table does not exist — this looks like a fresh database. " +
        "Run `npm run db:migrate` instead, not this script."
    );
  }

  await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await client`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const already = await client`
    select 1 from drizzle.__drizzle_migrations where hash = ${hash} limit 1
  `;
  if (already.length > 0) {
    console.log("Baseline migration already marked as applied. Nothing to do.");
  } else {
    await client`
      insert into drizzle.__drizzle_migrations (hash, created_at)
      values (${hash}, ${baseline.when})
    `;
    console.log(`Marked baseline migration (${hash}) as applied at ${baseline.when}.`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
