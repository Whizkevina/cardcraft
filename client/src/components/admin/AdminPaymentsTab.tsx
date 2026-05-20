import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminPayment } from "./types";
import { formatKobo } from "./types";

export function AdminPaymentsTab() {
  const [status, setStatus] = useState<string>("all");
  const [email, setEmail] = useState("");

  const queryKey = `/api/admin/payments?${status !== "all" ? `status=${status}&` : ""}${email ? `email=${encodeURIComponent(email)}` : ""}`;

  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (email.trim()) params.set("email", email.trim());
      const qs = params.toString();
      const res = await apiRequest("GET", `/api/admin/payments${qs ? `?${qs}` : ""}`);
      return res.json() as Promise<{ payments: AdminPayment[]; revenueThisMonth: number }>;
    },
  });

  const payments = data?.payments ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by user email…"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="pl-9 h-9 text-sm"
              data-testid="input-payment-email-filter"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm" data-testid="select-payment-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {data && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CreditCard size={12} className="text-gold" />
            This month: <span className="font-semibold text-foreground">{formatKobo(data.revenueThisMonth)}</span>
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No payments match your filters.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium hidden md:table-cell">Reference</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/20" data-testid={`row-payment-${p.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs truncate max-w-[140px]">{p.userName}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{p.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">{formatKobo(p.amount, p.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                        p.status === "success" ? "bg-green-500/15 text-green-600" :
                        p.status === "failed" ? "bg-destructive/15 text-destructive" :
                        "bg-secondary text-muted-foreground"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground hidden md:table-cell font-mono truncate max-w-[180px]">
                      {p.reference}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground whitespace-nowrap">
                      {p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
