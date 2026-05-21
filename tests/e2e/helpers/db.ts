import { Client } from "pg";

const ensureDbUrl = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for e2e tests.");
  }
  return process.env.DATABASE_URL;
};

export const resetDatabase = async () => {
  const client = new Client({ connectionString: ensureDbUrl() });
  await client.connect();
  await client.query(
    'TRUNCATE TABLE "session", analytics_events, analytics_sessions, admin_audit_log, payments, projects, templates, users, system_meta RESTART IDENTITY CASCADE'
  );
  await client.end();
};

export const getTemplateCount = async (): Promise<number> => {
  const client = new Client({ connectionString: ensureDbUrl() });
  await client.connect();
  const result = await client.query("SELECT COUNT(*)::int AS count FROM templates");
  await client.end();
  return result.rows[0]?.count ?? 0;
};

export const setUserTier = async (email: string, tier: "free" | "pro") => {
  const client = new Client({ connectionString: ensureDbUrl() });
  await client.connect();
  await client.query("UPDATE users SET tier = $1 WHERE email = $2", [tier, email]);
  await client.end();
};

export const seedTemplate = async () => {
  const client = new Client({ connectionString: ensureDbUrl() });
  await client.connect();

  const canvasJson = JSON.stringify({
    canvasWidth: 800,
    canvasHeight: 1000,
    background: "#1a0533",
    objects: [
      { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "#1a0533", selectable: false, evented: false, customType: "background", locked: true },
      { type: "text", text: "Greeting", left: 400, top: 320, fontSize: 48, fontFamily: "Georgia", fill: "#FFFFFF", textAlign: "center", originX: "center", customType: "greeting" },
      { type: "text", text: "NAME", left: 400, top: 420, fontSize: 64, fontFamily: "Georgia", fontWeight: "bold", fill: "#FFD700", textAlign: "center", originX: "center", customType: "name" }
    ],
  });

  await client.query(
    "INSERT INTO templates (title, category, status, canvas_json, thumbnail_color, is_pro, usage_count) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    ["Test Template", "birthday", "published", canvasJson, "#1a0533", 0, 0]
  );

  await client.end();
};
