export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  tier: "free" | "pro";
  theme?: string;
  downloadsToday: number;
  lastDownloadDate?: string | null;
  createdAt?: string | null;
  projectCount: number;
  sharedCount: number;
}

export interface AdminPayment {
  id: number;
  userId: number;
  userName?: string;
  userEmail?: string;
  reference: string;
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed";
  plan: string;
  createdAt: string | null;
}

export interface AdminAuditEntry {
  id: number;
  actorId: number;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: number | null;
  meta: Record<string, unknown> | null;
  createdAt: string | null;
}

export function formatKobo(amount: number, currency = "NGN") {
  const value = amount / 100;
  if (currency === "NGN") return `₦${value.toLocaleString()}`;
  return `${currency} ${value.toLocaleString()}`;
}

export function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    "user.tier_change": "Tier changed",
    "user.role_change": "Role changed",
    "template.status_change": "Template status",
    "template.delete": "Template deleted",
  };
  return labels[action] ?? action;
}
