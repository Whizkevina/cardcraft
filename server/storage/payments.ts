import { eq, desc, sql, and, ilike, gte, lte } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { Payment, InsertPayment } from "@shared/schema";
import { getDb } from "./db";

export async function getPayment(reference: string): Promise<Payment | undefined> { const [p] = await getDb().select().from(schema.payments).where(eq(schema.payments.reference, reference)).limit(1); return p; }
export async function getPaymentsByUser(userId: number): Promise<Payment[]> { return getDb().select().from(schema.payments).where(eq(schema.payments.userId, userId)).orderBy(desc(schema.payments.createdAt)); }
export async function createPayment(data: InsertPayment): Promise<Payment> { const [p] = await getDb().insert(schema.payments).values(data).returning(); return p; }
export async function updatePaymentStatus(reference: string, status: "success" | "failed"): Promise<Payment | undefined> { const [p] = await getDb().update(schema.payments).set({ status }).where(eq(schema.payments.reference, reference)).returning(); return p; }
export async function updatePaymentRefundNote(id: number, refundNote: string | null): Promise<Payment | undefined> {
  const [payment] = await getDb().update(schema.payments).set({ refundNote }).where(eq(schema.payments.id, id)).returning();
  return payment;
}

export async function getAdminPayments(filters: { status?: string; email?: string; from?: string; to?: string; limit?: number } = {}) {
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

export async function getPaymentsRevenueThisMonth(): Promise<number> {
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
