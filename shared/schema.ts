import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["guest", "user", "admin"] }).notNull().default("user"),
  tier: text("tier", { enum: ["free", "pro"] }).notNull().default("free"),
  theme: text("theme", { enum: ["dark", "light"] }).notNull().default("dark"),
  downloadsToday: integer("downloads_today").notNull().default(0),
  lastDownloadDate: text("last_download_date"),
  resetToken: text("reset_token"),
  resetTokenExpiry: text("reset_token_expiry"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Templates ────────────────────────────────────────────────────────────────
export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category").notNull().default("birthday"),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  previewImage: text("preview_image"),
  canvasJson: text("canvas_json").notNull(),
  thumbnailColor: text("thumbnail_color").notNull().default("#8B5CF6"),
  isPro: integer("is_pro", { mode: "boolean" }).notNull().default(false),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  templateId: integer("template_id"),
  title: text("title").notNull().default("Untitled Card"),
  designJson: text("design_json").notNull(),
  exportSettings: text("export_settings").notNull().default("{}"),
  thumbnail: text("thumbnail"),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// ─── Payments ─────────────────────────────────────────────────────────────────
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  reference: text("reference").notNull().unique(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("NGN"),
  status: text("status", { enum: ["pending", "success", "failed"] }).notNull().default("pending"),
  plan: text("plan").notNull().default("pro_lifetime"),
  paystackData: text("paystack_data"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// ─── Constants ────────────────────────────────────────────────────────────────
export const FREE_DOWNLOAD_LIMIT = 3;
export const PRO_PRICE_KOBO = 1000000;
export const PRO_PRICE_NGN  = 10000;
