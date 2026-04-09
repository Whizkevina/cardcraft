import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type { User, InsertUser, Template, InsertTemplate, Project, InsertProject, Payment, InsertPayment } from "@shared/schema";

const sqlite = new Database("cardcraft.db");
const db = drizzle(sqlite, { schema });

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    tier TEXT NOT NULL DEFAULT 'free',
    theme TEXT NOT NULL DEFAULT 'dark',
    downloads_today INTEGER NOT NULL DEFAULT 0,
    last_download_date TEXT,
    reset_token TEXT,
    reset_token_expiry TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'birthday',
    status TEXT NOT NULL DEFAULT 'draft',
    preview_image TEXT,
    canvas_json TEXT NOT NULL,
    thumbnail_color TEXT NOT NULL DEFAULT '#8B5CF6',
    is_pro INTEGER NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    template_id INTEGER,
    title TEXT NOT NULL DEFAULT 'Untitled Card',
    design_json TEXT NOT NULL,
    export_settings TEXT NOT NULL DEFAULT '{}',
    thumbnail TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reference TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NGN',
    status TEXT NOT NULL DEFAULT 'pending',
    plan TEXT NOT NULL DEFAULT 'pro_lifetime',
    paystack_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Migrate existing tables (add new columns if they don't exist)
  CREATE TEMPORARY TABLE IF NOT EXISTS _migrate_check (dummy INTEGER);
`);

// Safe column migrations for existing databases
try { sqlite.exec("ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN downloads_today INTEGER NOT NULL DEFAULT 0"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN last_download_date TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE templates ADD COLUMN is_pro INTEGER NOT NULL DEFAULT 0"); } catch {}
try { sqlite.exec("ALTER TABLE templates ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'dark'"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN reset_token TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN reset_token_expiry TEXT"); } catch {}

export interface IStorage {
  // Users
  getUser(id: number): User | undefined;
  getUserByEmail(email: string): User | undefined;
  createUser(data: InsertUser): User;
  getAllUsers(): User[];
  updateUserTier(id: number, tier: "free" | "pro"): User | undefined;
  updateUserRole(id: number, role: "user" | "admin"): User | undefined;
  updateUserPassword(id: number, hashedPassword: string): User | undefined;
  updateUserTheme(id: number, theme: "dark" | "light"): User | undefined;
  setResetToken(email: string, token: string, expiry: string): boolean;
  getUserByResetToken(token: string): User | undefined;
  clearResetToken(id: number): void;
  trackDownload(userId: number): { allowed: boolean; downloadsToday: number };
  // Analytics
  getAnalytics(): { totalUsers: number; proUsers: number; totalCards: number; totalRevenue: number; cardsToday: number; signupsToday: number; topTemplates: any[]; recentSignups: any[] };
  // Templates
  getAllTemplates(): Template[];
  getPublishedTemplates(): Template[];
  getTemplate(id: number): Template | undefined;
  createTemplate(data: InsertTemplate): Template;
  updateTemplate(id: number, data: Partial<InsertTemplate>): Template | undefined;
  deleteTemplate(id: number): void;
  // Payments
  createPayment(data: InsertPayment): Payment;
  getPayment(reference: string): Payment | undefined;
  getPaymentsByUser(userId: number): Payment[];
  updatePaymentStatus(reference: string, status: "success" | "failed", paystackData?: string): Payment | undefined;
  // Projects
  getProjectsByUser(userId: number): Project[];
  getProject(id: number): Project | undefined;
  createProject(data: InsertProject): Project;
  updateProject(id: number, data: Partial<InsertProject>): Project | undefined;
  deleteProject(id: number): void;
}

export class Storage implements IStorage {
  getUser(id: number): User | undefined {
    return db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  }
  getUserByEmail(email: string): User | undefined {
    return db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  }
  createUser(data: InsertUser): User {
    return db.insert(schema.users).values(data).returning().get();
  }
  getAllUsers(): User[] {
    return db.select().from(schema.users).orderBy(desc(schema.users.id)).all();
  }
  updateUserTier(id: number, tier: "free" | "pro"): User | undefined {
    return db.update(schema.users).set({ tier }).where(eq(schema.users.id, id)).returning().get();
  }
  updateUserRole(id: number, role: "user" | "admin"): User | undefined {
    return db.update(schema.users).set({ role }).where(eq(schema.users.id, id)).returning().get();
  }
  trackDownload(userId: number): { allowed: boolean; downloadsToday: number } {
    const user = this.getUser(userId);
    if (!user) return { allowed: false, downloadsToday: 0 };
    if (user.tier === "pro") return { allowed: true, downloadsToday: 0 };
    
    const today = new Date().toISOString().split("T")[0];
    const isNewDay = user.lastDownloadDate !== today;
    const currentCount = isNewDay ? 0 : (user.downloadsToday || 0);
    
    const FREE_LIMIT = 3;
    if (currentCount >= FREE_LIMIT) return { allowed: false, downloadsToday: currentCount };
    
    const newCount = currentCount + 1;
    db.update(schema.users).set({
      downloadsToday: newCount,
      lastDownloadDate: today,
    }).where(eq(schema.users.id, userId)).run();
    
    return { allowed: true, downloadsToday: newCount };
  }
  updateUserPassword(id: number, hashedPassword: string): User | undefined {
    return db.update(schema.users).set({ password: hashedPassword }).where(eq(schema.users.id, id)).returning().get();
  }
  updateUserTheme(id: number, theme: "dark" | "light"): User | undefined {
    return db.update(schema.users).set({ theme }).where(eq(schema.users.id, id)).returning().get();
  }
  setResetToken(email: string, token: string, expiry: string): boolean {
    const user = this.getUserByEmail(email);
    if (!user) return false;
    db.update(schema.users).set({ resetToken: token, resetTokenExpiry: expiry }).where(eq(schema.users.id, user.id)).run();
    return true;
  }
  getUserByResetToken(token: string): User | undefined {
    return db.select().from(schema.users).where(eq(schema.users.resetToken, token)).get();
  }
  clearResetToken(id: number): void {
    db.update(schema.users).set({ resetToken: null, resetTokenExpiry: null }).where(eq(schema.users.id, id)).run();
  }
  getAnalytics(): { totalUsers: number; proUsers: number; totalCards: number; totalRevenue: number; cardsToday: number; signupsToday: number; topTemplates: any[]; recentSignups: any[] } {
    const today = new Date().toISOString().split("T")[0];
    const allUsers = db.select().from(schema.users).all();
    const allProjects = db.select().from(schema.projects).all();
    const allPayments = db.select().from(schema.payments).all();
    const allTemplates = db.select().from(schema.templates).all();

    const totalRevenue = allPayments.filter(p => p.status === "success").reduce((sum, p) => sum + (p.amount / 100), 0);
    const cardsToday = allProjects.filter(p => p.createdAt?.startsWith(today)).length;
    const signupsToday = allUsers.filter(u => u.createdAt?.startsWith(today)).length;

    // Top templates by usage
    const usageMap: Record<number, number> = {};
    allProjects.forEach(p => { if (p.templateId) usageMap[p.templateId] = (usageMap[p.templateId] || 0) + 1; });
    const topTemplates = allTemplates
      .map(t => ({ ...t, uses: usageMap[t.id] || 0 }))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 5);

    // Recent signups
    const recentSignups = [...allUsers]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 8)
      .map(u => ({ id: u.id, name: u.name, email: u.email, tier: u.tier, createdAt: u.createdAt }));

    return {
      totalUsers: allUsers.length,
      proUsers: allUsers.filter(u => u.tier === "pro").length,
      totalCards: allProjects.length,
      totalRevenue,
      cardsToday,
      signupsToday,
      topTemplates,
      recentSignups,
    };
  }
  getAllTemplates(): Template[] {
    return db.select().from(schema.templates).orderBy(desc(schema.templates.id)).all();
  }
  getPublishedTemplates(): Template[] {
    return db.select().from(schema.templates).where(eq(schema.templates.status, "published")).orderBy(desc(schema.templates.id)).all();
  }
  getTemplate(id: number): Template | undefined {
    return db.select().from(schema.templates).where(eq(schema.templates.id, id)).get();
  }
  createTemplate(data: InsertTemplate): Template {
    return db.insert(schema.templates).values(data).returning().get();
  }
  updateTemplate(id: number, data: Partial<InsertTemplate>): Template | undefined {
    return db.update(schema.templates).set(data).where(eq(schema.templates.id, id)).returning().get();
  }
  deleteTemplate(id: number): void {
    db.delete(schema.templates).where(eq(schema.templates.id, id)).run();
  }
  // ── Payment methods ──────────────────────────────────────────────────────
  createPayment(data: InsertPayment): Payment {
    return db.insert(schema.payments).values(data).returning().get();
  }
  getPayment(reference: string): Payment | undefined {
    return db.select().from(schema.payments).where(eq(schema.payments.reference, reference)).get();
  }
  getPaymentsByUser(userId: number): Payment[] {
    return db.select().from(schema.payments).where(eq(schema.payments.userId, userId)).orderBy(desc(schema.payments.id)).all();
  }
  updatePaymentStatus(reference: string, status: "success" | "failed", paystackData?: string): Payment | undefined {
    return db.update(schema.payments).set({ status, ...(paystackData && { paystackData }) })
      .where(eq(schema.payments.reference, reference)).returning().get();
  }
  incrementTemplateUsage(templateId: number): void {
    db.update(schema.templates).set({ usageCount: (db.select().from(schema.templates).where(eq(schema.templates.id, templateId)).get()?.usageCount || 0) + 1 }).where(eq(schema.templates.id, templateId)).run();
  }
  duplicateProject(id: number, userId: number): Project | undefined {
    const original = this.getProject(id);
    if (!original || original.userId !== userId) return undefined;
    return this.createProject({
      userId,
      templateId: original.templateId,
      title: original.title + " (Copy)",
      designJson: original.designJson,
      exportSettings: original.exportSettings,
      thumbnail: original.thumbnail,
    });
  }
  renameProject(id: number, userId: number, title: string): Project | undefined {
    const existing = this.getProject(id);
    if (!existing || existing.userId !== userId) return undefined;
    return this.updateProject(id, { title });
  }
  getProjectsByUser(userId: number): Project[] {
    return db.select().from(schema.projects).where(eq(schema.projects.userId, userId)).orderBy(desc(schema.projects.updatedAt)).all();
  }
  getProject(id: number): Project | undefined {
    return db.select().from(schema.projects).where(eq(schema.projects.id, id)).get();
  }
  createProject(data: InsertProject): Project {
    return db.insert(schema.projects).values({ ...data, updatedAt: new Date().toISOString() }).returning().get();
  }
  updateProject(id: number, data: Partial<InsertProject>): Project | undefined {
    return db.update(schema.projects).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.projects.id, id)).returning().get();
  }
  deleteProject(id: number): void {
    db.delete(schema.projects).where(eq(schema.projects.id, id)).run();
  }
}

export const storage = new Storage();

// ─── Template definitions ─────────────────────────────────────────────────────
const TEMPLATES = [
  {
    title: "Royal Elegance",
    category: "birthday",
    thumbnailColor: "#2d0a5e",
    canvas: {
      background: "#1a0533",
      objects: [
        { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "#1a0533", selectable: false, evented: false, customType: "background", locked: true },
        { type: "circle", left: 300, top: 150, radius: 200, fill: "rgba(255,215,0,0.08)", selectable: false, evented: false, locked: true },
        { type: "rect", left: 60, top: 60, width: 680, height: 880, fill: "transparent", stroke: "rgba(255,215,0,0.4)", strokeWidth: 2, rx: 16, ry: 16, selectable: false, evented: false, locked: true },
        { type: "circle", left: 200, top: 200, radius: 180, fill: "rgba(255,255,255,0.06)", stroke: "rgba(255,215,0,0.5)", strokeWidth: 3, selectable: true, customType: "photo_frame", editable: true, movable: true, resizable: true },
        { type: "text", text: "Happy Birthday", left: 400, top: 430, fontSize: 42, fontFamily: "Georgia", fill: "#FFD700", textAlign: "center", originX: "center", customType: "greeting", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "JOHN DOE", left: 400, top: 500, fontSize: 58, fontFamily: "Georgia", fontWeight: "bold", fill: "#FFFFFF", textAlign: "center", originX: "center", customType: "name", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "April 15, 2026", left: 400, top: 590, fontSize: 28, fontFamily: "Georgia", fill: "#FFD700", textAlign: "center", originX: "center", customType: "date", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "Celebrating a Life Well Lived", left: 400, top: 650, fontSize: 20, fontFamily: "Georgia", fontStyle: "italic", fill: "rgba(255,255,255,0.7)", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
        { type: "rect", left: 200, top: 720, width: 400, height: 2, fill: "rgba(255,215,0,0.5)", selectable: false, evented: false, locked: true },
      ]
    }
  },
  {
    title: "Vibrant Celebration",
    category: "birthday",
    thumbnailColor: "#FF6B6B",
    canvas: {
      background: "#FF6B6B",
      objects: [
        { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "#FF6B6B", selectable: false, evented: false, customType: "background", locked: true },
        { type: "rect", left: 0, top: 0, width: 800, height: 380, fill: "#FF8E53", selectable: false, evented: false, locked: true },
        { type: "circle", left: 680, top: -60, radius: 150, fill: "rgba(255,255,255,0.15)", selectable: false, evented: false, locked: true },
        { type: "circle", left: 100, top: 700, radius: 100, fill: "rgba(255,255,255,0.1)", selectable: false, evented: false, locked: true },
        { type: "rect", left: 240, top: 60, width: 320, height: 320, fill: "rgba(255,255,255,0.2)", rx: 160, ry: 160, stroke: "#FFFFFF", strokeWidth: 4, selectable: true, customType: "photo_frame", editable: true, movable: true, resizable: true },
        { type: "text", text: "🎉 Happy Birthday! 🎉", left: 400, top: 420, fontSize: 36, fontFamily: "Arial", fontWeight: "bold", fill: "#FFFFFF", textAlign: "center", originX: "center", customType: "greeting", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "JANE SMITH", left: 400, top: 490, fontSize: 52, fontFamily: "Arial", fontWeight: "bold", fill: "#FFFFFF", textAlign: "center", originX: "center", customType: "name", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "April 15, 2026", left: 400, top: 565, fontSize: 26, fontFamily: "Arial", fill: "rgba(255,255,255,0.9)", textAlign: "center", originX: "center", customType: "date", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "Wishing you joy and blessings", left: 400, top: 620, fontSize: 20, fontFamily: "Arial", fontStyle: "italic", fill: "rgba(255,255,255,0.8)", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
      ]
    }
  },
  {
    title: "Modern Minimal",
    category: "birthday",
    thumbnailColor: "#FAFAF8",
    canvas: {
      background: "#FAFAF8",
      objects: [
        { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "#FAFAF8", selectable: false, evented: false, customType: "background", locked: true },
        { type: "rect", left: 0, top: 0, width: 800, height: 8, fill: "#2D2D2D", selectable: false, evented: false, locked: true },
        { type: "rect", left: 0, top: 992, width: 800, height: 8, fill: "#2D2D2D", selectable: false, evented: false, locked: true },
        { type: "rect", left: 80, top: 80, width: 280, height: 280, fill: "#F0EDE8", stroke: "#2D2D2D", strokeWidth: 2, selectable: true, customType: "photo_frame", editable: true, movable: true, resizable: true },
        { type: "text", text: "Happy Birthday", left: 440, top: 120, fontSize: 38, fontFamily: "Georgia", fontStyle: "italic", fill: "#2D2D2D", customType: "greeting", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "ALEX JOHNSON", left: 440, top: 200, fontSize: 44, fontFamily: "Arial", fontWeight: "bold", fill: "#2D2D2D", customType: "name", editable: true, movable: true, styleEditable: true },
        { type: "rect", left: 440, top: 270, width: 200, height: 3, fill: "#2D2D2D", selectable: false, evented: false, locked: true },
        { type: "text", text: "April 15, 2026", left: 440, top: 300, fontSize: 22, fontFamily: "Georgia", fill: "#666666", customType: "date", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "With warm regards and good wishes", left: 80, top: 420, fontSize: 18, fontFamily: "Georgia", fontStyle: "italic", fill: "#888888", customType: "subtitle", editable: true, movable: true, styleEditable: true },
      ]
    }
  },
  // Phase 2 templates
  {
    title: "Golden Graduation",
    category: "graduation",
    thumbnailColor: "#0a1628",
    canvas: {
      background: "#0a1628",
      objects: [
        { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "#0a1628", selectable: false, evented: false, customType: "background", locked: true },
        { type: "rect", left: 0, top: 0, width: 800, height: 320, fill: "#0d1f3c", selectable: false, evented: false, locked: true },
        { type: "rect", left: 50, top: 50, width: 700, height: 900, fill: "transparent", stroke: "rgba(212,175,55,0.5)", strokeWidth: 2, rx: 4, ry: 4, selectable: false, evented: false, locked: true },
        { type: "rect", left: 60, top: 60, width: 680, height: 880, fill: "transparent", stroke: "rgba(212,175,55,0.2)", strokeWidth: 1, rx: 2, ry: 2, selectable: false, evented: false, locked: true },
        { type: "rect", left: 280, top: 60, width: 240, height: 240, fill: "rgba(212,175,55,0.1)", rx: 120, ry: 120, stroke: "rgba(212,175,55,0.6)", strokeWidth: 3, selectable: true, customType: "photo_frame", editable: true, movable: true, resizable: true },
        { type: "text", text: "🎓 Congratulations!", left: 400, top: 345, fontSize: 36, fontFamily: "Georgia", fontStyle: "italic", fill: "#D4AF37", textAlign: "center", originX: "center", customType: "greeting", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "GRADUATE NAME", left: 400, top: 410, fontSize: 52, fontFamily: "Georgia", fontWeight: "bold", fill: "#FFFFFF", textAlign: "center", originX: "center", customType: "name", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "Class of 2026", left: 400, top: 490, fontSize: 30, fontFamily: "Georgia", fill: "#D4AF37", textAlign: "center", originX: "center", customType: "date", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "Your hard work has paid off. We are so proud of you!", left: 400, top: 560, fontSize: 18, fontFamily: "Georgia", fontStyle: "italic", fill: "rgba(255,255,255,0.7)", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
        { type: "rect", left: 250, top: 620, width: 300, height: 2, fill: "rgba(212,175,55,0.5)", selectable: false, evented: false, locked: true },
        { type: "text", text: "University Name", left: 400, top: 650, fontSize: 22, fontFamily: "Georgia", fill: "rgba(255,255,255,0.5)", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
      ]
    }
  },
  {
    title: "Church Anniversary",
    category: "church",
    thumbnailColor: "#4a1942",
    canvas: {
      background: "#4a1942",
      objects: [
        { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "#4a1942", selectable: false, evented: false, customType: "background", locked: true },
        { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "rgba(255,255,255,0.03)", selectable: false, evented: false, locked: true },
        { type: "circle", left: 350, top: -100, radius: 280, fill: "rgba(255,215,0,0.06)", selectable: false, evented: false, locked: true },
        { type: "rect", left: 70, top: 70, width: 660, height: 860, fill: "transparent", stroke: "rgba(255,215,0,0.35)", strokeWidth: 1.5, rx: 8, ry: 8, selectable: false, evented: false, locked: true },
        { type: "rect", left: 300, top: 80, width: 200, height: 200, fill: "rgba(255,215,0,0.08)", rx: 100, ry: 100, stroke: "rgba(255,215,0,0.5)", strokeWidth: 2, selectable: true, customType: "photo_frame", editable: true, movable: true, resizable: true },
        { type: "text", text: "✝ Anniversary Celebration", left: 400, top: 315, fontSize: 28, fontFamily: "Georgia", fontStyle: "italic", fill: "#FFD700", textAlign: "center", originX: "center", customType: "greeting", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "CHURCH NAME", left: 400, top: 375, fontSize: 50, fontFamily: "Georgia", fontWeight: "bold", fill: "#FFFFFF", textAlign: "center", originX: "center", customType: "name", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "Founded: April 15, 1990", left: 400, top: 450, fontSize: 22, fontFamily: "Georgia", fill: "#FFD700", textAlign: "center", originX: "center", customType: "date", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "36 Years of Faith, Hope & Love", left: 400, top: 500, fontSize: 20, fontFamily: "Georgia", fontStyle: "italic", fill: "rgba(255,255,255,0.75)", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
        { type: "rect", left: 230, top: 560, width: 340, height: 1.5, fill: "rgba(255,215,0,0.4)", selectable: false, evented: false, locked: true },
        { type: "text", text: "Pastor: Rev. John Smith", left: 400, top: 590, fontSize: 18, fontFamily: "Georgia", fill: "rgba(255,255,255,0.55)", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "Sunday, 15 April 2026 · 10:00 AM", left: 400, top: 630, fontSize: 16, fontFamily: "Arial", fill: "rgba(255,215,0,0.7)", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
      ]
    }
  },
  {
    title: "Corporate Milestone",
    category: "corporate",
    thumbnailColor: "#0f2744",
    canvas: {
      background: "#FFFFFF",
      objects: [
        { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "#FFFFFF", selectable: false, evented: false, customType: "background", locked: true },
        { type: "rect", left: 0, top: 0, width: 800, height: 260, fill: "#0f2744", selectable: false, evented: false, locked: true },
        { type: "rect", left: 0, top: 260, width: 800, height: 6, fill: "#C9A84C", selectable: false, evented: false, locked: true },
        { type: "rect", left: 0, top: 960, width: 800, height: 40, fill: "#0f2744", selectable: false, evented: false, locked: true },
        { type: "rect", left: 260, top: 120, width: 280, height: 280, fill: "rgba(255,255,255,0.15)", rx: 8, ry: 8, stroke: "#C9A84C", strokeWidth: 2, selectable: true, customType: "photo_frame", editable: true, movable: true, resizable: true },
        { type: "text", text: "Employee of the Month", left: 400, top: 430, fontSize: 28, fontFamily: "Georgia", fontStyle: "italic", fill: "#C9A84C", textAlign: "center", originX: "center", customType: "greeting", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "EMPLOYEE NAME", left: 400, top: 490, fontSize: 52, fontFamily: "Arial", fontWeight: "bold", fill: "#0f2744", textAlign: "center", originX: "center", customType: "name", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "Department · April 2026", left: 400, top: 570, fontSize: 22, fontFamily: "Arial", fill: "#555555", textAlign: "center", originX: "center", customType: "date", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "In recognition of outstanding performance and dedication.", left: 400, top: 625, fontSize: 18, fontFamily: "Georgia", fontStyle: "italic", fill: "#777777", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
        { type: "rect", left: 200, top: 700, width: 400, height: 1.5, fill: "#0f2744", selectable: false, evented: false, locked: true },
        { type: "text", text: "Company Name", left: 400, top: 730, fontSize: 20, fontFamily: "Arial", fontWeight: "bold", fill: "#0f2744", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "Signed: CEO / Manager", left: 400, top: 760, fontSize: 14, fontFamily: "Georgia", fontStyle: "italic", fill: "#999999", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
      ]
    }
  },
  // ICT Group Style — exact replica of the reference image
  {
    title: "Warm Celebration",
    category: "birthday",
    thumbnailColor: "#5c1a00",
    canvas: {
      // Square 1:1 card (800x800) — social media optimised
      canvasWidth: 800,
      canvasHeight: 800,
      background: "#3d0e00",
      objects: [
        // Layer 1: Base background — deep dark maroon
        {
          type: "rect", left: 0, top: 0, width: 800, height: 800,
          fill: "#2a0800",
          selectable: false, evented: false, customType: "background", locked: true
        },
        // Layer 2: Warm orange radial glow — left-center, creates the cinematic warmth
        {
          type: "circle", left: -80, top: 100, radius: 380,
          fill: "rgba(180,60,0,0.55)",
          selectable: false, evented: false, locked: true
        },
        // Layer 3: Lighter warm highlight top-left
        {
          type: "circle", left: 0, top: -60, radius: 250,
          fill: "rgba(220,100,0,0.30)",
          selectable: false, evented: false, locked: true
        },
        // Layer 4: Subtle right-side dark vignette circle
        {
          type: "circle", left: 550, top: 100, radius: 350,
          fill: "rgba(20,0,0,0.35)",
          selectable: false, evented: false, locked: true
        },
        // Layer 5: Photo frame — large rounded rect with warm amber bg (upload photo here)
        {
          type: "rect", left: 175, top: 65, width: 450, height: 450,
          fill: "#c87820",
          rx: 24, ry: 24,
          stroke: "rgba(255,200,80,0.5)", strokeWidth: 3,
          selectable: true, customType: "photo_frame", editable: true, movable: true, resizable: true
        },
        // Layer 6: Vertical gold accent bar — left of photo frame
        {
          type: "rect", left: 152, top: 200, width: 20, height: 310,
          fill: "rgba(220,150,40,0.80)",
          rx: 4, ry: 4,
          selectable: false, evented: false, locked: true
        },
        // Layer 7: Logo circle top-left
        {
          type: "circle", left: 30, top: 25, radius: 60,
          fill: "#FFFFFF",
          stroke: "rgba(255,255,255,0.8)", strokeWidth: 2,
          selectable: true, customType: "logo", editable: true, movable: true, resizable: true
        },
        // Layer 8: Logo text inside circle
        {
          type: "text", text: "LOGO",
          left: 90, top: 68,
          fontSize: 14, fontFamily: "Arial", fontWeight: "bold", fill: "#8B2500",
          textAlign: "center", originX: "center",
          selectable: true, customType: "logo_text", editable: true, movable: true, styleEditable: true
        },
        // Layer 9: Date pill — top right, dark semi-transparent rounded rect
        {
          type: "rect", left: 575, top: 28, width: 200, height: 52,
          fill: "rgba(30,15,8,0.80)",
          rx: 14, ry: 14,
          selectable: true, customType: "date_bg", editable: true, movable: true
        },
        // Layer 10: Date text on pill
        {
          type: "text", text: "April 8th",
          left: 675, top: 55,
          fontSize: 26, fontFamily: "Arial", fontWeight: "bold", fill: "#FFFFFF",
          textAlign: "center", originX: "center",
          selectable: true, customType: "date", editable: true, movable: true, styleEditable: true
        },
        // Layer 11: "Happy Birthday" — large bold italic, orange
        {
          type: "text", text: "Happy Birthday",
          left: 400, top: 548,
          fontSize: 74, fontFamily: "Georgia", fontWeight: "bold", fontStyle: "italic",
          fill: "#f09820",
          textAlign: "center", originX: "center",
          selectable: true, customType: "greeting", editable: true, movable: true, styleEditable: true
        },
        // Layer 12: "Brother" — script/italic white
        {
          type: "text", text: "Brother",
          left: 400, top: 640,
          fontSize: 36, fontFamily: "Georgia", fontStyle: "italic", fill: "#FFFFFF",
          textAlign: "center", originX: "center",
          selectable: true, customType: "subtitle", editable: true, movable: true, styleEditable: true
        },
        // Layer 13: Name — large bold white
        {
          type: "text", text: "John Doe",
          left: 400, top: 700,
          fontSize: 50, fontFamily: "Arial", fontWeight: "bold", fill: "#FFFFFF",
          textAlign: "center", originX: "center",
          selectable: true, customType: "name", editable: true, movable: true, styleEditable: true
        },
      ]
    }
  },
  {
    title: "Floral Birthday",
    category: "birthday",
    thumbnailColor: "#7b3f6e",
    canvas: {
      background: "#fdf6f0",
      objects: [
        { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: "#fdf6f0", selectable: false, evented: false, customType: "background", locked: true },
        { type: "rect", left: 0, top: 0, width: 800, height: 420, fill: "#7b3f6e", selectable: false, evented: false, locked: true },
        { type: "circle", left: -80, top: -80, radius: 200, fill: "rgba(255,182,193,0.25)", selectable: false, evented: false, locked: true },
        { type: "circle", left: 680, top: 300, radius: 150, fill: "rgba(255,182,193,0.2)", selectable: false, evented: false, locked: true },
        { type: "circle", left: 280, top: 90, radius: 200, fill: "rgba(255,255,255,0.12)", stroke: "rgba(255,182,193,0.5)", strokeWidth: 3, selectable: true, customType: "photo_frame", editable: true, movable: true, resizable: true },
        { type: "text", text: "Happy Birthday,", left: 400, top: 440, fontSize: 34, fontFamily: "Georgia", fontStyle: "italic", fill: "#7b3f6e", textAlign: "center", originX: "center", customType: "greeting", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "BEAUTIFUL NAME", left: 400, top: 500, fontSize: 50, fontFamily: "Georgia", fontWeight: "bold", fill: "#7b3f6e", textAlign: "center", originX: "center", customType: "name", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "April 15, 2026", left: 400, top: 580, fontSize: 24, fontFamily: "Georgia", fill: "#c67ab0", textAlign: "center", originX: "center", customType: "date", editable: true, movable: true, styleEditable: true },
        { type: "text", text: "May your day be as beautiful as you are", left: 400, top: 630, fontSize: 19, fontFamily: "Georgia", fontStyle: "italic", fill: "#a06090", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
        { type: "rect", left: 220, top: 690, width: 360, height: 1.5, fill: "#c67ab0", selectable: false, evented: false, locked: true },
        { type: "text", text: "🌸 With love 🌸", left: 400, top: 720, fontSize: 22, fontFamily: "Georgia", fill: "#c67ab0", textAlign: "center", originX: "center", customType: "subtitle", editable: true, movable: true, styleEditable: true },
      ]
    }
  },

  // ── Phase 4 Templates ──────────────────────────────────────────────────────

  // Eid Mubarak
  { title: "Eid Mubarak", category: "eid", thumbnailColor: "#0d4a2e",
    canvas: { background: "#0d4a2e", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#0d4a2e", selectable:false, evented:false, customType:"background", locked:true },
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"rgba(212,175,55,0.04)", selectable:false, evented:false, locked:true },
      { type:"circle", left:350, top:-80, radius:280, fill:"rgba(212,175,55,0.07)", selectable:false, evented:false, locked:true },
      { type:"rect", left:60, top:60, width:680, height:880, fill:"transparent", stroke:"rgba(212,175,55,0.45)", strokeWidth:1.5, rx:8, ry:8, selectable:false, evented:false, locked:true },
      { type:"circle", left:280, top:80, radius:200, fill:"rgba(255,255,255,0.06)", stroke:"rgba(212,175,55,0.5)", strokeWidth:2.5, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"☪ Eid Mubarak ☪", left:400, top:325, fontSize:44, fontFamily:"Georgia", fontStyle:"italic", fill:"#D4AF37", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"JOHN DOE", left:400, top:400, fontSize:54, fontFamily:"Georgia", fontWeight:"bold", fill:"#FFFFFF", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"May Allah bless you and your family", left:400, top:480, fontSize:20, fontFamily:"Georgia", fontStyle:"italic", fill:"rgba(255,255,255,0.75)", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"Eid Al-Fitr 2026", left:400, top:530, fontSize:24, fontFamily:"Georgia", fill:"#D4AF37", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
    ]}
  },

  // Wedding Anniversary
  { title: "Wedding Anniversary", category: "anniversary", thumbnailColor: "#6b0f2b",
    canvas: { background: "#6b0f2b", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#6b0f2b", selectable:false, evented:false, customType:"background", locked:true },
      { type:"circle", left:-100, top:-100, radius:300, fill:"rgba(255,182,193,0.15)", selectable:false, evented:false, locked:true },
      { type:"circle", left:700, top:800, radius:250, fill:"rgba(255,182,193,0.1)", selectable:false, evented:false, locked:true },
      { type:"rect", left:60, top:60, width:680, height:880, fill:"transparent", stroke:"rgba(255,182,193,0.35)", strokeWidth:1.5, rx:12, ry:12, selectable:false, evented:false, locked:true },
      { type:"rect", left:200, top:80, width:180, height:230, fill:"rgba(255,255,255,0.08)", rx:90, ry:90, stroke:"rgba(255,182,193,0.5)", strokeWidth:2, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"rect", left:420, top:80, width:180, height:230, fill:"rgba(255,255,255,0.08)", rx:90, ry:90, stroke:"rgba(255,182,193,0.5)", strokeWidth:2, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"♥ Happy Anniversary ♥", left:400, top:350, fontSize:36, fontFamily:"Georgia", fontStyle:"italic", fill:"#FFB6C1", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"JOHN & JANE DOE", left:400, top:415, fontSize:46, fontFamily:"Georgia", fontWeight:"bold", fill:"#FFFFFF", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"April 15, 2026", left:400, top:490, fontSize:26, fontFamily:"Georgia", fill:"#FFB6C1", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"Years of love, laughter and memories", left:400, top:545, fontSize:18, fontFamily:"Georgia", fontStyle:"italic", fill:"rgba(255,255,255,0.65)", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
    ]}
  },

  // Baby Dedication
  { title: "Baby Dedication", category: "celebration", thumbnailColor: "#1a4a7a",
    canvas: { background: "#EFF6FF", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#EFF6FF", selectable:false, evented:false, customType:"background", locked:true },
      { type:"rect", left:0, top:0, width:800, height:380, fill:"#1a4a7a", selectable:false, evented:false, locked:true },
      { type:"circle", left:550, top:-80, radius:200, fill:"rgba(255,255,255,0.08)", selectable:false, evented:false, locked:true },
      { type:"rect", left:270, top:60, width:260, height:290, fill:"rgba(255,255,255,0.15)", rx:130, ry:130, stroke:"rgba(255,255,255,0.6)", strokeWidth:3, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"Baby Dedication", left:400, top:410, fontSize:44, fontFamily:"Georgia", fontStyle:"italic", fill:"#1a4a7a", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"BABY'S NAME", left:400, top:475, fontSize:52, fontFamily:"Georgia", fontWeight:"bold", fill:"#1a4a7a", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"Date of Birth · April 15, 2026", left:400, top:550, fontSize:22, fontFamily:"Georgia", fill:"#4a7aaa", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"Train up a child in the way he should go", left:400, top:600, fontSize:18, fontFamily:"Georgia", fontStyle:"italic", fill:"#6a8aaa", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"Parents: Mr & Mrs John Doe", left:400, top:640, fontSize:18, fontFamily:"Georgia", fill:"#4a7aaa", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
    ]}
  },

  // Naming Ceremony
  { title: "Naming Ceremony", category: "celebration", thumbnailColor: "#7a3a00",
    canvas: { background: "#FFF8F0", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#FFF8F0", selectable:false, evented:false, customType:"background", locked:true },
      { type:"rect", left:0, top:0, width:800, height:8, fill:"#7a3a00", selectable:false, evented:false, locked:true },
      { type:"rect", left:0, top:992, width:800, height:8, fill:"#7a3a00", selectable:false, evented:false, locked:true },
      { type:"rect", left:0, top:0, width:8, height:1000, fill:"#7a3a00", selectable:false, evented:false, locked:true },
      { type:"rect", left:792, top:0, width:8, height:1000, fill:"#7a3a00", selectable:false, evented:false, locked:true },
      { type:"rect", left:270, top:60, width:260, height:280, fill:"#FFE4C4", rx:8, ry:8, stroke:"#7a3a00", strokeWidth:2, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"Naming Ceremony", left:400, top:385, fontSize:40, fontFamily:"Georgia", fontStyle:"italic", fill:"#7a3a00", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"BABY JOHN DOE", left:400, top:450, fontSize:52, fontFamily:"Georgia", fontWeight:"bold", fill:"#7a3a00", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"rect", left:200, top:525, width:400, height:2, fill:"rgba(122,58,0,0.3)", selectable:false, evented:false, locked:true },
      { type:"text", text:"April 15, 2026", left:400, top:545, fontSize:24, fontFamily:"Georgia", fill:"#a05020", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"Join us as we name and celebrate our bundle of joy", left:400, top:595, fontSize:19, fontFamily:"Georgia", fontStyle:"italic", fill:"#a05020", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
    ]}
  },

  // Retirement
  { title: "Retirement", category: "corporate", thumbnailColor: "#1c3a5c",
    canvas: { background: "#1c3a5c", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#1c3a5c", selectable:false, evented:false, customType:"background", locked:true },
      { type:"rect", left:0, top:0, width:800, height:6, fill:"#C9A84C", selectable:false, evented:false, locked:true },
      { type:"rect", left:0, top:994, width:800, height:6, fill:"#C9A84C", selectable:false, evented:false, locked:true },
      { type:"rect", left:60, top:60, width:680, height:880, fill:"transparent", stroke:"rgba(201,168,76,0.3)", strokeWidth:1, rx:4, ry:4, selectable:false, evented:false, locked:true },
      { type:"rect", left:280, top:80, width:240, height:250, fill:"rgba(201,168,76,0.1)", rx:8, ry:8, stroke:"rgba(201,168,76,0.5)", strokeWidth:2, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"Happy Retirement", left:400, top:375, fontSize:44, fontFamily:"Georgia", fontStyle:"italic", fill:"#C9A84C", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"JOHN DOE", left:400, top:445, fontSize:58, fontFamily:"Georgia", fontWeight:"bold", fill:"#FFFFFF", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"After 35 Years of Outstanding Service", left:400, top:525, fontSize:22, fontFamily:"Georgia", fill:"#C9A84C", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"April 15, 2026", left:400, top:575, fontSize:24, fontFamily:"Georgia", fill:"rgba(255,255,255,0.7)", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"We celebrate your dedication and legacy.", left:400, top:625, fontSize:18, fontFamily:"Georgia", fontStyle:"italic", fill:"rgba(255,255,255,0.55)", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
    ]}
  },

  // Sports Achievement
  { title: "Sports Achievement", category: "achievement", thumbnailColor: "#1a1a2e",
    canvas: { background: "#1a1a2e", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#1a1a2e", selectable:false, evented:false, customType:"background", locked:true },
      { type:"rect", left:0, top:0, width:800, height:300, fill:"#e8b800", selectable:false, evented:false, locked:true },
      { type:"circle", left:700, top:-60, radius:180, fill:"rgba(255,255,255,0.1)", selectable:false, evented:false, locked:true },
      { type:"rect", left:280, top:40, width:240, height:240, fill:"rgba(255,255,255,0.15)", rx:120, ry:120, stroke:"#FFFFFF", strokeWidth:4, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"🏆 Champion", left:400, top:340, fontSize:40, fontFamily:"Arial", fontWeight:"bold", fill:"#e8b800", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"JOHN DOE", left:400, top:405, fontSize:60, fontFamily:"Arial", fontWeight:"bold", fill:"#FFFFFF", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"April 15, 2026", left:400, top:488, fontSize:24, fontFamily:"Arial", fill:"#e8b800", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"Outstanding Performance · Team Name", left:400, top:535, fontSize:20, fontFamily:"Arial", fill:"rgba(255,255,255,0.65)", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
    ]}
  },

  // Valentine
  { title: "Valentine's Day", category: "celebration", thumbnailColor: "#8b0000",
    canvas: { background: "#1a0000", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#1a0000", selectable:false, evented:false, customType:"background", locked:true },
      { type:"circle", left:-50, top:-50, radius:250, fill:"rgba(139,0,0,0.5)", selectable:false, evented:false, locked:true },
      { type:"circle", left:650, top:750, radius:200, fill:"rgba(139,0,0,0.4)", selectable:false, evented:false, locked:true },
      { type:"rect", left:280, top:80, width:240, height:260, fill:"rgba(255,255,255,0.06)", rx:120, ry:120, stroke:"rgba(255,100,100,0.5)", strokeWidth:3, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"❤ Happy Valentine's Day ❤", left:400, top:390, fontSize:34, fontFamily:"Georgia", fontStyle:"italic", fill:"#FF6B6B", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"JOHN DOE", left:400, top:455, fontSize:58, fontFamily:"Georgia", fontWeight:"bold", fill:"#FFFFFF", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"February 14, 2026", left:400, top:535, fontSize:24, fontFamily:"Georgia", fill:"#FF6B6B", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"You make every day worth living", left:400, top:585, fontSize:20, fontFamily:"Georgia", fontStyle:"italic", fill:"rgba(255,255,255,0.6)", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
    ]}
  },

  // Mother's Day
  { title: "Mother's Day", category: "celebration", thumbnailColor: "#7a2060",
    canvas: { background: "#FDF0F8", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#FDF0F8", selectable:false, evented:false, customType:"background", locked:true },
      { type:"rect", left:0, top:0, width:800, height:400, fill:"#7a2060", selectable:false, evented:false, locked:true },
      { type:"circle", left:-60, top:-60, radius:180, fill:"rgba(255,255,255,0.1)", selectable:false, evented:false, locked:true },
      { type:"rect", left:280, top:60, width:240, height:280, fill:"rgba(255,255,255,0.12)", rx:120, ry:120, stroke:"rgba(255,182,193,0.6)", strokeWidth:3, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"Happy Mother's Day", left:400, top:430, fontSize:40, fontFamily:"Georgia", fontStyle:"italic", fill:"#7a2060", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"JANE DOE", left:400, top:495, fontSize:56, fontFamily:"Georgia", fontWeight:"bold", fill:"#7a2060", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"May 10, 2026", left:400, top:572, fontSize:24, fontFamily:"Georgia", fill:"#a04080", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"A mother's love is forever", left:400, top:620, fontSize:20, fontFamily:"Georgia", fontStyle:"italic", fill:"#a04080", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"🌸 With love from your family 🌸", left:400, top:665, fontSize:18, fontFamily:"Georgia", fill:"#c06090", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
    ]}
  },

  // Father's Day
  { title: "Father's Day", category: "celebration", thumbnailColor: "#0a2a4a",
    canvas: { background: "#0a2a4a", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#0a2a4a", selectable:false, evented:false, customType:"background", locked:true },
      { type:"rect", left:0, top:0, width:800, height:6, fill:"#C9A84C", selectable:false, evented:false, locked:true },
      { type:"rect", left:60, top:60, width:680, height:880, fill:"transparent", stroke:"rgba(201,168,76,0.25)", strokeWidth:1, rx:6, ry:6, selectable:false, evented:false, locked:true },
      { type:"rect", left:280, top:80, width:240, height:260, fill:"rgba(201,168,76,0.1)", rx:8, ry:8, stroke:"rgba(201,168,76,0.45)", strokeWidth:2, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"Happy Father's Day", left:400, top:390, fontSize:42, fontFamily:"Georgia", fontStyle:"italic", fill:"#C9A84C", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"JOHN DOE", left:400, top:455, fontSize:60, fontFamily:"Georgia", fontWeight:"bold", fill:"#FFFFFF", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"June 21, 2026", left:400, top:535, fontSize:26, fontFamily:"Georgia", fill:"#C9A84C", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"The greatest hero in our lives", left:400, top:585, fontSize:20, fontFamily:"Georgia", fontStyle:"italic", fill:"rgba(255,255,255,0.6)", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
    ]}
  },

  // New Year
  { title: "Happy New Year", category: "celebration", thumbnailColor: "#0a0a1a",
    canvas: { background: "#0a0a1a", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#0a0a1a", selectable:false, evented:false, customType:"background", locked:true },
      { type:"circle", left:350, top:100, radius:350, fill:"rgba(255,215,0,0.05)", selectable:false, evented:false, locked:true },
      { type:"circle", left:0, top:800, radius:250, fill:"rgba(100,100,255,0.08)", selectable:false, evented:false, locked:true },
      { type:"text", text:"🎆 Happy New Year 🎆", left:400, top:120, fontSize:42, fontFamily:"Georgia", fontStyle:"italic", fill:"#FFD700", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"2026", left:400, top:200, fontSize:120, fontFamily:"Georgia", fontWeight:"bold", fill:"rgba(255,215,0,0.15)", textAlign:"center", originX:"center", selectable:false, evented:false, locked:true },
      { type:"rect", left:280, top:230, width:240, height:260, fill:"rgba(255,215,0,0.08)", rx:120, ry:120, stroke:"rgba(255,215,0,0.4)", strokeWidth:2, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"JOHN DOE", left:400, top:525, fontSize:56, fontFamily:"Georgia", fontWeight:"bold", fill:"#FFFFFF", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"Wishing you joy, peace and prosperity", left:400, top:605, fontSize:20, fontFamily:"Georgia", fontStyle:"italic", fill:"rgba(255,215,0,0.75)", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"January 1, 2026", left:400, top:650, fontSize:22, fontFamily:"Georgia", fill:"rgba(255,255,255,0.5)", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
    ]}
  },

  // Christmas
  { title: "Merry Christmas", category: "celebration", thumbnailColor: "#0d3b1e",
    canvas: { background: "#0d3b1e", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#0d3b1e", selectable:false, evented:false, customType:"background", locked:true },
      { type:"circle", left:350, top:-100, radius:300, fill:"rgba(255,255,255,0.04)", selectable:false, evented:false, locked:true },
      { type:"rect", left:60, top:60, width:680, height:880, fill:"transparent", stroke:"rgba(255,0,0,0.3)", strokeWidth:1.5, rx:8, ry:8, selectable:false, evented:false, locked:true },
      { type:"rect", left:280, top:80, width:240, height:260, fill:"rgba(255,255,255,0.07)", rx:120, ry:120, stroke:"rgba(255,255,255,0.4)", strokeWidth:2.5, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"🎄 Merry Christmas 🎄", left:400, top:390, fontSize:38, fontFamily:"Georgia", fontStyle:"italic", fill:"#FF4444", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"JOHN DOE", left:400, top:455, fontSize:58, fontFamily:"Georgia", fontWeight:"bold", fill:"#FFFFFF", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"December 25, 2026", left:400, top:535, fontSize:24, fontFamily:"Georgia", fill:"#FF8888", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"May this season bring you joy and blessings", left:400, top:585, fontSize:19, fontFamily:"Georgia", fontStyle:"italic", fill:"rgba(255,255,255,0.6)", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
    ]}
  },

  // Job Promotion
  { title: "Congratulations / Promotion", category: "achievement", thumbnailColor: "#1a2a1a",
    canvas: { background: "#FFFFFF", objects: [
      { type:"rect", left:0, top:0, width:800, height:1000, fill:"#FFFFFF", selectable:false, evented:false, customType:"background", locked:true },
      { type:"rect", left:0, top:0, width:800, height:280, fill:"#1a2a1a", selectable:false, evented:false, locked:true },
      { type:"rect", left:0, top:280, width:800, height:5, fill:"#4CAF50", selectable:false, evented:false, locked:true },
      { type:"circle", left:600, top:-60, radius:180, fill:"rgba(76,175,80,0.1)", selectable:false, evented:false, locked:true },
      { type:"rect", left:270, top:55, width:260, height:260, fill:"rgba(76,175,80,0.1)", rx:130, ry:130, stroke:"rgba(255,255,255,0.5)", strokeWidth:3, selectable:true, customType:"photo_frame", editable:true, movable:true, resizable:true },
      { type:"text", text:"🎉 Congratulations!", left:400, top:340, fontSize:40, fontFamily:"Georgia", fontStyle:"italic", fill:"#2e7d32", textAlign:"center", originX:"center", customType:"greeting", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"JOHN DOE", left:400, top:405, fontSize:56, fontFamily:"Arial", fontWeight:"bold", fill:"#1a2a1a", textAlign:"center", originX:"center", customType:"name", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"On Your New Role as Director", left:400, top:480, fontSize:24, fontFamily:"Georgia", fill:"#4CAF50", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"April 15, 2026", left:400, top:530, fontSize:22, fontFamily:"Georgia", fill:"#888888", textAlign:"center", originX:"center", customType:"date", editable:true, movable:true, styleEditable:true },
      { type:"text", text:"Your hard work and dedication have paid off.", left:400, top:580, fontSize:18, fontFamily:"Georgia", fontStyle:"italic", fill:"#666666", textAlign:"center", originX:"center", customType:"subtitle", editable:true, movable:true, styleEditable:true },
    ]}
  },
];

function seedTemplates() {
  const existing = storage.getAllTemplates();
  if (existing.length >= TEMPLATES.length) return;

  // Delete old seeded templates and re-seed (for phase upgrades)
  const existingIds = existing.map(t => t.id);
  existingIds.forEach(id => storage.deleteTemplate(id));

  TEMPLATES.forEach(t => {
    storage.createTemplate({
      title: t.title,
      category: t.category,
      status: "published",
      canvasJson: JSON.stringify(t.canvas),
      thumbnailColor: t.thumbnailColor,
    });
  });
}

seedTemplates();
