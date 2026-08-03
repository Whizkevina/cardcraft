export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  tier: "free" | "pro";
  theme?: string;
  status?: "active" | "suspended";
  authProvider?: "email" | "google";
  downloadsToday: number;
  totalDownloads?: number;
  lastDownloadDate?: string | null;
  lastLoginAt?: string | null;
  proExpiresAt?: string | null;
  createdAt?: string | null;
  adminNote?: string | null;
  projectCount: number;
  sharedCount: number;
}

export interface AdminProject {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  templateId: number | null;
  templateTitle: string | null;
  title: string;
  shareEnabled: boolean;
  shareToken: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export interface AdminUserProject {
  id: number;
  title: string;
  templateTitle: string | null;
  shareEnabled: boolean;
  shareToken: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export interface AdminOpsStats {
  atDownloadCapToday: number;
  sharedLinksCount: number;
  freeProjectLimit: number;
  nearProjectLimitUsers: { id: number; name: string; email: string; projectCount: number }[];
  exportFormatBreakdown: { format: string; count: number }[];
  bulkGenerateSessions30d: number;
}

export interface AdminHealth {
  db: boolean;
  emailConfigured: boolean;
  paystackConfigured: boolean;
  webhookLast: { status: string; event?: string; at: string } | null;
  serverErrors24h: number;
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
  refundNote?: string | null;
  createdAt: string | null;
}

export interface AdminAuditEntry {
  id: number;
  actorId: number | null;
  actorRole?: string;
  actorEmail?: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: number | null;
  meta: Record<string, unknown> | null;
  ipAddress?: string | null;
  ipHash?: string | null;
  sessionId?: string | null;
  userAgent?: string | null;
  severity?: string;
  pagePath?: string | null;
  referrer?: string | null;
  beforeValue?: string | null;
  afterValue?: string | null;
  integrityHash?: string | null;
  createdAt: string | null;
}

export interface AdminAuditLogResponse {
  items: AdminAuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AnalyticsDashboard {
  period: string;
  activeUsersNow: number;
  sessionsToday: number;
  pageViewsToday: number;
  pageViewsPeriod: number;
  sessionsPeriod: number;
  visitTotals: { d7: number; d30: number; d90: number };
  sessionTotals: { d7: number; d30: number; d90: number };
  visitorBreakdown?: { guest: number; user: number; bot: number };
  topGuestPages?: { path: string; views: number }[];
  acquisitionFunnel?: { landing: number; templates: number; pricing: number; auth: number; signups: number };
  errors24h: number;
  totalUsers: number;
  proUsers: number;
  totalCards: number;
  totalRevenue: number;
  cardsToday: number;
  signupsToday: number;
  signupsTrend: { date: string; count: number }[];
  cardsTrend: { date: string; count: number }[];
  revenueTrend: { date: string; amount: number }[];
  topPages: { path: string; views: number }[];
  topActions: { action: string; count: number }[];
  devices: { device: string; count: number }[];
  browsers: { browser: string; count: number }[];
  referrers: { source: string; count: number }[];
  conversions: { event: string; count: number }[];
  funnel: { signups: number; firstCard: number; hitDownloadCap: number; paid: number };
  retention: { analyticsRetentionDays: number; auditRetentionDays: number };
  topTemplates?: { id: number; title: string; uses: number; thumbnailColor: string }[];
  recentSignups?: { id: number; name: string; email: string; createdAt: string; tier: string }[];
}

export interface AnalyticsLiveFeed {
  activeSessions: {
    id: number;
    userId: number;
    userName: string | null;
    userEmail: string | null;
    userRole: string | null;
    userTier: string | null;
    pagePath: string | null;
    referrer: string | null;
    browser: string | null;
    os: string | null;
    deviceType: string | null;
    startedAt: string | null;
    lastSeenAt: string | null;
    durationSeconds: number;
  }[];
  recentEvents: {
    id: number;
    eventType: string;
    pagePath: string | null;
    action: string | null;
    userId: number | null;
    browser: string | null;
    deviceType: string | null;
    createdAt: string | null;
    meta: Record<string, unknown> | null;
  }[];
  recentAudit: {
    id: number;
    action: string;
    severity: string | null;
    actorName: string | null;
    actorRole: string | null;
    targetType: string;
    targetId: number | null;
    pagePath: string | null;
    createdAt: string | null;
  }[];
}

export function sharePreviewUrl(shareToken: string): string {
  const base = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "")
    || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/share/${shareToken}`;
}

export function formatKobo(amount: number, currency = "NGN") {
  const value = amount / 100;
  if (currency === "NGN") return `₦${value.toLocaleString()}`;
  return `${currency} ${value.toLocaleString()}`;
}

export function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    "user.register": "User registered",
    "user.login": "User signed in",
    "user.login_failed": "Failed login attempt",
    "user.logout": "User signed out",
    "user.password_change": "Password changed",
    "user.password_reset_request": "Password reset requested",
    "user.password_reset": "Password reset completed",
    "user.theme_change": "Theme changed",
    "user.download": "Card downloaded",
    "user.tier_change": "Tier changed",
    "user.role_change": "Role changed",
    "user.status_change": "Account status changed",
    "user.password_reset_sent": "Password reset sent (admin)",
    "user.force_logout": "Forced logout",
    "user.delete": "User deleted",
    "project.create": "Project created",
    "project.update": "Project updated",
    "project.delete": "Project deleted",
    "project.duplicate": "Project duplicated",
    "project.rename": "Project renamed",
    "project.share_enable": "Share link enabled",
    "project.share_revoke": "Share link revoked",
    "project.admin_delete": "Project deleted (admin)",
    "share.view": "Share link viewed",
    "user.admin_note": "Support note updated",
    "user.impersonate_start": "Support view started",
    "user.impersonate_end": "Support view ended",
    "settings.retention_change": "Retention policy updated",
    "payment.initialize": "Payment started",
    "payment.success": "Payment succeeded",
    "payment.pending": "Payment pending",
    "payment.refund_note": "Refund note updated",
    "email.send_card": "Card emailed",
    "template.create": "Template created",
    "template.status_change": "Template status changed",
    "template.delete": "Template deleted",
  };
  return labels[action] ?? action.replace(/\./g, " · ");
}

export function auditActorLabel(entry: AdminAuditEntry): string {
  if (entry.actorRole === "system") return entry.actorName ?? "System";
  if (entry.actorRole === "guest") return "Guest";
  const name = entry.actorName ?? (entry.actorId != null ? `User #${entry.actorId}` : "Unknown");
  const role = entry.actorRole === "admin" ? " (admin)" : "";
  const email = entry.actorEmail ? ` · ${entry.actorEmail}` : "";
  return `${name}${role}${email}`;
}

export function auditTargetLabel(entry: AdminAuditEntry): string {
  const meta = entry.meta;
  if (meta?.title) return String(meta.title);
  if (meta?.email && entry.targetType === "user") return String(meta.email);
  if (meta?.reference) return String(meta.reference);
  if (entry.targetId != null) return `${entry.targetType} #${entry.targetId}`;
  return entry.targetType;
}

export function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export function auditSeverityTone(severity?: string | null): string {
  if (severity === "critical") return "bg-destructive/15 text-destructive";
  if (severity === "security") return "bg-pending/15 text-pending";
  if (severity === "warning") return "bg-pending/15 text-pending";
  return "bg-secondary text-muted-foreground";
}

export function isInactiveUser(user: AdminUser, inactiveDays = 30): boolean {
  const reference = user.lastLoginAt ?? user.createdAt;
  return daysSince(reference) >= inactiveDays;
}
