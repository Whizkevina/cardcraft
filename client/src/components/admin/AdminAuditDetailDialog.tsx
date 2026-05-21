import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminAuditEntry } from "./types";
import { auditActionLabel, auditActorLabel, auditTargetLabel } from "./types";

function SummaryRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-border/50 last:border-0 text-sm">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}

function buildSummaryRows(entry: AdminAuditEntry): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const meta = entry.meta ?? {};

  if (meta.from != null && meta.to != null) rows.push({ label: "Change", value: `${meta.from} → ${meta.to}` });
  if (meta.method) rows.push({ label: "Method", value: String(meta.method) });
  if (meta.authProvider) rows.push({ label: "Auth provider", value: String(meta.authProvider) });
  if (meta.email) rows.push({ label: "Email", value: String(meta.email) });
  if (meta.title) rows.push({ label: "Title", value: String(meta.title) });
  if (meta.reference) rows.push({ label: "Reference", value: String(meta.reference) });
  if (meta.reason) rows.push({ label: "Note", value: String(meta.reason) });
  if (meta.refundNote) rows.push({ label: "Refund note", value: String(meta.refundNote) });
  if (meta.theme) rows.push({ label: "Theme", value: String(meta.theme) });
  if (meta.tier) rows.push({ label: "Tier", value: String(meta.tier) });
  if (meta.downloadsToday != null) rows.push({ label: "Downloads today", value: String(meta.downloadsToday) });
  if (meta.proExpiresAt) rows.push({ label: "Pro expires", value: String(meta.proExpiresAt).slice(0, 10) });
  if (meta.sessionsDestroyed != null) rows.push({ label: "Sessions cleared", value: String(meta.sessionsDestroyed) });
  if (meta.to && entry.action === "email.send_card") rows.push({ label: "Recipient", value: String(meta.to) });
  if (meta.cardTitle) rows.push({ label: "Card title", value: String(meta.cardTitle) });
  if (meta.source) rows.push({ label: "Source", value: String(meta.source) });
  if (meta.simulated) rows.push({ label: "Simulated", value: "Yes" });

  for (const [key, val] of Object.entries(meta)) {
    if (["from", "to", "method", "authProvider", "email", "title", "reference", "reason", "refundNote", "theme", "tier", "downloadsToday", "proExpiresAt", "sessionsDestroyed", "cardTitle", "source", "simulated"].includes(key)) continue;
    if (val == null || val === "") continue;
    rows.push({ label: key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()), value: typeof val === "object" ? JSON.stringify(val) : String(val) });
  }

  return rows;
}

interface AdminAuditDetailDialogProps {
  entry: AdminAuditEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminAuditDetailDialog({ entry, open, onOpenChange }: AdminAuditDetailDialogProps) {
  const [tab, setTab] = useState("summary");

  if (!entry) return null;

  const summaryRows = buildSummaryRows(entry);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <DialogTitle className="text-lg font-semibold">Detailed Log</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-1 overflow-y-auto flex-1">
          <SummaryRow label="Timestamp" value={entry.createdAt ? format(new Date(entry.createdAt), "dd-MM-yy HH:mm:ss") : "—"} />
          <SummaryRow label="Action" value={auditActionLabel(entry.action)} />
          <SummaryRow label="Object type" value={entry.targetType} />
          <SummaryRow label="Target" value={auditTargetLabel(entry)} />
          <SummaryRow label="Originated by" value={auditActorLabel(entry)} />
          {entry.severity && <SummaryRow label="Severity" value={entry.severity} />}
          {entry.pagePath && <SummaryRow label="Page" value={entry.pagePath} />}
          {entry.referrer && <SummaryRow label="Referrer" value={entry.referrer} />}
          {entry.sessionId && <SummaryRow label="Session" value={entry.sessionId.slice(0, 16) + "…"} />}
          {entry.userAgent && <SummaryRow label="User agent" value={entry.userAgent} />}
          {entry.beforeValue && entry.afterValue && (
            <SummaryRow label="Change" value={`${entry.beforeValue} → ${entry.afterValue}`} />
          )}
          {entry.ipAddress && <SummaryRow label="IP (masked)" value={entry.ipAddress} />}
          {entry.integrityHash && <SummaryRow label="Integrity hash" value={entry.integrityHash.slice(0, 24) + "…"} />}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="px-6 pb-2">
          <TabsList className="w-full justify-start h-9 p-0 bg-transparent border-b border-border/60 rounded-none">
            <TabsTrigger value="summary" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 text-sm">
              Summary
            </TabsTrigger>
            <TabsTrigger value="raw" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 text-sm">
              Raw
            </TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-0 pt-3 max-h-48 overflow-y-auto">
            {summaryRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No additional details recorded.</p>
            ) : (
              summaryRows.map(row => <SummaryRow key={row.label} label={row.label} value={row.value} />)
            )}
          </TabsContent>
          <TabsContent value="raw" className="mt-0 pt-3">
            <pre className="text-xs bg-secondary/30 border border-border/60 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto font-mono">
              {JSON.stringify({ ...entry, meta: entry.meta }, null, 2)}
            </pre>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t border-border/60">
          <Button onClick={() => onOpenChange(false)}>Ok</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
