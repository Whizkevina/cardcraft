import { useQuery } from "@tanstack/react-query";
import { Download, Share2, FolderOpen, Users, Layers, FileOutput } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AdminPanel, AdminSectionHeader } from "./AdminShell";
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminPanel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">At download cap</p>
              <p className="text-3xl font-bold mt-1">{data.atDownloadCapToday}</p>
              <p className="text-xs text-muted-foreground mt-1">Free users who hit 3/3 today</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2 text-primary"><Download size={18} /></div>
          </div>
        </AdminPanel>
        <AdminPanel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active share links</p>
              <p className="text-3xl font-bold mt-1">{data.sharedLinksCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Projects with sharing enabled</p>
            </div>
            <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400"><Share2 size={18} /></div>
          </div>
        </AdminPanel>
        <AdminPanel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Near project limit</p>
              <p className="text-3xl font-bold mt-1">{data.nearProjectLimitUsers.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Free users with {data.freeProjectLimit - 1}+ saved cards</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400"><FolderOpen size={18} /></div>
          </div>
        </AdminPanel>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AdminPanel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Bulk generate (30d)</p>
              <p className="text-3xl font-bold mt-1">{data.bulkGenerateSessions30d}</p>
              <p className="text-xs text-muted-foreground mt-1">Pro bulk CSV runs</p>
            </div>
            <div className="rounded-xl bg-violet-500/10 p-2 text-violet-400"><Layers size={18} /></div>
          </div>
        </AdminPanel>
        <AdminPanel padding="lg">
          <AdminSectionHeader title="Export formats" description="Editor downloads by format" />
          {data.exportFormatBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-2">No exports recorded yet.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {data.exportFormatBreakdown.map(row => (
                <div key={row.format} className="flex items-center justify-between text-sm gap-2">
                  <span className="flex items-center gap-1.5 capitalize">
                    <FileOutput size={12} className="text-muted-foreground" />
                    {row.format.replace("export_", "").toUpperCase()}
                  </span>
                  <span className="text-muted-foreground">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>

      {data.nearProjectLimitUsers.length > 0 && (
        <AdminPanel padding="none">
          <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border/60">
            <AdminSectionHeader title="Users near free project limit" description="Conversion opportunities — offer Pro upgrade" />
          </div>
          <div className="divide-y divide-border/60">
            {data.nearProjectLimitUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className="text-xs font-semibold shrink-0 flex items-center gap-1 text-amber-400">
                  <Users size={12} /> {u.projectCount}/{data.freeProjectLimit}
                </span>
              </div>
            ))}
          </div>
        </AdminPanel>
      )}
    </div>
  );
}
