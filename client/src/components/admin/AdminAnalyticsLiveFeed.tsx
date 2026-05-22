import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, Monitor, Radio } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AdminPanel, AdminSectionHeader } from "./AdminShell";
import type { AnalyticsLiveFeed } from "./types";
import { auditActionLabel } from "./types";

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
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="h-56 skeleton rounded-xl" />
        <div className="h-56 skeleton rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <AdminPanel>
        <p className="text-sm text-destructive">Could not load live activity.</p>
      </AdminPanel>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <AdminPanel padding="none" className="flex flex-col min-h-[220px]">
        <div className="px-4 pt-3 pb-2 border-b border-border/40 flex items-start justify-between gap-2">
          <AdminSectionHeader
            title="Active sessions"
            description={`${data.activeSessions.length} in last 5 min · refreshes every 15s`}
            compact
          />
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <Radio size={12} className="text-emerald-500 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Live</span>
          </div>
        </div>
        {data.activeSessions.length === 0 ? (
          <p className="text-xs text-muted-foreground px-4 py-8 text-center flex-1">No active sessions</p>
        ) : (
          <div className="divide-y divide-border/30 max-h-56 overflow-y-auto flex-1">
            {data.activeSessions.map(s => (
              <div key={s.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{s.userName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.userEmail}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium shrink-0 capitalize">
                    {s.userTier}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 truncate flex items-center gap-1">
                  <Monitor size={10} className="shrink-0" />
                  {s.pagePath || "—"} · {s.browser} · {Math.floor(s.durationSeconds / 60)}m
                </p>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      <AdminPanel padding="none" className="flex flex-col min-h-[220px]">
        <div className="px-4 pt-3 pb-2 border-b border-border/40">
          <AdminSectionHeader
            title="Live activity feed"
            description="Recent product events and audit entries"
            compact
          />
        </div>
        <div className="divide-y divide-border/30 max-h-56 overflow-y-auto flex-1">
          {data.recentEvents.slice(0, 8).map(e => (
            <div key={`ev-${e.id}`} className="px-4 py-2">
              <p className="text-xs font-medium capitalize">{e.eventType.replace(/_/g, " ")}</p>
              <p className="text-[11px] text-muted-foreground truncate">{e.pagePath || e.action || "—"}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5 tabular-nums">
                {e.createdAt ? format(new Date(e.createdAt), "HH:mm:ss") : "—"}
              </p>
            </div>
          ))}
          {data.recentAudit.slice(0, 6).map(a => (
            <div key={`au-${a.id}`} className="px-4 py-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Activity size={11} className="text-primary shrink-0" />
                <p className="text-xs font-medium truncate">{auditActionLabel(a.action)}</p>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${
                    a.severity === "critical"
                      ? "bg-destructive/10 text-destructive"
                      : a.severity === "security"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.severity}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {a.actorName ?? "System"} · {a.pagePath || a.targetType}
              </p>
            </div>
          ))}
          {data.recentEvents.length === 0 && data.recentAudit.length === 0 && (
            <p className="text-xs text-muted-foreground px-4 py-8 text-center">No recent activity</p>
          )}
        </div>
      </AdminPanel>
    </div>
  );
}
