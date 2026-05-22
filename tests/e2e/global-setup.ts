import { initDb } from "../../server/storage";
import { resetDatabase, seedTemplate, getTemplateCount } from "./helpers/db";
import { assertSafeE2EDatabase } from "./helpers/safeDb";

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for e2e tests.");
  }

  assertSafeE2EDatabase();

  await initDb();

  if (process.env.E2E_RESET_DB === "true") {
    console.log("[e2e] Resetting test database…");
    await resetDatabase();
  } else {
    console.warn(
      "[e2e] Skipping DB reset (set E2E_RESET_DB=true for a clean slate each run)."
    );
  }

  const templateCount = await getTemplateCount();
  if (templateCount === 0) {
    console.log("[e2e] No templates found — seeding default test template");
    await seedTemplate();
  } else {
    console.log(`[e2e] Templates ready (${templateCount} in database)`);
  }
}
