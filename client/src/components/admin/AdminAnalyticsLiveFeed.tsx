import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, Monitor, Radio } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AdminPanel, AdminSectionHeader } from "./AdminShell";
import type { AnalyticsLiveFeed } from "./types";
import { auditActionLabel } from "./types";

function LivePill({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

export function AdminAnalyticsLiveFeed() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/admin/analytics/live"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/analytics/live");
      return res.json() as Promise<AnalyticsLiveFeed>;
    },
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return <div className="h-64 skeleton rounded-2xl" />;
  }

  if (isError || !data) {
    return (
      <AdminPanel>
        <p className="text-sm text-destructive">Could not load live activity.</p>
      </AdminPanel>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <AdminPanel padding="none">
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border/60 flex items-center justify-between">
          <AdminSectionHeader title="Active sessions" description={`${data.activeSessions.length} user(s) in last 5 min`} />
          <Radio size={16} className="text-emerald-400 animate-pulse shrink-0" />
        </div>
        {data.activeSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground px-5 py-8">No active sessions right now.</p>
        ) : (
          <div className="divide-y divide-border/60 max-h-72 overflow-y-auto">
            {data.activeSessions.map(s => (
              <div key={s.id} className="px-4 sm:px-5 py-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.userEmail}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0">{s.userTier}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  <Monitor size={11} className="inline mr-1" />
                  {s.pagePath || "—"} · {s.browser} · {Math.floor(s.durationSeconds / 60)}m
                </p>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      <AdminPanel padding="none">
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border/60">
          <AdminSectionHeader title="Live activity feed" description="Recent product events and audit entries" />
        </div>
        <div className="divide-y divide-border/60 max-h-72 overflow-y-auto">
          {data.recentEvents.slice(0, 8).map(e => (
            <div key={`ev-${e.id}`} className="px-4 sm:px-5 py-2.5 text-xs">
              <p className="font-medium capitalize">{e.eventType.replace(/_/g, " ")}</p>
              <p className="text-muted-foreground truncate">{e.pagePath || e.action || "—"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {e.createdAt ? format(new Date(e.createdAt), "HH:mm:ss") : "—"}
              </p>
            </div>
          ))}
          {data.recentAudit.slice(0, 6).map(a => (
            <div key={`au-${a.id}`} className="px-4 sm:px-5 py-2.5 text-xs border-t border-border/40">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-primary shrink-0" />
                <p className="font-medium truncate">{auditActionLabel(a.action)}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase ${
                  a.severity === "critical" ? "bg-destructive/15 text-destructive" :
                  a.severity === "security" ? "bg-amber-500/15 text-amber-400" :
                  "bg-secondary text-muted-foreground"
                }`}>{a.severity}</span>
              </div>
              <p className="text-muted-foreground truncate mt-0.5">{a.actorName ?? "System"} · {a.pagePath || a.targetType}</p>
            </div>
          ))}
          {data.recentEvents.length === 0 && data.recentAudit.length === 0 && (
            <p className="text-sm text-muted-foreground px-5 py-8">No recent activity yet.</p>
          )}
        </div>
      </AdminPanel>
    </div>
  );
}

export function AdminAnalyticsLiveSummary({ activeUsers }: { activeUsers: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <LivePill label="Active now" value={activeUsers} tone="text-emerald-400" />
      <LivePill label="Status" value="Live" tone="text-primary" />
      <LivePill label="Refresh" value="15s" />
      <LivePill label="Scope" value="Auth users" />
    </div>
  );
}
