import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { User, InsertUser, Template, InsertTemplate, Project, InsertProject, Payment, InsertPayment } from "@shared/schema";

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
  await qc`CREATE TABLE IF NOT EXISTS projects (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, template_id INTEGER, title TEXT DEFAULT 'Untitled Card', design_json TEXT NOT NULL, export_settings TEXT DEFAULT '{}', thumbnail TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
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
  await qc`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`;
  await qc`CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)`;
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
  async updateUserTier(id: number, tier: "free" | "pro"): Promise<User | undefined> {
    const [user] = await getDb().update(schema.users).set({ tier }).where(eq(schema.users.id, id)).returning();
    return user;
  }
  async updateUserRole(id: number, role: "user" | "admin"): Promise<User | undefined> {
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
    if (allowed) await getDb().update(schema.users).set({ downloadsToday, lastDownloadDate: new Date().toISOString() }).where(eq(schema.users.id, userId));
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
  async getProjectsByUser(userId: number): Promise<Project[]> { return getDb().select().from(schema.projects).where(eq(schema.projects.userId, userId)).orderBy(desc(schema.projects.updatedAt)); }
  async createProject(data: InsertProject): Promise<Project> { const [p] = await getDb().insert(schema.projects).values(data).returning(); return p; }
  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> { const [p] = await getDb().update(schema.projects).set(data).where(eq(schema.projects.id, id)).returning(); return p; }
  async deleteProject(id: number): Promise<void> { await getDb().delete(schema.projects).where(eq(schema.projects.id, id)); }
  async duplicateProject(id: number, userId: number): Promise<Project | undefined> { const existing = await this.getProject(id); if (!existing) return undefined; const [d] = await getDb().insert(schema.projects).values({ userId, templateId: existing.templateId, title: `${existing.title} (Copy)`, designJson: existing.designJson, exportSettings: existing.exportSettings, thumbnail: existing.thumbnail }).returning(); return d; }
  async renameProject(id: number, userId: number, title: string): Promise<Project | undefined> { const existing = await this.getProject(id); if (!existing || existing.userId !== userId) return undefined; const [p] = await getDb().update(schema.projects).set({ title }).where(eq(schema.projects.id, id)).returning(); return p; }
  async getPayment(reference: string): Promise<Payment | undefined> { const [p] = await getDb().select().from(schema.payments).where(eq(schema.payments.reference, reference)).limit(1); return p; }
  async getPaymentsByUser(userId: number): Promise<Payment[]> { return getDb().select().from(schema.payments).where(eq(schema.payments.userId, userId)).orderBy(desc(schema.payments.createdAt)); }
  async createPayment(data: InsertPayment): Promise<Payment> { const [p] = await getDb().insert(schema.payments).values(data).returning(); return p; }
  async updatePaymentStatus(reference: string, status: "success" | "failed"): Promise<Payment | undefined> { const [p] = await getDb().update(schema.payments).set({ status }).where(eq(schema.payments.reference, reference)).returning(); return p; }
}

export const storage = new Storage();
