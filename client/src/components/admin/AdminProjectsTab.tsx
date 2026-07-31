import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, ExternalLink, Link2Off, Trash2, Share2, ChevronRight, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdminPanel, AdminSectionHeader } from "./AdminShell";
import type { AdminProject } from "./types";
import { sharePreviewUrl } from "./types";

export function AdminProjectsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sharedOnly, setSharedOnly] = useState(false);

  const queryKey = `/api/admin/projects?search=${search}&sharedOnly=${sharedOnly}`;

  const { data: projects = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (sharedOnly) params.set("sharedOnly", "true");
      const qs = params.toString();
      const res = await apiRequest("GET", `/api/admin/projects${qs ? `?${qs}` : ""}`);
      return res.json() as Promise<AdminProject[]>;
    },
  });

  const revokeShare = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("PATCH", `/api/admin/projects/${id}/revoke-share`);
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/ops-stats"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
      toast({ title: "Share link revoked" });
    },
    onError: () => toast({ title: "Could not revoke share", variant: "destructive" }),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("DELETE", `/api/admin/projects/${id}`);
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
      toast({ title: "Project deleted" });
    },
    onError: () => toast({ title: "Could not delete project", variant: "destructive" }),
  });

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (sharedOnly) params.set("sharedOnly", "true");
    const qs = params.toString();
    window.open(`/api/admin/projects/export${qs ? `?${qs}` : ""}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <AdminPanel>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by card title, user name, or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 text-sm bg-secondary/20 border-border/70"
            data-testid="input-project-search"
          />
        </div>
        <Button
          type="button"
          variant={sharedOnly ? "default" : "outline"}
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => setSharedOnly(v => !v)}
          data-testid="button-shared-only-filter"
        >
          <Share2 size={14} /> Shared only
        </Button>
      </AdminPanel>

      <AdminPanel padding="none">
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border/60">
          <AdminSectionHeader
            title="Saved cards"
            description={`${projects.length} project${projects.length !== 1 ? "s" : ""} · moderate shared content and support deletes`}
            action={
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={exportCsv} data-testid="button-export-projects-csv">
                <Download size={14} /> CSV
              </Button>
            }
          />
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
        ) : projects.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No projects match your filters.</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-secondary/30 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Card</th>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Template</th>
                    <th className="px-5 py-3 font-medium">Updated</th>
                    <th className="px-5 py-3 font-medium">Share</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/20" data-testid={`row-project-${p.id}`}>
                      <td className="px-5 py-3.5 font-medium">{p.title}</td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm">{p.userName}</p>
                        <p className="text-xs text-muted-foreground">{p.userEmail}</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{p.templateTitle ?? "—"}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {p.updatedAt ? format(new Date(p.updatedAt), "dd MMM yyyy") : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        {p.shareEnabled && p.shareToken ? (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">Live</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Off</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {p.shareEnabled && p.shareToken && (
                            <>
                              <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" asChild>
                                <a href={sharePreviewUrl(p.shareToken)} target="_blank" rel="noopener noreferrer" title="Open share preview">
                                  <ExternalLink size={14} />
                                </a>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                disabled={revokeShare.isPending}
                                onClick={() => revokeShare.mutate(p.id)}
                                title="Revoke share link"
                                data-testid={`button-revoke-share-${p.id}`}
                              >
                                <Link2Off size={14} />
                              </Button>
                            </>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            disabled={deleteProject.isPending}
                            onClick={() => {
                              if (confirm(`Delete "${p.title}" by ${p.userName}? This cannot be undone.`)) {
                                deleteProject.mutate(p.id);
                              }
                            }}
                            title="Delete project"
                            data-testid={`button-delete-project-${p.id}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-border/60">
              {projects.map(p => (
                <div key={p.id} className="p-4 space-y-2" data-testid={`row-project-${p.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.userName} · {p.userEmail}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {p.templateTitle ? `${p.templateTitle} · ` : ""}
                    {p.updatedAt ? format(new Date(p.updatedAt), "dd MMM yyyy") : "—"}
                    {p.shareEnabled ? " · Shared" : ""}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {p.shareEnabled && p.shareToken && (
                      <>
                        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" asChild>
                          <a href={sharePreviewUrl(p.shareToken)} target="_blank" rel="noopener noreferrer">Preview</a>
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => revokeShare.mutate(p.id)}>Revoke</Button>
                      </>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs"
                      onClick={() => {
                        if (confirm(`Delete "${p.title}"?`)) deleteProject.mutate(p.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </AdminPanel>
    </div>
  );
}
