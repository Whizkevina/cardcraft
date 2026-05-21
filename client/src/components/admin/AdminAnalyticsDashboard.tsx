import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Users, Crown, LayoutTemplate, CreditCard, TrendingUp, AlertTriangle, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPanel, AdminSectionHeader, AdminStatCard } from "./AdminShell";
import { AdminOpsWidgets } from "./AdminOpsWidgets";
import { AdminAnalyticsLiveFeed, AdminAnalyticsLiveSummary } from "./AdminAnalyticsLiveFeed";
import type { AnalyticsDashboard } from "./types";

const PIE_COLORS = ["#c9a84c", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#64748b"];

function TrendChart({ title, data, dataKey, color }: { title: string; data: { date: string; [k: string]: string | number }[]; dataKey: string; color: string }) {
  return (
    <AdminPanel padding="lg">
      <AdminSectionHeader title={title} />
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">No data for this period.</p>
      ) : (
        <div className="h-52 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} width={32} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </AdminPanel>
  );
}

export function AdminAnalyticsDashboard() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/admin/analytics/dashboard", period],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/analytics/dashboard?period=${period}`);
      return res.json() as Promise<AnalyticsDashboard>;
    },
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-32 skeleton rounded-2xl" />)}</div>
        <div className="h-64 skeleton rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <AdminPanel>
        <p className="text-sm text-destructive">Could not load analytics dashboard.</p>
      </AdminPanel>
    );
  }

  const funnelSteps = [
    { label: "Total users", value: data.funnel.signups },
    { label: "Created a card", value: data.funnel.firstCard },
    { label: "At download cap", value: data.funnel.hitDownloadCap },
    { label: "Pro subscribers", value: data.funnel.paid },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold font-display">Analytics overview</h2>
          <p className="text-xs text-muted-foreground">Operational visibility for authenticated app usage — privacy-aware, no third-party trackers.</p>
        </div>
        <Select value={period} onValueChange={v => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-full sm:w-[140px] h-10" data-testid="select-analytics-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminAnalyticsLiveSummary activeUsers={data.activeUsersNow} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <AdminStatCard label="Active now" value={data.activeUsersNow} sub="Sessions in last 5 min" icon={Users} tone="green" />
        <AdminStatCard label="Page views today" value={data.pageViewsToday} sub={`${data.sessionsToday} sessions`} icon={Eye} tone="blue" />
        <AdminStatCard label="Pro users" value={data.proUsers} sub={`${data.totalUsers > 0 ? Math.round(data.proUsers / data.totalUsers * 100) : 0}% conversion`} icon={Crown} tone="primary" />
        <AdminStatCard label="Errors (24h)" value={data.errors24h} sub={data.errors24h === 0 ? "All clear" : "Review audit trail"} icon={AlertTriangle} tone={data.errors24h > 0 ? "gold" : "green"} />
      </div>

      <AdminOpsWidgets />

      <AdminAnalyticsLiveFeed />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TrendChart title="Signups" data={data.signupsTrend} dataKey="count" color="#c9a84c" />
        <TrendChart title="Cards created" data={data.cardsTrend} dataKey="count" color="#3b82f6" />
        <TrendChart title="Revenue (₦)" data={data.revenueTrend} dataKey="amount" color="#10b981" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <AdminStatCard label="Total users" value={data.totalUsers} sub={`${data.signupsToday} joined today`} icon={Users} tone="gold" />
        <AdminStatCard label="Total cards" value={data.totalCards} sub={`${data.cardsToday} today`} icon={LayoutTemplate} tone="blue" />
        <AdminStatCard label="Lifetime revenue" value={`₦${Number(data.totalRevenue / 100).toLocaleString()}`} sub="Successful payments" icon={CreditCard} tone="green" />
        <AdminStatCard label="Retention policy" value={`${data.retention.analyticsRetentionDays}d`} sub={`Audit: ${data.retention.auditRetentionDays}d`} icon={TrendingUp} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdminPanel padding="lg">
          <AdminSectionHeader title="Conversion funnel" description="Signup → first card → limit → Pro" />
          <div className="space-y-3 mt-2">
            {funnelSteps.map((step, i) => {
              const pct = funnelSteps[0].value > 0 ? Math.round((step.value / funnelSteps[0].value) * 100) : 0;
              return (
                <div key={step.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className="font-semibold">{step.value.toLocaleString()} {i > 0 && `(${pct}%)`}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </AdminPanel>

        <AdminPanel padding="lg">
          <AdminSectionHeader title="Top pages" description="Authenticated page views" />
          {data.topPages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No page views recorded yet.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {data.topPages.map(p => (
                <div key={p.path} className="flex items-center justify-between text-sm gap-2">
                  <span className="truncate font-mono text-xs">{p.path}</span>
                  <span className="text-muted-foreground shrink-0">{p.views}</span>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AdminPanel padding="lg">
          <AdminSectionHeader title="Devices" />
          {data.devices.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <div className="h-44 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.devices} dataKey="count" nameKey="device" cx="50%" cy="50%" outerRadius={60} label={({ device, count }) => `${device} (${count})`}>
                    {data.devices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminPanel>

        <AdminPanel padding="lg">
          <AdminSectionHeader title="Browsers" />
          {data.browsers.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <div className="h-44 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.browsers} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="browser" width={56} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#c9a84c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminPanel>

        <AdminPanel padding="lg">
          <AdminSectionHeader title="Traffic sources" />
          {data.referrers.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <div className="space-y-2 mt-2">
              {data.referrers.map(r => (
                <div key={r.source} className="flex justify-between text-sm">
                  <span>{r.source}</span>
                  <span className="text-muted-foreground">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>

      {data.topActions.length > 0 && (
        <AdminPanel padding="lg">
          <AdminSectionHeader title="Top feature actions" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            {data.topActions.map(a => (
              <div key={a.action} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span className="truncate">{a.action}</span>
                <span className="text-muted-foreground shrink-0 ml-2">{a.count}</span>
              </div>
            ))}
          </div>
        </AdminPanel>
      )}

      {data.conversions.length > 0 && (
        <AdminPanel padding="lg">
          <AdminSectionHeader title="Conversion events" description="Downloads, share views, upgrades" />
          <div className="flex flex-wrap gap-3 mt-2">
            {data.conversions.map(c => (
              <div key={c.event} className="flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2">
                <span className="text-sm capitalize">{c.event.replace(/_/g, " ")}</span>
                <span className="font-bold">{c.count}</span>
              </div>
            ))}
          </div>
        </AdminPanel>
      )}
    </div>
  );
}
