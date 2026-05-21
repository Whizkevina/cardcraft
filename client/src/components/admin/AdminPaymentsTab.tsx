import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPanel, AdminSectionHeader } from "./AdminShell";
import type { AdminPayment } from "./types";
import { formatKobo } from "./types";

function PaymentStatusBadge({ status }: { status: AdminPayment["status"] }) {
  return (
    <span className={`text-[10px] px-2 py-1 rounded-full font-semibold capitalize ${
      status === "success" ? "bg-emerald-500/15 text-emerald-400" :
      status === "failed" ? "bg-destructive/15 text-destructive" :
      "bg-secondary text-muted-foreground"
    }`}>
      {status}
    </span>
  );
}

function RefundNoteCell({ payment, fullWidth = false }: { payment: AdminPayment; fullWidth?: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(payment.refundNote ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PATCH", `/api/admin/payments/${payment.id}/refund-note`, { refundNote: note.trim() || null });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
      setEditing(false);
      toast({ title: "Refund note saved" });
    },
    onError: () => toast({ title: "Could not save note", variant: "destructive" }),
  });

  if (!editing) {
    return (
      <button
        type="button"
        className={`text-left text-xs text-muted-foreground hover:text-foreground truncate ${fullWidth ? "max-w-full w-full" : "max-w-[140px]"}`}
        onClick={() => { setNote(payment.refundNote ?? ""); setEditing(true); }}
        title={payment.refundNote ?? "Add refund note"}
        data-testid={`button-refund-note-${payment.id}`}
      >
        {payment.refundNote || "Add note…"}
      </button>
    );
  }

  return (
    <div className={`flex gap-2 items-center ${fullWidth ? "w-full" : "min-w-[160px]"}`}>
      <Input
        value={note}
        onChange={e => setNote(e.target.value)}
        className="h-8 text-xs flex-1 bg-secondary/20"
        placeholder="Refund note"
        autoFocus
        data-testid={`input-refund-note-${payment.id}`}
      />
      <Button size="sm" className="h-8 px-3 text-xs shrink-0" disabled={save.isPending} onClick={() => save.mutate()}>Save</Button>
    </div>
  );
}

function PaymentCard({ payment }: { payment: AdminPayment }) {
  return (
    <div className="px-4 py-4 sm:px-5 border-b border-border/60 last:border-b-0" data-testid={`row-payment-${payment.id}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{payment.userName}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{payment.userEmail}</p>
        </div>
        <p className="font-bold text-sm shrink-0">{formatKobo(payment.amount, payment.currency)}</p>
      </div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <PaymentStatusBadge status={payment.status} />
        <span className="text-xs text-muted-foreground">
          {payment.createdAt ? format(new Date(payment.createdAt), "dd MMM yyyy") : "—"}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground font-mono truncate mb-2">{payment.reference}</p>
      <div className="rounded-lg bg-secondary/20 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Refund note</p>
        <RefundNoteCell payment={payment} fullWidth />
      </div>
    </div>
  );
}

export function AdminPaymentsTab() {
  const [status, setStatus] = useState<string>("all");
  const [email, setEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const queryKey = `/api/admin/payments?status=${status}&email=${email}&from=${from}&to=${to}`;

  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (email.trim()) params.set("email", email.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      const res = await apiRequest("GET", `/api/admin/payments${qs ? `?${qs}` : ""}`);
      return res.json() as Promise<{ payments: AdminPayment[]; revenueThisMonth: number }>;
    },
  });

  const payments = data?.payments ?? [];

  return (
    <div className="space-y-4">
      <AdminPanel>
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Filter by user email…"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="pl-10 h-11 text-sm bg-secondary/20 border-border/70"
            data-testid="input-payment-email-filter"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10 text-sm bg-secondary/20" data-testid="select-payment-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <div className="space-y-1.5">
            <Label htmlFor="payment-from" className="text-xs text-muted-foreground">From</Label>
            <Input id="payment-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-10 text-sm bg-secondary/20" data-testid="input-payment-from" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-to" className="text-xs text-muted-foreground">To</Label>
            <Input id="payment-to" type="date" value={to} onChange={e => setTo(e.target.value)} className="h-10 text-sm bg-secondary/20" data-testid="input-payment-to" />
          </div>
        </div>
        {(from || to) && (
          <Button type="button" variant="ghost" size="sm" className="mt-3 h-9" onClick={() => { setFrom(""); setTo(""); }}>
            Clear dates
          </Button>
        )}
        {data && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
            <CreditCard size={16} className="text-primary shrink-0" />
            <p className="text-sm">
              Revenue this month: <span className="font-bold">{formatKobo(data.revenueThisMonth)}</span>
            </p>
          </div>
        )}
      </AdminPanel>

      <AdminPanel padding="none">
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border/60">
          <AdminSectionHeader title="Transactions" description={`${payments.length} payment${payments.length !== 1 ? "s" : ""} matching filters`} />
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
        ) : payments.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No payments match your filters.</div>
        ) : (
          <>
            <div className="md:hidden">
              {payments.map(p => <PaymentCard key={p.id} payment={p} />)}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-secondary/30 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium hidden lg:table-cell">Refund note</th>
                    <th className="px-5 py-3 font-medium">Reference</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/20" data-testid={`row-payment-${p.id}`}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-sm truncate max-w-[160px]">{p.userName}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{p.userEmail}</p>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold whitespace-nowrap">{formatKobo(p.amount, p.currency)}</td>
                      <td className="px-5 py-4"><PaymentStatusBadge status={p.status} /></td>
                      <td className="px-5 py-4 hidden lg:table-cell"><RefundNoteCell payment={p} /></td>
                      <td className="px-5 py-4 text-xs text-muted-foreground font-mono truncate max-w-[180px]">{p.reference}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AdminPanel>
    </div>
  );
}
