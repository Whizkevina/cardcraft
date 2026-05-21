import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Database, Mail, CreditCard, Webhook, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { AdminHealth } from "./types";

function HealthPill({
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
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
      ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"
    }`}>
      <Icon size={14} className="shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        {detail && <p className="text-[10px] opacity-80 truncate">{detail}</p>}
      </div>
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
    return <div className="h-12 skeleton rounded-xl mb-6" />;
  }

  const webhookDetail = data.webhookLast
    ? `${data.webhookLast.status} · ${format(new Date(data.webhookLast.at), "dd MMM HH:mm")}`
    : "No webhook received yet";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-6" data-testid="admin-health-strip">
      <HealthPill label="Database" ok={data.db} icon={Database} />
      <HealthPill label="Email (SMTP)" ok={data.emailConfigured} detail={data.emailConfigured ? "Configured" : "Not configured"} icon={Mail} />
      <HealthPill label="Paystack" ok={data.paystackConfigured} detail={data.paystackConfigured ? "Keys set" : "Missing keys"} icon={CreditCard} />
      <HealthPill label="Webhook" ok={!!data.webhookLast} detail={webhookDetail} icon={Webhook} />
      <HealthPill
        label="Server errors (24h)"
        ok={data.serverErrors24h === 0}
        detail={data.serverErrors24h === 0 ? "None" : `${data.serverErrors24h} error(s)`}
        icon={AlertTriangle}
      />
    </div>
  );
}
