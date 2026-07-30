import { eq, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { User, InsertUser } from "@shared/schema";
import { getDb, getPgPool } from "./db";
import { logAuditEvent } from "./auditLog";

export async function getUser(id: number): Promise<User | undefined> {
  const [user] = await getDb().select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return user;
}
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await getDb().select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return user;
}
export async function createUser(data: InsertUser): Promise<User> {
  const [user] = await getDb().insert(schema.users).values(data).returning();
  return user;
}
export async function getAllUsers(): Promise<User[]> {
  return getDb().select().from(schema.users);
}
export async function updateUserTier(id: number, tier: "free" | "pro", proExpiresAt?: Date | null): Promise<User | undefined> {
  const patch: Partial<User> = { tier };
  if (tier === "free") patch.proExpiresAt = null;
  else if (proExpiresAt !== undefined) patch.proExpiresAt = proExpiresAt;
  const [user] = await getDb().update(schema.users).set(patch).where(eq(schema.users.id, id)).returning();
  return user;
}
export async function updateUserRole(id: number, role: "user" | "admin" | "support" | "content"): Promise<User | undefined> {
  const [user] = await getDb().update(schema.users).set({ role: role as any }).where(eq(schema.users.id, id)).returning();
  return user;
}
export async function updateUserPassword(id: number, hashedPassword: string): Promise<User | undefined> {
  const [user] = await getDb().update(schema.users).set({ password: hashedPassword }).where(eq(schema.users.id, id)).returning();
  return user;
}
export async function updateUserTheme(id: number, theme: "dark" | "light"): Promise<User | undefined> {
  const [user] = await getDb().update(schema.users).set({ theme }).where(eq(schema.users.id, id)).returning();
  return user;
}
export async function setResetToken(email: string, token: string, expiry: string): Promise<boolean> {
  await getDb().update(schema.users).set({ resetToken: token, resetTokenExpiry: expiry }).where(eq(schema.users.email, email));
  return true;
}
export async function getUserByResetToken(token: string): Promise<User | undefined> {
  const [user] = await getDb().select().from(schema.users).where(eq(schema.users.resetToken, token)).limit(1);
  return user;
}
export async function clearResetToken(id: number): Promise<void> {
  await getDb().update(schema.users).set({ resetToken: null, resetTokenExpiry: null }).where(eq(schema.users.id, id));
}
export async function trackDownload(userId: number): Promise<{ allowed: boolean; downloadsToday: number }> {
  const user = await getUser(userId);
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
export async function touchLastLogin(userId: number): Promise<void> {
  await getDb().update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId));
}
export async function updateUserStatus(id: number, status: "active" | "suspended"): Promise<User | undefined> {
  const [user] = await getDb().update(schema.users).set({ status }).where(eq(schema.users.id, id)).returning();
  return user;
}
export async function updateUserAuthProvider(id: number, authProvider: "email" | "google"): Promise<void> {
  await getDb().update(schema.users).set({ authProvider }).where(eq(schema.users.id, id));
}
export async function enforceProExpiry(user: User): Promise<User> {
  if (user.tier !== "pro" || !user.proExpiresAt) return user;
  if (new Date(user.proExpiresAt) > new Date()) return user;
  const [updated] = await getDb().update(schema.users).set({ tier: "free", proExpiresAt: null }).where(eq(schema.users.id, user.id)).returning();
  return updated ?? user;
}
export async function destroyUserSessions(userId: number): Promise<number> {
  const pool = getPgPool();
  const result = await pool.query(`DELETE FROM session WHERE sess->>'userId' = $1`, [String(userId)]);
  return result.rowCount ?? 0;
}

/** Permanently delete a user and their projects, payments, sessions, and analytics rows. */
export async function deleteUser(id: number): Promise<boolean> {
  const user = await getUser(id);
  if (!user) return false;

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query('DELETE FROM projects WHERE user_id = $1', [id]);
    await client.query('DELETE FROM payments WHERE user_id = $1', [id]);
    await client.query('DELETE FROM analytics_events WHERE user_id = $1', [id]);
    await client.query('DELETE FROM analytics_sessions WHERE user_id = $1', [id]);
    await client.query(`DELETE FROM session WHERE sess->>'userId' = $1`, [String(id)]);
    const result = await client.query('DELETE FROM users WHERE id = $1', [id]);
    await client.query("COMMIT");
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteUsers(ids: number[]): Promise<{ deleted: number; failed: { id: number; reason: string }[] }> {
  const failed: { id: number; reason: string }[] = [];
  let deleted = 0;
  for (const id of ids) {
    try {
      const ok = await deleteUser(id);
      if (ok) deleted++;
      else failed.push({ id, reason: "not_found" });
    } catch {
      failed.push({ id, reason: "error" });
    }
  }
  return { deleted, failed };
}

export async function updateUserAdminNote(id: number, adminNote: string | null): Promise<User | undefined> {
  const [user] = await getDb().update(schema.users).set({ adminNote }).where(eq(schema.users.id, id)).returning();
  return user;
}

/** @deprecated use logAuditEvent */
export async function logAdminAction(
  actorId: number,
  action: string,
  targetType: string,
  targetId: number | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  const user = await getUser(actorId);
  await logAuditEvent({
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
