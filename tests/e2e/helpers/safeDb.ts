const SUPABASE_HOST_PATTERN = /supabase\.co|pooler\.supabase\.com/i;

function dbHostname(url: string): string | null {
  try {
    return new URL(url.replace(/^postgresql:/, "http:")).hostname;
  } catch {
    return null;
  }
}

function isLocalHost(hostname: string | null): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Prevent E2E from truncating or mutating production Supabase data.
 * Requires local Postgres in `.env.test` (see `.env.test.example`).
 */
export function assertSafeE2EDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return;

  const hostname = dbHostname(url);
  const isSupabase = SUPABASE_HOST_PATTERN.test(url);

  if (isSupabase && process.env.E2E_ALLOW_REMOTE_DB !== "true") {
    throw new Error(
      "[e2e] Refusing to run against Supabase — E2E mutates admin passwords and may truncate tables. " +
        "Point DATABASE_URL in .env.test at local Postgres (see .env.test.example). " +
        "Set E2E_ALLOW_REMOTE_DB=true only for a dedicated remote test database."
    );
  }

  if (process.env.E2E_RESET_DB === "true" && !isLocalHost(hostname)) {
    throw new Error(
      "[e2e] E2E_RESET_DB=true requires a local test database (localhost / 127.0.0.1). " +
        "Refusing to truncate a remote DATABASE_URL."
    );
  }
}
