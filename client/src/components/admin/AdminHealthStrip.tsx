import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Database, Mail, CreditCard, Webhook, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { AdminHealth } from "./types";

function HealthChip({
  label,
  ok,
  detail,
  icon: Icon,
}: {
  label: string;
  ok: boolean;
  detail?: string;
  icon: typeof Database;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 min-w-0",
        ok
          ? "border-emerald-500/25 bg-emerald-500/5"
          : "border-amber-500/25 bg-amber-500/5",
      )}
    >
      <Icon
        size={13}
        className={cn("shrink-0", ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium leading-none truncate">{label}</p>
        {detail && (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{detail}</p>
        )}
      </div>
      <span
        className={cn(
          "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0",
          ok
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        )}
      >
        {ok ? "OK" : "Warn"}
      </span>
    </div>
  );
}

export function AdminHealthStrip() {
  const { data } = useQuery({
    queryKey: ["/api/admin/health"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/health");
      return res.json() as Promise<AdminHealth>;
    },
    refetchInterval: 60_000,
  });

  if (!data) {
    return <div className="h-10 skeleton rounded-lg mb-4" />;
  }

  const webhookDetail = data.webhookLast
    ? `${data.webhookLast.status} · ${format(new Date(data.webhookLast.at), "dd MMM HH:mm")}`
    : "No webhook yet";

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4"
      data-testid="admin-health-strip"
    >
      <HealthChip label="Database" ok={data.db} icon={Database} />
      <HealthChip
        label="Email"
        ok={data.emailConfigured}
        detail={data.emailConfigured ? "SMTP configured" : "Not configured"}
        icon={Mail}
      />
      <HealthChip
        label="Paystack"
        ok={data.paystackConfigured}
        detail={data.paystackConfigured ? "Keys set" : "Missing keys"}
        icon={CreditCard}
      />
      <HealthChip label="Webhook" ok={!!data.webhookLast} detail={webhookDetail} icon={Webhook} />
      <HealthChip
        label="Errors (24h)"
        ok={data.serverErrors24h === 0}
        detail={data.serverErrors24h === 0 ? "None" : `${data.serverErrors24h} logged`}
        icon={AlertTriangle}
      />
    </div>
  );
}
