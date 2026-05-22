import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Users, Crown, LayoutTemplate, CreditCard, TrendingUp, AlertTriangle, Eye,
  UserPlus, Layers, Globe, Bot,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AdminPanel,
  AdminSectionHeader,
  AdminDashboardSection,
  AdminKpiGrid,
  AdminKpiStrip,
  AdminKpiStripItem,
  AdminKpiCard,
  adminTokens,
} from "./AdminShell";
import { AdminOpsWidgets } from "./AdminOpsWidgets";
import { AdminAnalyticsLiveFeed } from "./AdminAnalyticsLiveFeed";
import type { AnalyticsDashboard } from "./types";

const PIE_COLORS = ["#c9a84c", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#64748b"];

const chartTooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 11,
};

function TrendChart({
  title,
  data,
  dataKey,
  color,
}: {
  title: string;
  data: { date: string; [k: string]: string | number }[];
  dataKey: string;
  color: string;
}) {
  return (
    <AdminPanel className="h-full flex flex-col">
      <AdminSectionHeader title={title} compact />
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center flex-1">No data for this period</p>
      ) : (
        <div className="h-40 sm:h-44 mt-1 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={d => d.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                width={28}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                fill={color}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </AdminPanel>
  );
}

function KpiSkeleton() {
  return (
    <div className={adminTokens.sectionGap}>
      <div className="h-24 skeleton rounded-xl" />
      <AdminKpiGrid>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-[92px] skeleton rounded-xl" />
        ))}
      </AdminKpiGrid>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-52 skeleton rounded-xl" />
        ))}
      </div>
    </div>
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

  if (isLoading) return <KpiSkeleton />;

  if (isError || !data) {
    return (
      <AdminPanel>
        <p className="text-sm text-destructive">Could not load analytics dashboard.</p>
      </AdminPanel>
    );
  }

  const conversionPct =
    data.totalUsers > 0 ? Math.round((data.proUsers / data.totalUsers) * 100) : 0;

  const visitTotals = data.visitTotals ?? { d7: 0, d30: 0, d90: 0 };
  const sessionTotals = data.sessionTotals ?? { d7: 0, d30: 0, d90: 0 };
  const pageViewsPeriod = data.pageViewsPeriod ?? 0;
  const sessionsPeriod = data.sessionsPeriod ?? 0;
  const visitorBreakdown = data.visitorBreakdown ?? { guest: 0, user: 0, bot: 0 };
  const topGuestPages = data.topGuestPages ?? [];
  const acquisitionFunnel = data.acquisitionFunnel ?? { landing: 0, templates: 0, pricing: 0, auth: 0, signups: 0 };

  const funnelSteps = [
    { label: "Total users", value: data.funnel.signups },
    { label: "Created a card", value: data.funnel.firstCard },
    { label: "At download cap", value: data.funnel.hitDownloadCap },
    { label: "Pro subscribers", value: data.funnel.paid },
  ];

  return (
    <div className={adminTokens.sectionGap}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Privacy-aware telemetry · refreshes every 30s
        </p>
        <Select value={period} onValueChange={v => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-full sm:w-[132px] h-8 text-xs" data-testid="select-analytics-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminDashboardSection title="Overview">
        <AdminKpiStrip>
          <AdminKpiStripItem
            label="Total users"
            value={data.totalUsers.toLocaleString()}
            hint={`${data.signupsToday} joined today`}
            icon={Users}
            tone="primary"
            delta={data.signupsToday > 0 ? { text: `+${data.signupsToday} today`, positive: true } : undefined}
          />
          <AdminKpiStripItem
            label="Pro subscribers"
            value={data.proUsers.toLocaleString()}
            hint={`${conversionPct}% conversion`}
            icon={Crown}
            tone="success"
          />
          <AdminKpiStripItem
            label="Lifetime revenue"
            value={`₦${Number(data.totalRevenue / 100).toLocaleString()}`}
            hint="Successful payments"
            icon={CreditCard}
            tone="info"
          />
          <AdminKpiStripItem
            label="Total cards"
            value={data.totalCards.toLocaleString()}
            hint={`${data.cardsToday} created today`}
            icon={LayoutTemplate}
            tone="neutral"
          />
        </AdminKpiStrip>
      </AdminDashboardSection>

      <AdminDashboardSection title="Live & today" description="Sessions, traffic, and alerts">
        <AdminKpiGrid>
          <AdminKpiCard
            label="Active now"
            value={data.activeUsersNow}
            hint="Sessions in last 5 min"
            icon={Users}
            tone="success"
          />
          <AdminKpiCard
            label="Page views"
            value={data.pageViewsToday.toLocaleString()}
            hint={`${data.sessionsToday} sessions today`}
            icon={Eye}
            tone="info"
          />
          <AdminKpiCard
            label="Signups today"
            value={data.signupsToday}
            hint={`Period: ${period}`}
            icon={UserPlus}
            tone="primary"
          />
          <AdminKpiCard
            label="Errors (24h)"
            value={data.errors24h}
            hint={data.errors24h === 0 ? "All clear" : "Review activity tab"}
            icon={AlertTriangle}
            tone={data.errors24h > 0 ? "danger" : "success"}
            delta={
              data.errors24h > 0
                ? { text: "Needs review", positive: false }
                : { text: "Healthy", positive: true }
            }
          />
        </AdminKpiGrid>
      </AdminDashboardSection>

      <AdminDashboardSection title="Web traffic" description="Total visits across the app">
        <AdminKpiGrid>
          <AdminKpiCard
            label="Page views (7d)"
            value={visitTotals.d7.toLocaleString()}
            hint={`${sessionTotals.d7.toLocaleString()} unique sessions`}
            icon={Eye}
            tone="info"
          />
          <AdminKpiCard
            label="Page views (30d)"
            value={visitTotals.d30.toLocaleString()}
            hint={`${sessionTotals.d30.toLocaleString()} unique sessions`}
            icon={Eye}
            tone="info"
          />
          <AdminKpiCard
            label="Page views (90d)"
            value={visitTotals.d90.toLocaleString()}
            hint={`${sessionTotals.d90.toLocaleString()} unique sessions`}
            icon={Eye}
            tone="info"
          />
          <AdminKpiCard
            label={`Views (${period})`}
            value={pageViewsPeriod.toLocaleString()}
            hint={`${sessionsPeriod.toLocaleString()} sessions in selected period`}
            icon={TrendingUp}
            tone="primary"
          />
        </AdminKpiGrid>
      </AdminDashboardSection>

      <AdminDashboardSection title="Guest & acquisition" description="Anonymous visitors, bots, and signup funnel">
        <AdminKpiGrid>
          <AdminKpiCard
            label="Guest page views"
            value={visitorBreakdown.guest.toLocaleString()}
            hint={`${period} · human visitors not signed in`}
            icon={Globe}
            tone="info"
          />
          <AdminKpiCard
            label="Signed-in views"
            value={visitorBreakdown.user.toLocaleString()}
            hint={`${period} · registered users`}
            icon={Users}
            tone="primary"
          />
          <AdminKpiCard
            label="Bot / crawler views"
            value={visitorBreakdown.bot.toLocaleString()}
            hint={`${period} · filtered from funnel`}
            icon={Bot}
            tone="neutral"
          />
          <AdminKpiCard
            label="New signups"
            value={acquisitionFunnel.signups}
            hint={`${period} · converted to accounts`}
            icon={UserPlus}
            tone="success"
          />
        </AdminKpiGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          <AdminPanel>
            <AdminSectionHeader title="Guest acquisition funnel" compact description="Page views by anonymous humans in selected period" />
            <div className="space-y-2 mt-2">
              {[
                { label: "Landing page", value: acquisitionFunnel.landing },
                { label: "Templates gallery", value: acquisitionFunnel.templates },
                { label: "Pricing", value: acquisitionFunnel.pricing },
                { label: "Sign up / auth", value: acquisitionFunnel.auth },
                { label: "Registered", value: acquisitionFunnel.signups },
              ].map(step => {
                const max = Math.max(acquisitionFunnel.landing, 1);
                const pct = Math.round((step.value / max) * 100);
                return (
                  <div key={step.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{step.label}</span>
                      <span className="font-medium tabular-nums">{step.value.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminPanel>

          <AdminPanel>
            <AdminSectionHeader title="Top guest pages" compact description="Where anonymous visitors spend time" />
            {topGuestPages.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No guest traffic yet — accept cookies on the site to start tracking.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {topGuestPages.map(p => (
                  <div key={p.path} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground font-mono">{p.path}</span>
                    <span className="font-semibold tabular-nums shrink-0">{p.views.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </AdminPanel>
        </div>
      </AdminDashboardSection>

      <AdminDashboardSection title="Operations" description="Limits, sharing, and product usage">
        <AdminOpsWidgets />
      </AdminDashboardSection>

      <AdminDashboardSection title="Trends">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <TrendChart title="Signups" data={data.signupsTrend} dataKey="count" color="#c9a84c" />
          <TrendChart title="Cards created" data={data.cardsTrend} dataKey="count" color="#3b82f6" />
          <TrendChart title="Revenue (₦)" data={data.revenueTrend} dataKey="amount" color="#10b981" />
        </div>
      </AdminDashboardSection>

      <AdminDashboardSection title="Real-time activity">
        <AdminAnalyticsLiveFeed />
      </AdminDashboardSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AdminPanel className="h-full">
          <AdminSectionHeader title="Conversion funnel" description="Signup → card → limit → Pro" compact />
          <div className="space-y-2.5">
            {funnelSteps.map((step, i) => {
              const pct =
                funnelSteps[0].value > 0
                  ? Math.round((step.value / funnelSteps[0].value) * 100)
                  : 0;
              return (
                <div key={step.label}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className="font-medium tabular-nums">
                      {step.value.toLocaleString()}
                      {i > 0 && (
                        <span className="text-muted-foreground font-normal ml-1">({pct}%)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/80 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </AdminPanel>

        <AdminPanel className="h-full">
          <AdminSectionHeader title="Top pages" description="Authenticated views" compact />
          {data.topPages.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No page views yet</p>
          ) : (
            <div className="space-y-1">
              {data.topPages.map(p => (
                <div
                  key={p.path}
                  className="flex items-center justify-between gap-2 py-1.5 text-xs border-b border-border/30 last:border-0"
                >
                  <span className="truncate font-mono text-[11px] text-muted-foreground">{p.path}</span>
                  <span className="font-medium tabular-nums shrink-0">{p.views}</span>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>

      <AdminDashboardSection title="Audience" description="Devices, browsers, and traffic sources">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AdminPanel>
            <AdminSectionHeader title="Devices" compact />
            {data.devices.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">—</p>
            ) : (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.devices}
                      dataKey="count"
                      nameKey="device"
                      cx="50%"
                      cy="50%"
                      outerRadius={52}
                      label={({ device, count }) => `${device} (${count})`}
                      labelLine={false}
                    >
                      {data.devices.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </AdminPanel>

          <AdminPanel>
            <AdminSectionHeader title="Browsers" compact />
            {data.browsers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">—</p>
            ) : (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.browsers} layout="vertical" margin={{ left: 0, right: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="browser"
                      width={52}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="count" fill="#c9a84c" radius={[0, 3, 3, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </AdminPanel>

          <AdminPanel>
            <AdminSectionHeader title="Traffic sources" compact />
            {data.referrers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">—</p>
            ) : (
              <div className="space-y-1">
                {data.referrers.map(r => (
                  <div
                    key={r.source}
                    className="flex justify-between text-xs py-1.5 border-b border-border/30 last:border-0"
                  >
                    <span className="truncate text-muted-foreground">{r.source}</span>
                    <span className="font-medium tabular-nums shrink-0 ml-2">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </AdminPanel>
        </div>
      </AdminDashboardSection>

      {(data.topActions.length > 0 || data.conversions.length > 0) && (
        <AdminDashboardSection title="Feature usage">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {data.topActions.length > 0 && (
              <AdminPanel>
                <AdminSectionHeader title="Top actions" compact />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.topActions.map(a => (
                    <div
                      key={a.action}
                      className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs"
                    >
                      <span className="truncate">{a.action}</span>
                      <span className="font-semibold tabular-nums shrink-0 ml-2">{a.count}</span>
                    </div>
                  ))}
                </div>
              </AdminPanel>
            )}
            {data.conversions.length > 0 && (
              <AdminPanel>
                <AdminSectionHeader title="Conversion events" compact />
                <div className="flex flex-wrap gap-2">
                  {data.conversions.map(c => (
                    <div
                      key={c.event}
                      className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs"
                    >
                      <span className="capitalize text-muted-foreground">
                        {c.event.replace(/_/g, " ")}
                      </span>
                      <span className="font-semibold tabular-nums">{c.count}</span>
                    </div>
                  ))}
                </div>
              </AdminPanel>
            )}
          </div>
        </AdminDashboardSection>
      )}

      <AdminKpiGrid cols={2}>
        <AdminKpiCard
          label="Analytics retention"
          value={`${data.retention.analyticsRetentionDays}d`}
          hint="Session & event data kept"
          icon={TrendingUp}
          tone="neutral"
        />
        <AdminKpiCard
          label="Audit retention"
          value={`${data.retention.auditRetentionDays}d`}
          hint="Admin audit log kept"
          icon={Layers}
          tone="neutral"
        />
      </AdminKpiGrid>
    </div>
  );
}
