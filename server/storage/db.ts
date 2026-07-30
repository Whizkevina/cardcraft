import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";

let dbInstance: any;
let pgPool: Pool | null = null;

export function getDb() {
  if (!dbInstance) {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
    // Explicitly set prepare: false to work cleanly with Supabase/PgBouncer connection poolers
    const qc = postgres(DATABASE_URL, { prepare: false, max: 10, idle_timeout: 30 });
    dbInstance = drizzle(qc, { schema });
  }
  return dbInstance;
}

export function getPgPool(): Pool {
  if (!pgPool) {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
    pgPool = new Pool({ connectionString: DATABASE_URL });
  }
  return pgPool;
}

export const db = new Proxy({}, { get: (t, p) => (getDb() as any)[p] });
export const queryClient = new Proxy({}, { get: (t, p) => (getDb() as any)[p] });

export async function pingDatabase(): Promise<boolean> {
  try {
    await getDb().execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export async function initDb() {
  const dbURL = process.env.DATABASE_URL;
  if (!dbURL) throw new Error("DATABASE_URL environment variable not set");
  const qc = postgres(dbURL, { prepare: false, max: 10, idle_timeout: 30 });
  console.log("[DB] Initializing Supabase PostgreSQL tables...");
  await qc`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT DEFAULT 'user', tier TEXT DEFAULT 'free', theme TEXT DEFAULT 'dark', downloads_today INTEGER DEFAULT 0, last_download_date TEXT, reset_token TEXT, reset_token_expiry TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await qc`CREATE TABLE IF NOT EXISTS templates (id SERIAL PRIMARY KEY, title TEXT NOT NULL, category TEXT DEFAULT 'birthday', status TEXT DEFAULT 'draft', preview_image TEXT, canvas_json TEXT NOT NULL, thumbnail_color TEXT DEFAULT '#8B5CF6', is_pro INTEGER DEFAULT 0, usage_count INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await qc`CREATE TABLE IF NOT EXISTS projects (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, template_id INTEGER, title TEXT DEFAULT 'Untitled Card', design_json TEXT NOT NULL, export_settings TEXT DEFAULT '{}', thumbnail TEXT, share_token TEXT, share_enabled BOOLEAN DEFAULT FALSE, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await qc`CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, reference TEXT NOT NULL UNIQUE, amount INTEGER NOT NULL, currency TEXT DEFAULT 'NGN', status TEXT DEFAULT 'pending', plan TEXT DEFAULT 'pro_lifetime', paystack_data TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  // Base admin_audit_log table must exist before the ALTER TABLE block below,
  // which adds its remaining columns — those ALTERs used to run before this
  // CREATE TABLE and silently no-op on a fresh database (caught by the outer
  // try/catch), leaving admin_audit_log without a `severity` column and
  // crashing the later `CREATE INDEX ... (severity)` statement.
  await qc`CREATE TABLE IF NOT EXISTS admin_audit_log (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER,
    actor_role TEXT DEFAULT 'user',
    actor_email TEXT,
    actor_name TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    meta TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  // Create connect-pg-simple session table required for auth
  await qc`CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
  ) WITH (OIDS=FALSE)`;

  // Note: we can't easily run conditional primary keys via raw queries without PLpgSQL,
  // so we'll ensure the primary key and index conditionally.
  try {
    await qc`ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE`;
  } catch (e) {
    // Constraint likely already exists; ignore
  }
  await qc`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`;

  await qc`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
  try {
    await qc`ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token TEXT`;
    await qc`ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT FALSE`;
    await qc`ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_image TEXT`;
    await qc`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email'`;
    await qc`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`;
    await qc`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`;
    await qc`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_downloads INTEGER DEFAULT 0`;
    await qc`ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMP`;
    await qc`ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_note TEXT`;
    await qc`ALTER TABLE admin_audit_log ALTER COLUMN actor_id DROP NOT NULL`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS actor_role TEXT DEFAULT 'user'`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS actor_email TEXT`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS actor_name TEXT`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS ip_address TEXT`;
    await qc`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_note TEXT`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS ip_hash TEXT`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS session_id TEXT`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info'`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS page_path TEXT`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS referrer TEXT`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS before_value TEXT`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS after_value TEXT`;
    await qc`ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS integrity_hash TEXT`;
    await qc`CREATE TABLE IF NOT EXISTS system_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
  } catch {
    // Columns may already exist on older Postgres versions without IF NOT EXISTS support.
  }
  await qc`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`;
  await qc`CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token)`;
  await qc`CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)`;
  await qc`CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC)`;
  await qc`CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action)`;
  await qc`CREATE INDEX IF NOT EXISTS idx_admin_audit_log_severity ON admin_audit_log(severity)`;
  await qc`CREATE TABLE IF NOT EXISTS analytics_sessions (
    id SERIAL PRIMARY KEY,
    session_key TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT,
    user_email TEXT,
    user_role TEXT,
    user_tier TEXT,
    page_path TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_campaign TEXT,
    browser TEXT,
    os TEXT,
    device_type TEXT,
    country TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  await qc`CREATE INDEX IF NOT EXISTS idx_analytics_sessions_last_seen ON analytics_sessions(last_seen_at DESC)`;
  await qc`CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user ON analytics_sessions(user_id)`;
  await qc`CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    session_key TEXT,
    user_id INTEGER,
    event_type TEXT NOT NULL,
    page_path TEXT,
    action TEXT,
    resource_type TEXT,
    resource_id INTEGER,
    meta TEXT,
    browser TEXT,
    os TEXT,
    device_type TEXT,
    referrer TEXT,
    ip_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  await qc`CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC)`;
  await qc`CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type)`;
  await qc`CREATE INDEX IF NOT EXISTS idx_analytics_events_page ON analytics_events(page_path)`;
  console.log("[DB] ✅ Database initialized successfully");
  await qc.end(); // close this single-purpose connection pool so we don't block
}
