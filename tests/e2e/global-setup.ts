import { initDb } from "../../server/storage";
import { resetDatabase, seedTemplate } from "./helpers/db";

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for e2e tests.");
  }

  // Never wipe a shared/production database unless explicitly opted in.
  if (process.env.E2E_RESET_DB !== "true") {
    console.warn(
      "[e2e] Skipping DB reset (set E2E_RESET_DB=true in .env.test to truncate before tests). " +
        "Ensure templates exist — run: npx tsx script/seed-templates.ts"
    );
    await initDb();
    return;
  }

  await initDb();
  await resetDatabase();
  await seedTemplate();
}
