import { useQuery } from "@tanstack/react-query";
import { Download, Share2, FolderOpen, Users, Layers, FileOutput } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AdminPanel, AdminSectionHeader, AdminKpiGrid, AdminKpiCard } from "./AdminShell";
import type { AdminOpsStats } from "./types";

export function AdminOpsWidgets() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/ops-stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/ops-stats");
      return res.json() as Promise<AdminOpsStats>;
    },
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <AdminKpiGrid cols={4}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-[92px] skeleton rounded-xl" />
        ))}
      </AdminKpiGrid>
    );
  }

  return (
    <div className="space-y-3">
      <AdminKpiGrid cols={4}>
        <AdminKpiCard
          label="At download cap"
          value={data.atDownloadCapToday}
          hint="Free users at 3/3 today"
          icon={Download}
          tone="warning"
        />
        <AdminKpiCard
          label="Active share links"
          value={data.sharedLinksCount}
          hint="Projects with sharing on"
          icon={Share2}
          tone="info"
        />
        <AdminKpiCard
          label="Near project limit"
          value={data.nearProjectLimitUsers.length}
          hint={`Free users with ${data.freeProjectLimit - 1}+ cards`}
          icon={FolderOpen}
          tone="warning"
        />
        <AdminKpiCard
          label="Bulk generate (30d)"
          value={data.bulkGenerateSessions30d}
          hint="Pro CSV batch runs"
          icon={Layers}
          tone="primary"
        />
      </AdminKpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AdminPanel padding="sm">
          <AdminSectionHeader title="Export formats" description="Editor downloads by type" compact />
          {data.exportFormatBreakdown.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-4 text-center">No exports recorded yet</p>
          ) : (
            <div className="space-y-1">
              {data.exportFormatBreakdown.map(row => (
                <div
                  key={row.format}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0"
                >
                  <span className="flex items-center gap-1.5 capitalize text-muted-foreground">
                    <FileOutput size={11} />
                    {row.format.replace("export_", "").toUpperCase()}
                  </span>
                  <span className="font-medium tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>

        {data.nearProjectLimitUsers.length > 0 ? (
          <AdminPanel padding="none">
            <div className="px-4 pt-3 pb-2 border-b border-border/40">
              <AdminSectionHeader
                title="Upgrade opportunities"
                description="Users near free project limit"
                compact
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {data.nearProjectLimitUsers.map(u => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 px-4 py-2 text-xs border-b border-border/30 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className="text-[11px] font-semibold shrink-0 flex items-center gap-1 text-amber-600 dark:text-amber-400 tabular-nums">
                    <Users size={11} />
                    {u.projectCount}/{data.freeProjectLimit}
                  </span>
                </div>
              ))}
            </div>
          </AdminPanel>
        ) : (
          <AdminPanel padding="sm" className="flex items-center justify-center">
            <p className="text-[11px] text-muted-foreground text-center py-4">
              No users near the free project limit
            </p>
          </AdminPanel>
        )}
      </div>
    </div>
  );
}
