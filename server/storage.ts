import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";
import { eq, desc, sql, and, ilike, gte, lte } from "drizzle-orm";
import crypto from "crypto";
import { maskIp, hashIp, buildIntegrityHash, getAuditSeverity } from "./auditUtils";
import type { User, InsertUser, Template, InsertTemplate, Project, InsertProject, Payment, InsertPayment, AnalyticsSession, AnalyticsEvent } from "@shared/schema";
import { FREE_PROJECT_LIMIT } from "@shared/schema";

let dbInstance: any;
let pgPool: Pool | null = null;

function getDb() {
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

export async function initDb() {
  const dbURL = process.env.DATABASE_URL;
  if (!dbURL) throw new Error("DATABASE_URL environment variable not set");
  const qc = postgres(dbURL, { prepare: false, max: 10, idle_timeout: 30 });
  console.log("[DB] Initializing Supabase PostgreSQL tables...");
  await qc`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT DEFAULT 'user', tier TEXT DEFAULT 'free', theme TEXT DEFAULT 'dark', downloads_today INTEGER DEFAULT 0, last_download_date TEXT, reset_token TEXT, reset_token_expiry TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await qc`CREATE TABLE IF NOT EXISTS templates (id SERIAL PRIMARY KEY, title TEXT NOT NULL, category TEXT DEFAULT 'birthday', status TEXT DEFAULT 'draft', preview_image TEXT, canvas_json TEXT NOT NULL, thumbnail_color TEXT DEFAULT '#8B5CF6', is_pro BOOLEAN DEFAULT FALSE, usage_count INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await qc`CREATE TABLE IF NOT EXISTS projects (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, template_id INTEGER, title TEXT DEFAULT 'Untitled Card', design_json TEXT NOT NULL, export_settings TEXT DEFAULT '{}', thumbnail TEXT, share_token TEXT, share_enabled BOOLEAN DEFAULT FALSE, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await qc`CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, reference TEXT NOT NULL UNIQUE, amount INTEGER NOT NULL, currency TEXT DEFAULT 'NGN', status TEXT DEFAULT 'pending', plan TEXT DEFAULT 'pro_lifetime', paystack_data TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  
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

export class Storage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await getDb().select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return user;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await getDb().select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return user;
  }
  async createUser(data: InsertUser): Promise<User> {
    const [user] = await getDb().insert(schema.users).values(data).returning();
    return user;
  }
  async getAllUsers(): Promise<User[]> {
    return getDb().select().from(schema.users);
  }
  async updateUserTier(id: number, tier: "free" | "pro", proExpiresAt?: Date | null): Promise<User | undefined> {
    const patch: Partial<User> = { tier };
    if (tier === "free") patch.proExpiresAt = null;
    else if (proExpiresAt !== undefined) patch.proExpiresAt = proExpiresAt;
    const [user] = await getDb().update(schema.users).set(patch).where(eq(schema.users.id, id)).returning();
    return user;
  }
  async updateUserRole(id: number, role: "user" | "admin" | "support" | "content"): Promise<User | undefined> {
    const [user] = await getDb().update(schema.users).set({ role: role as any }).where(eq(schema.users.id, id)).returning();
    return user;
  }
  async updateUserPassword(id: number, hashedPassword: string): Promise<User | undefined> {
    const [user] = await getDb().update(schema.users).set({ password: hashedPassword }).where(eq(schema.users.id, id)).returning();
    return user;
  }
  async updateUserTheme(id: number, theme: "dark" | "light"): Promise<User | undefined> {
    const [user] = await getDb().update(schema.users).set({ theme }).where(eq(schema.users.id, id)).returning();
    return user;
  }
  async setResetToken(email: string, token: string, expiry: string): Promise<boolean> {
    await getDb().update(schema.users).set({ resetToken: token, resetTokenExpiry: expiry }).where(eq(schema.users.email, email));
    return true;
  }
  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await getDb().select().from(schema.users).where(eq(schema.users.resetToken, token)).limit(1);
    return user;
  }
  async clearResetToken(id: number): Promise<void> {
    await getDb().update(schema.users).set({ resetToken: null, resetTokenExpiry: null }).where(eq(schema.users.id, id));
  }
  async trackDownload(userId: number): Promise<{ allowed: boolean; downloadsToday: number }> {
    const user = await this.getUser(userId);
    if (!user) return { allowed: false, downloadsToday: 0 };
    const today = new Date().toISOString().split("T")[0];
    const downloadDate = user.lastDownloadDate?.split("T")[0];
    const downloadsToday = downloadDate === today ? user.downloadsToday + 1 : 1;
    const allowed = user.tier === "pro" || downloadsToday <= 3;
    if (allowed) {
      await getDb().update(schema.users).set({
        downloadsToday,
        lastDownloadDate: new Date().toISOString(),
        totalDownloads: sql`${schema.users.totalDownloads} + 1`,
      }).where(eq(schema.users.id, userId));
    }
    return { allowed, downloadsToday };
  }
  async getAnalytics() {
    const totalUsers = await getDb().select({ count: sql`count(*)` }).from(schema.users);
    const proUsers = await getDb().select({ count: sql`count(*)` }).from(schema.users).where(eq(schema.users.tier, "pro"));
    const totalCards = await getDb().select({ count: sql`count(*)` }).from(schema.projects);
    const totalRevenue = await getDb().select({ sum: sql`coalesce(sum(amount), 0)` }).from(schema.payments).where(eq(schema.payments.status, "success"));
    const today = new Date().toISOString().split("T")[0];
    const cardsToday = await getDb().select({ count: sql`count(*)` }).from(schema.projects).where(sql`DATE(created_at) = ${today}`);
    const signupsToday = await getDb().select({ count: sql`count(*)` }).from(schema.users).where(sql`DATE(created_at) = ${today}`);
    const topTemplates = await getDb().select({ id: schema.templates.id, title: schema.templates.title, uses: schema.templates.usageCount, thumbnailColor: schema.templates.thumbnailColor }).from(schema.templates).orderBy(desc(schema.templates.usageCount)).limit(5);
    const recentSignups = await getDb().select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, createdAt: schema.users.createdAt, tier: schema.users.tier }).from(schema.users).orderBy(desc(schema.users.createdAt)).limit(10);
    return { totalUsers: (totalUsers[0]?.count as any) || 0, proUsers: (proUsers[0]?.count as any) || 0, totalCards: (totalCards[0]?.count as any) || 0, totalRevenue: (totalRevenue[0]?.sum as any) || 0, cardsToday: (cardsToday[0]?.count as any) || 0, signupsToday: (signupsToday[0]?.count as any) || 0, topTemplates, recentSignups };
  }
  async getAllTemplates(): Promise<Template[]> { return getDb().select().from(schema.templates).orderBy(desc(schema.templates.id)); }
  async getTemplatesCount(): Promise<number> {
    const result = await getDb().select({ count: sql<number>`COUNT(*)` }).from(schema.templates);
    const count = result[0]?.count;
    return typeof count === 'string' ? parseInt(count, 10) : (count || 0) as number;
  }
  async getPublishedTemplates(): Promise<Template[]> { return getDb().select().from(schema.templates).where(eq(schema.templates.status, "published")).orderBy(desc(schema.templates.id)); }
  async getTemplate(id: number): Promise<Template | undefined> { const [t] = await getDb().select().from(schema.templates).where(eq(schema.templates.id, id)).limit(1); return t; }
  async createTemplate(data: InsertTemplate): Promise<Template> { const [t] = await getDb().insert(schema.templates).values(data).returning(); return t; }
  async updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined> { const [t] = await getDb().update(schema.templates).set(data).where(eq(schema.templates.id, id)).returning(); return t; }
  async deleteTemplate(id: number): Promise<void> { await getDb().delete(schema.templates).where(eq(schema.templates.id, id)); }
  async incrementTemplateUsage(id: number): Promise<void> { await getDb().update(schema.templates).set({ usageCount: sql`usage_count + 1` }).where(eq(schema.templates.id, id)); }
  async getProject(id: number): Promise<Project | undefined> { const [p] = await getDb().select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1); return p; }
  async getProjectByShareToken(token: string): Promise<Project | undefined> {
    const [p] = await getDb().select().from(schema.projects).where(eq(schema.projects.shareToken, token)).limit(1);
    return p;
  }
  async getProjectsByUser(userId: number): Promise<Project[]> { return getDb().select().from(schema.projects).where(eq(schema.projects.userId, userId)).orderBy(desc(schema.projects.updatedAt)); }
  async createProject(data: InsertProject): Promise<Project> {
    const shareToken = crypto.randomBytes(24).toString("hex");
    const [p] = await getDb().insert(schema.projects).values({ ...data, shareToken }).returning();
    return p;
  }
  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> { const [p] = await getDb().update(schema.projects).set(data).where(eq(schema.projects.id, id)).returning(); return p; }
  async deleteProject(id: number): Promise<void> { await getDb().delete(schema.projects).where(eq(schema.projects.id, id)); }
  async duplicateProject(id: number, userId: number): Promise<Project | undefined> {
    const existing = await this.getProject(id);
    if (!existing || existing.userId !== userId) return undefined;
    const shareToken = crypto.randomBytes(24).toString("hex");
    const [d] = await getDb().insert(schema.projects).values({
      userId,
      templateId: existing.templateId,
      title: `${existing.title} (Copy)`,
      designJson: existing.designJson,
      exportSettings: existing.exportSettings,
      thumbnail: existing.thumbnail,
      shareToken,
      shareEnabled: false,
    }).returning();
    return d;
  }
  async enableProjectShare(id: number, userId: number, shareImage?: string | null): Promise<Project | undefined> {
    const existing = await this.getProject(id);
    if (!existing || existing.userId !== userId) return undefined;
    const shareToken = existing.shareToken || crypto.randomBytes(24).toString("hex");
    const patch: { shareEnabled: boolean; shareToken: string; shareImage?: string } = {
      shareEnabled: true,
      shareToken,
    };
    if (shareImage) patch.shareImage = shareImage;
    const [p] = await getDb().update(schema.projects).set(patch).where(eq(schema.projects.id, id)).returning();
    return p;
  }
  async renameProject(id: number, userId: number, title: string): Promise<Project | undefined> { const existing = await this.getProject(id); if (!existing || existing.userId !== userId) return undefined; const [p] = await getDb().update(schema.projects).set({ title }).where(eq(schema.projects.id, id)).returning(); return p; }
  async getPayment(reference: string): Promise<Payment | undefined> { const [p] = await getDb().select().from(schema.payments).where(eq(schema.payments.reference, reference)).limit(1); return p; }
  async getPaymentsByUser(userId: number): Promise<Payment[]> { return getDb().select().from(schema.payments).where(eq(schema.payments.userId, userId)).orderBy(desc(schema.payments.createdAt)); }
  async createPayment(data: InsertPayment): Promise<Payment> { const [p] = await getDb().insert(schema.payments).values(data).returning(); return p; }
  async updatePaymentStatus(reference: string, status: "success" | "failed"): Promise<Payment | undefined> { const [p] = await getDb().update(schema.payments).set({ status }).where(eq(schema.payments.reference, reference)).returning(); return p; }

  async touchLastLogin(userId: number): Promise<void> {
    await getDb().update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId));
  }

  async updateUserStatus(id: number, status: "active" | "suspended"): Promise<User | undefined> {
    const [user] = await getDb().update(schema.users).set({ status }).where(eq(schema.users.id, id)).returning();
    return user;
  }

  async updateUserAuthProvider(id: number, authProvider: "email" | "google"): Promise<void> {
    await getDb().update(schema.users).set({ authProvider }).where(eq(schema.users.id, id));
  }

  async enforceProExpiry(user: User): Promise<User> {
    if (user.tier !== "pro" || !user.proExpiresAt) return user;
    if (new Date(user.proExpiresAt) > new Date()) return user;
    const [updated] = await getDb().update(schema.users).set({ tier: "free", proExpiresAt: null }).where(eq(schema.users.id, user.id)).returning();
    return updated ?? user;
  }

  async destroyUserSessions(userId: number): Promise<number> {
    const pool = getPgPool();
    const result = await pool.query(`DELETE FROM session WHERE sess->>'userId' = $1`, [String(userId)]);
    return result.rowCount ?? 0;
  }

  async updatePaymentRefundNote(id: number, refundNote: string | null): Promise<Payment | undefined> {
    const [payment] = await getDb().update(schema.payments).set({ refundNote }).where(eq(schema.payments.id, id)).returning();
    return payment;
  }

  async logAuditEvent(data: {
    actorId?: number | null;
    actorRole: string;
    actorEmail?: string | null;
    actorName?: string | null;
    action: string;
    targetType: string;
    targetId?: number | null;
    meta?: Record<string, unknown>;
    ipAddress?: string | null;
    sessionId?: string | null;
    userAgent?: string | null;
    severity?: string;
    pagePath?: string | null;
    referrer?: string | null;
    beforeValue?: string | null;
    afterValue?: string | null;
  }): Promise<void> {
    const rawIp = data.ipAddress ?? null;
    const ipHash = hashIp(rawIp);
    const maskedIp = maskIp(rawIp);
    const severity = data.severity ?? getAuditSeverity(data.action);
    const integrityPayload = {
      action: data.action,
      actorId: data.actorId ?? null,
      targetType: data.targetType,
      targetId: data.targetId ?? null,
      severity,
      at: new Date().toISOString(),
    };
    await getDb().insert(schema.adminAuditLog).values({
      actorId: data.actorId ?? null,
      actorRole: data.actorRole,
      actorEmail: data.actorEmail ?? null,
      actorName: data.actorName ?? null,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId ?? null,
      meta: data.meta ? JSON.stringify(data.meta) : null,
      ipAddress: maskedIp,
      ipHash,
      sessionId: data.sessionId ?? null,
      userAgent: data.userAgent?.slice(0, 512) ?? null,
      severity,
      pagePath: data.pagePath?.slice(0, 256) ?? null,
      referrer: data.referrer?.slice(0, 512) ?? null,
      beforeValue: data.beforeValue ?? null,
      afterValue: data.afterValue ?? null,
      integrityHash: buildIntegrityHash(integrityPayload),
    });
  }

  /** @deprecated use logAuditEvent */
  async logAdminAction(
    actorId: number,
    action: string,
    targetType: string,
    targetId: number | null,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const user = await this.getUser(actorId);
    await this.logAuditEvent({
      actorId,
      actorRole: user?.role ?? "admin",
      actorEmail: user?.email ?? null,
      actorName: user?.name ?? null,
      action,
      targetType,
      targetId,
      meta,
    });
  }

  async getAuditLogs(filters: {
    limit?: number;
    offset?: number;
    search?: string;
    action?: string;
    actorRole?: string;
    severity?: string;
    from?: string;
    to?: string;
    ipHash?: string;
  } = {}) {
    const conditions = [];
    if (filters.action && filters.action !== "all") {
      conditions.push(eq(schema.adminAuditLog.action, filters.action));
    }
    if (filters.actorRole && filters.actorRole !== "all") {
      conditions.push(eq(schema.adminAuditLog.actorRole, filters.actorRole));
    }
    if (filters.severity && filters.severity !== "all") {
      conditions.push(eq(schema.adminAuditLog.severity, filters.severity));
    }
    if (filters.from) {
      conditions.push(gte(schema.adminAuditLog.createdAt, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(schema.adminAuditLog.createdAt, new Date(filters.to)));
    }
    if (filters.ipHash?.trim()) {
      conditions.push(eq(schema.adminAuditLog.ipHash, filters.ipHash.trim()));
    }
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(
        sql`(
          ${schema.adminAuditLog.action} ILIKE ${q}
          OR coalesce(${schema.adminAuditLog.actorName}, ${schema.users.name}, '') ILIKE ${q}
          OR coalesce(${schema.adminAuditLog.actorEmail}, ${schema.users.email}, '') ILIKE ${q}
          OR coalesce(${schema.adminAuditLog.meta}, '') ILIKE ${q}
          OR coalesce(${schema.adminAuditLog.pagePath}, '') ILIKE ${q}
          OR coalesce(${schema.adminAuditLog.sessionId}, '') ILIKE ${q}
        )`,
      );
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const limit = Math.min(filters.limit ?? 100, 500);
    const offset = filters.offset ?? 0;

    return getDb()
      .select({
        id: schema.adminAuditLog.id,
        actorId: schema.adminAuditLog.actorId,
        actorRole: schema.adminAuditLog.actorRole,
        actorEmail: schema.adminAuditLog.actorEmail,
        actorName: sql<string | null>`coalesce(${schema.adminAuditLog.actorName}, ${schema.users.name})`,
        action: schema.adminAuditLog.action,
        targetType: schema.adminAuditLog.targetType,
        targetId: schema.adminAuditLog.targetId,
        meta: schema.adminAuditLog.meta,
        ipAddress: schema.adminAuditLog.ipAddress,
        ipHash: schema.adminAuditLog.ipHash,
        sessionId: schema.adminAuditLog.sessionId,
        userAgent: schema.adminAuditLog.userAgent,
        severity: schema.adminAuditLog.severity,
        pagePath: schema.adminAuditLog.pagePath,
        referrer: schema.adminAuditLog.referrer,
        beforeValue: schema.adminAuditLog.beforeValue,
        afterValue: schema.adminAuditLog.afterValue,
        integrityHash: schema.adminAuditLog.integrityHash,
        createdAt: schema.adminAuditLog.createdAt,
      })
      .from(schema.adminAuditLog)
      .leftJoin(schema.users, eq(schema.adminAuditLog.actorId, schema.users.id))
      .where(whereClause)
      .orderBy(desc(schema.adminAuditLog.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAuditLogCount(filters: {
    search?: string;
    action?: string;
    actorRole?: string;
    severity?: string;
    from?: string;
    to?: string;
    ipHash?: string;
  } = {}): Promise<number> {
    const conditions = [];
    if (filters.action && filters.action !== "all") conditions.push(eq(schema.adminAuditLog.action, filters.action));
    if (filters.actorRole && filters.actorRole !== "all") conditions.push(eq(schema.adminAuditLog.actorRole, filters.actorRole));
    if (filters.severity && filters.severity !== "all") conditions.push(eq(schema.adminAuditLog.severity, filters.severity));
    if (filters.from) conditions.push(gte(schema.adminAuditLog.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(schema.adminAuditLog.createdAt, new Date(filters.to)));
    if (filters.ipHash?.trim()) conditions.push(eq(schema.adminAuditLog.ipHash, filters.ipHash.trim()));
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(sql`(
        ${schema.adminAuditLog.action} ILIKE ${q}
        OR coalesce(${schema.adminAuditLog.actorName}, ${schema.users.name}, '') ILIKE ${q}
        OR coalesce(${schema.adminAuditLog.actorEmail}, ${schema.users.email}, '') ILIKE ${q}
        OR coalesce(${schema.adminAuditLog.meta}, '') ILIKE ${q}
      )`);
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const [row] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.adminAuditLog)
      .leftJoin(schema.users, eq(schema.adminAuditLog.actorId, schema.users.id))
      .where(whereClause);
    return row?.count ?? 0;
  }

  async getAuditLogById(id: number) {
    const [row] = await getDb()
      .select({
        id: schema.adminAuditLog.id,
        actorId: schema.adminAuditLog.actorId,
        actorRole: schema.adminAuditLog.actorRole,
        actorEmail: schema.adminAuditLog.actorEmail,
        actorName: sql<string | null>`coalesce(${schema.adminAuditLog.actorName}, ${schema.users.name})`,
        action: schema.adminAuditLog.action,
        targetType: schema.adminAuditLog.targetType,
        targetId: schema.adminAuditLog.targetId,
        meta: schema.adminAuditLog.meta,
        ipAddress: schema.adminAuditLog.ipAddress,
        ipHash: schema.adminAuditLog.ipHash,
        sessionId: schema.adminAuditLog.sessionId,
        userAgent: schema.adminAuditLog.userAgent,
        severity: schema.adminAuditLog.severity,
        pagePath: schema.adminAuditLog.pagePath,
        referrer: schema.adminAuditLog.referrer,
        beforeValue: schema.adminAuditLog.beforeValue,
        afterValue: schema.adminAuditLog.afterValue,
        integrityHash: schema.adminAuditLog.integrityHash,
        createdAt: schema.adminAuditLog.createdAt,
      })
      .from(schema.adminAuditLog)
      .leftJoin(schema.users, eq(schema.adminAuditLog.actorId, schema.users.id))
      .where(eq(schema.adminAuditLog.id, id))
      .limit(1);
    return row;
  }

  async getProjectStatsByUser(): Promise<Record<number, { projectCount: number; sharedCount: number }>> {
    const rows = await getDb()
      .select({
        userId: schema.projects.userId,
        projectCount: sql<number>`count(*)::int`,
        sharedCount: sql<number>`coalesce(sum(case when share_enabled then 1 else 0 end), 0)::int`,
      })
      .from(schema.projects)
      .groupBy(schema.projects.userId);
    const map: Record<number, { projectCount: number; sharedCount: number }> = {};
    for (const row of rows) {
      map[row.userId] = { projectCount: row.projectCount, sharedCount: row.sharedCount };
    }
    return map;
  }

  async getAdminUserDetail(userId: number) {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    const stats = (await this.getProjectStatsByUser())[userId] ?? { projectCount: 0, sharedCount: 0 };
    const payments = await this.getPaymentsByUser(userId);
    return { user, stats, payments };
  }

  async getAdminPayments(filters: { status?: string; email?: string; from?: string; to?: string; limit?: number } = {}) {
    const conditions = [];
    if (filters.status && ["pending", "success", "failed"].includes(filters.status)) {
      conditions.push(eq(schema.payments.status, filters.status as "pending" | "success" | "failed"));
    }
    if (filters.email?.trim()) {
      conditions.push(ilike(schema.users.email, `%${filters.email.trim()}%`));
    }
    if (filters.from) {
      conditions.push(gte(schema.payments.createdAt, new Date(filters.from)));
    }
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(schema.payments.createdAt, end));
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;
    return getDb()
      .select({
        id: schema.payments.id,
        userId: schema.payments.userId,
        userName: schema.users.name,
        userEmail: schema.users.email,
        reference: schema.payments.reference,
        amount: schema.payments.amount,
        currency: schema.payments.currency,
        status: schema.payments.status,
        plan: schema.payments.plan,
        refundNote: schema.payments.refundNote,
        createdAt: schema.payments.createdAt,
      })
      .from(schema.payments)
      .innerJoin(schema.users, eq(schema.payments.userId, schema.users.id))
      .where(whereClause)
      .orderBy(desc(schema.payments.createdAt))
      .limit(filters.limit ?? 100);
  }

  async getPaymentsRevenueThisMonth(): Promise<number> {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const [row] = await getDb()
      .select({ sum: sql<number>`coalesce(sum(${schema.payments.amount}), 0)` })
      .from(schema.payments)
      .where(and(
        eq(schema.payments.status, "success"),
        sql`${schema.payments.createdAt} >= ${start.toISOString()}`,
      ));
    return Number(row?.sum ?? 0);
  }

  async setSystemMeta(key: string, value: string): Promise<void> {
    await getDb().execute(sql`
      INSERT INTO system_meta (key, value, updated_at) VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `);
  }

  async getSystemMeta(key: string): Promise<{ value: string; updatedAt: string | null } | null> {
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

  async updateUserAdminNote(id: number, adminNote: string | null): Promise<User | undefined> {
    const [user] = await getDb().update(schema.users).set({ adminNote }).where(eq(schema.users.id, id)).returning();
    return user;
  }

  async getAdminProjects(filters: { search?: string; sharedOnly?: boolean; limit?: number } = {}) {
    const conditions = [];
    if (filters.sharedOnly) conditions.push(eq(schema.projects.shareEnabled, true));
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(sql`(
        ${schema.projects.title} ILIKE ${q}
        OR ${schema.users.name} ILIKE ${q}
        OR ${schema.users.email} ILIKE ${q}
      )`);
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;
    return getDb()
      .select({
        id: schema.projects.id,
        userId: schema.projects.userId,
        userName: schema.users.name,
        userEmail: schema.users.email,
        templateId: schema.projects.templateId,
        templateTitle: schema.templates.title,
        title: schema.projects.title,
        shareEnabled: schema.projects.shareEnabled,
        shareToken: schema.projects.shareToken,
        updatedAt: schema.projects.updatedAt,
        createdAt: schema.projects.createdAt,
      })
      .from(schema.projects)
      .innerJoin(schema.users, eq(schema.projects.userId, schema.users.id))
      .leftJoin(schema.templates, eq(schema.projects.templateId, schema.templates.id))
      .where(whereClause)
      .orderBy(desc(schema.projects.updatedAt))
      .limit(filters.limit ?? 200);
  }

  async getAdminUserProjects(userId: number) {
    return getDb()
      .select({
        id: schema.projects.id,
        title: schema.projects.title,
        templateTitle: schema.templates.title,
        shareEnabled: schema.projects.shareEnabled,
        shareToken: schema.projects.shareToken,
        updatedAt: schema.projects.updatedAt,
        createdAt: schema.projects.createdAt,
      })
      .from(schema.projects)
      .leftJoin(schema.templates, eq(schema.projects.templateId, schema.templates.id))
      .where(eq(schema.projects.userId, userId))
      .orderBy(desc(schema.projects.updatedAt));
  }

  async adminRevokeProjectShare(id: number): Promise<Project | undefined> {
    const [p] = await getDb().update(schema.projects).set({ shareEnabled: false }).where(eq(schema.projects.id, id)).returning();
    return p;
  }

  async getOpsStats() {
    const today = new Date().toISOString().split("T")[0];
    const nearLimitThreshold = Math.max(1, FREE_PROJECT_LIMIT - 1);

    const [atCapRow] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(and(
        eq(schema.users.tier, "free"),
        gte(schema.users.downloadsToday, 3),
        sql`${schema.users.lastDownloadDate} >= ${today}`,
      ));

    const [sharedRow] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.projects)
      .where(eq(schema.projects.shareEnabled, true));

    const nearLimitUsers = await getDb()
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        projectCount: sql<number>`count(${schema.projects.id})::int`,
      })
      .from(schema.users)
      .innerJoin(schema.projects, eq(schema.projects.userId, schema.users.id))
      .where(eq(schema.users.tier, "free"))
      .groupBy(schema.users.id, schema.users.name, schema.users.email)
      .having(sql`count(${schema.projects.id}) >= ${nearLimitThreshold}`)
      .orderBy(sql`count(${schema.projects.id}) DESC`)
      .limit(8);

    return {
      atDownloadCapToday: atCapRow?.count ?? 0,
      sharedLinksCount: sharedRow?.count ?? 0,
      freeProjectLimit: FREE_PROJECT_LIMIT,
      nearProjectLimitUsers: nearLimitUsers,
      exportFormatBreakdown: await this.getExportFormatBreakdown(),
      bulkGenerateSessions30d: await this.getBulkGenerateCount30d(),
    };
  }

  async getExportFormatBreakdown() {
    const rows = await getDb()
      .select({
        format: schema.analyticsEvents.action,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.analyticsEvents)
      .where(and(
        eq(schema.analyticsEvents.eventType, "download"),
        sql`${schema.analyticsEvents.action} IS NOT NULL`,
      ))
      .groupBy(schema.analyticsEvents.action)
      .orderBy(desc(sql`count(*)`));
    return rows.filter((r: { format: string | null; count: number }) => r.format).map((r: { format: string; count: number }) => ({ format: r.format, count: r.count }));
  }

  async getBulkGenerateCount30d() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [row] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.analyticsEvents)
      .where(and(
        eq(schema.analyticsEvents.eventType, "bulk_generate"),
        gte(schema.analyticsEvents.createdAt, cutoff),
      ));
    return row?.count ?? 0;
  }

  async pingDatabase(): Promise<boolean> {
    try {
      await getDb().execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }

  async upsertAnalyticsSession(data: {
    sessionKey: string;
    userId: number;
    userName: string;
    userEmail: string;
    userRole: string;
    userTier: string;
    pagePath?: string;
    referrer?: string;
    utmSource?: string;
    utmCampaign?: string;
    browser?: string;
    os?: string;
    deviceType?: string;
    country?: string | null;
  }) {
    const now = new Date();
    const [existing] = await getDb()
      .select({ id: schema.analyticsSessions.id, startedAt: schema.analyticsSessions.startedAt })
      .from(schema.analyticsSessions)
      .where(and(
        eq(schema.analyticsSessions.sessionKey, data.sessionKey),
        eq(schema.analyticsSessions.userId, data.userId),
      ))
      .limit(1);

    if (existing) {
      await getDb().update(schema.analyticsSessions).set({
        pagePath: data.pagePath ?? null,
        referrer: data.referrer ?? null,
        utmSource: data.utmSource ?? null,
        utmCampaign: data.utmCampaign ?? null,
        browser: data.browser ?? null,
        os: data.os ?? null,
        deviceType: data.deviceType ?? null,
        country: data.country ?? null,
        lastSeenAt: now,
      }).where(eq(schema.analyticsSessions.id, existing.id));
      return existing.id;
    }

    const [row] = await getDb().insert(schema.analyticsSessions).values({
      sessionKey: data.sessionKey,
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
      userRole: data.userRole,
      userTier: data.userTier,
      pagePath: data.pagePath ?? null,
      referrer: data.referrer ?? null,
      utmSource: data.utmSource ?? null,
      utmCampaign: data.utmCampaign ?? null,
      browser: data.browser ?? null,
      os: data.os ?? null,
      deviceType: data.deviceType ?? null,
      country: data.country ?? null,
      startedAt: now,
      lastSeenAt: now,
    }).returning({ id: schema.analyticsSessions.id });
    return row?.id;
  }

  async recordAnalyticsEvent(data: {
    sessionKey?: string;
    userId?: number | null;
    eventType: string;
    pagePath?: string;
    action?: string;
    resourceType?: string;
    resourceId?: number | null;
    meta?: Record<string, unknown>;
    browser?: string;
    os?: string;
    deviceType?: string;
    referrer?: string;
    ipHash?: string | null;
  }) {
    await getDb().insert(schema.analyticsEvents).values({
      sessionKey: data.sessionKey ?? null,
      userId: data.userId ?? null,
      eventType: data.eventType,
      pagePath: data.pagePath?.slice(0, 256) ?? null,
      action: data.action?.slice(0, 128) ?? null,
      resourceType: data.resourceType ?? null,
      resourceId: data.resourceId ?? null,
      meta: data.meta ? JSON.stringify(data.meta) : null,
      browser: data.browser ?? null,
      os: data.os ?? null,
      deviceType: data.deviceType ?? null,
      referrer: data.referrer?.slice(0, 512) ?? null,
      ipHash: data.ipHash ?? null,
    });
  }

  async getActiveSessions(maxAgeMinutes = 5): Promise<AnalyticsSession[]> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    return getDb()
      .select()
      .from(schema.analyticsSessions)
      .where(gte(schema.analyticsSessions.lastSeenAt, cutoff))
      .orderBy(desc(schema.analyticsSessions.lastSeenAt))
      .limit(50);
  }

  async getRecentAnalyticsEvents(limit = 30): Promise<AnalyticsEvent[]> {
    return getDb()
      .select()
      .from(schema.analyticsEvents)
      .orderBy(desc(schema.analyticsEvents.createdAt))
      .limit(limit);
  }

  async purgeOldAnalyticsEvents(retentionDays: number) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    await getDb().delete(schema.analyticsEvents).where(lte(schema.analyticsEvents.createdAt, cutoff));
    await getDb().delete(schema.analyticsSessions).where(lte(schema.analyticsSessions.lastSeenAt, cutoff));
  }

  async purgeOldAuditLogs(retentionDays: number) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    await getDb().delete(schema.adminAuditLog).where(lte(schema.adminAuditLog.createdAt, cutoff));
  }

  async getAnalyticsRetentionSettings() {
    const events = await this.getSystemMeta("analytics_retention_days");
    const audit = await this.getSystemMeta("audit_retention_days");
    return {
      analyticsRetentionDays: events ? parseInt(events.value, 10) || 90 : 90,
      auditRetentionDays: audit ? parseInt(audit.value, 10) || 365 : 365,
    };
  }
}

export const storage = new Storage();
