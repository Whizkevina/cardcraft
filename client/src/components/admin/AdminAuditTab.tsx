import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, ScrollText, ChevronRight, Download, ChevronLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPanel, AdminSectionHeader } from "./AdminShell";
import { AdminAuditDetailDialog } from "./AdminAuditDetailDialog";
import type { AdminAuditEntry, AdminAuditLogResponse } from "./types";
import { auditActionLabel, auditActorLabel, auditSeverityTone, auditTargetLabel } from "./types";

const PAGE_SIZE = 50;

export function AdminAuditTab() {
  const [search, setSearch] = useState("");
  const [actorRole, setActorRole] = useState("all");
  const [action, setAction] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminAuditEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const queryKey = `/api/admin/audit-log?${search}&${actorRole}&${action}&${severity}&${from}&${to}&${page}`;

  const { data, isLoading, isError } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (actorRole !== "all") params.set("actorRole", actorRole);
      if (action !== "all") params.set("action", action);
      if (severity !== "all") params.set("severity", severity);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      const res = await apiRequest("GET", `/api/admin/audit-log?${params}`);
      return res.json() as Promise<AdminAuditLogResponse>;
    },
  });

  const logs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const actionOptions = useMemo(() => {
    const set = new Set(logs.map(l => l.action));
    return Array.from(set).sort();
  }, [logs]);

  const exportLogs = async (format: "csv" | "json") => {
    const params = new URLSearchParams({ format });
    if (search.trim()) params.set("search", search.trim());
    if (actorRole !== "all") params.set("actorRole", actorRole);
    if (action !== "all") params.set("action", action);
    if (severity !== "all") params.set("severity", severity);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    window.open(`/api/admin/audit-log/export?${params}`, "_blank");
  };

  const openDetail = (entry: AdminAuditEntry) => {
    setSelected(entry);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <AdminPanel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search user, action, page…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-10 h-11 text-sm bg-secondary/20 border-border/70"
              data-testid="input-audit-search"
            />
          </div>
          <Select value={actorRole} onValueChange={v => { setActorRole(v); setPage(0); }}>
            <SelectTrigger className="h-11 bg-secondary/20" data-testid="select-audit-role">
              <SelectValue placeholder="Actor role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="guest">Guests</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={v => { setSeverity(v); setPage(0); }}>
            <SelectTrigger className="h-11 bg-secondary/20" data-testid="select-audit-severity">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severity</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={v => { setAction(v); setPage(0); }}>
            <SelectTrigger className="h-11 bg-secondary/20" data-testid="select-audit-action">
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionOptions.map(a => (
                <SelectItem key={a} value={a}>{auditActionLabel(a)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex flex-1 gap-2">
            <Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(0); }} className="h-10 text-sm bg-secondary/20" aria-label="From date" />
            <Input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(0); }} className="h-10 text-sm bg-secondary/20" aria-label="To date" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-10 gap-1.5" onClick={() => exportLogs("csv")} data-testid="button-export-audit-csv">
              <Download size={14} /> CSV
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-10 gap-1.5" onClick={() => exportLogs("json")}>
              <Download size={14} /> JSON
            </Button>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel padding="none">
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <AdminSectionHeader
            title="Audit trail"
            description={`${total.toLocaleString()} events · masked IPs · tamper-evident hashes`}
          />
          <p className="text-[11px] text-muted-foreground">Admin-only · retention per policy</p>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 skeleton rounded-lg" />)}</div>
        ) : isError ? (
          <div className="py-14 text-center text-sm text-destructive">Could not load audit log.</div>
        ) : logs.length === 0 ? (
          <div className="py-14 text-center">
            <ScrollText size={28} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">No events match your filters</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-secondary/30 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Timestamp</th>
                    <th className="px-5 py-3 font-medium">Severity</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                    <th className="px-5 py-3 font-medium">Originated by</th>
                    <th className="px-5 py-3 font-medium">Target / Page</th>
                    <th className="px-5 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {logs.map(entry => (
                    <tr
                      key={entry.id}
                      className="border-b border-border/60 last:border-0 hover:bg-secondary/25 cursor-pointer transition-colors"
                      onClick={() => openDetail(entry)}
                      data-testid={`row-audit-${entry.id}`}
                    >
                      <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {entry.createdAt ? format(new Date(entry.createdAt), "dd MMM yyyy · HH:mm:ss") : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${auditSeverityTone(entry.severity)}`}>
                          {entry.severity ?? "info"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-sm">{auditActionLabel(entry.action)}</span>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{entry.action}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm">{auditActorLabel(entry)}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">
                        <p>{auditTargetLabel(entry)}</p>
                        {entry.pagePath && <p className="text-[10px] font-mono truncate max-w-[180px]">{entry.pagePath}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-border/60">
              {logs.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  className="w-full text-left px-4 py-4 hover:bg-secondary/25 transition-colors flex items-start gap-3"
                  onClick={() => openDetail(entry)}
                  data-testid={`row-audit-${entry.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{auditActionLabel(entry.action)}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase ${auditSeverityTone(entry.severity)}`}>{entry.severity}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{auditActorLabel(entry)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {entry.createdAt ? format(new Date(entry.createdAt), "dd MMM · HH:mm") : "—"}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />
                </button>
              ))}
            </div>
          </>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-border/60">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages} · {total.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </AdminPanel>

      <AdminAuditDetailDialog
        entry={selected}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
