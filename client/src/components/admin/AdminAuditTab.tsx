import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, ScrollText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import type { AdminAuditEntry } from "./types";
import { auditActionLabel } from "./types";

function formatMeta(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const parts: string[] = [];
  if (meta.from != null && meta.to != null) parts.push(`${meta.from} → ${meta.to}`);
  if (meta.email) parts.push(String(meta.email));
  if (meta.title) parts.push(`"${meta.title}"`);
  if (meta.reason) parts.push(`note: ${meta.reason}`);
  return parts.join(" · ");
}

export function AdminAuditTab() {
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["/api/admin/audit-log"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/audit-log");
      return res.json() as Promise<AdminAuditEntry[]>;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(l =>
      auditActionLabel(l.action).toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      (l.actorName?.toLowerCase().includes(q)) ||
      formatMeta(l.meta).toLowerCase().includes(q)
    );
  }, [logs, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search activity…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
          data-testid="input-audit-search"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 skeleton rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center flex flex-col items-center gap-2">
          <ScrollText size={24} className="opacity-40" />
          {logs.length === 0 ? "No admin actions logged yet." : "No matching activity."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => (
            <div
              key={entry.id}
              className="rounded-xl border border-border bg-card px-4 py-3"
              data-testid={`row-audit-${entry.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{auditActionLabel(entry.action)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {entry.actorName ?? `Admin #${entry.actorId}`}
                    {entry.targetId != null && ` · ${entry.targetType} #${entry.targetId}`}
                  </p>
                  {entry.meta && (
                    <p className="text-[10px] text-muted-foreground mt-1">{formatMeta(entry.meta)}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  {entry.createdAt ? format(new Date(entry.createdAt), "dd MMM · HH:mm") : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
