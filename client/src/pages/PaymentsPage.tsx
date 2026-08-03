import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../components/AuthProvider";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { AppPageHeader } from "@/components/marketing/AppPageHeader";
import { SurfaceCard } from "@/components/marketing/SurfaceCard";
import { EmptyState } from "@/components/marketing/EmptyState";
import { hp, hpCn } from "@/components/marketing/homeTokens";
import { CreditCard, CheckCircle, XCircle, Clock, ArrowRight, Sparkles } from "lucide-react";
import { format } from "date-fns";
import type { Payment } from "@shared/schema";

const STATUS_CONFIG = {
  success: { label: "Paid", icon: CheckCircle, color: "text-primary", bg: "bg-primary/10" },
  pending: { label: "Pending", icon: Clock, color: "text-pending", bg: "bg-pending/10" },
  failed: { label: "Failed", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

export default function PaymentsPage() {
  const { user, isPro } = useAuth();

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments/my"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/payments/my");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <MarketingPageShell>
        <MarketingSection spacing="default" containerClassName="max-w-lg mx-auto px-4 sm:px-6">
          <EmptyState
            icon={CreditCard}
            title="Sign in to view payments"
            description="Your receipts and transaction history are available after you sign in."
            actions={[{ label: "Sign In", href: "/auth" }]}
          />
        </MarketingSection>
      </MarketingPageShell>
    );
  }

  const successPayments = payments.filter(p => p.status === "success");
  const totalPaid = successPayments.reduce((sum, p) => sum + (p.amount / 100), 0);

  return (
    <MarketingPageShell>
      <MarketingSection spacing="default" containerClassName="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <AppPageHeader
          eyebrow="Billing"
          title="Payment history"
          description="Your receipts and transaction records."
          action={
            !isPro ? (
              <Link href="/pricing">
                <Button size="sm" className={hp.btnPrimary}>
                  <Sparkles size={14} /> Upgrade to Pro
                </Button>
              </Link>
            ) : undefined
          }
        />

        {successPayments.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Total Paid", value: `₦${totalPaid.toLocaleString()}` },
              { label: "Transactions", value: payments.length },
              { label: "Current Plan", value: isPro ? "Pro" : "Free" },
            ].map(s => (
              <SurfaceCard key={s.label} variant="raised" className="p-4 text-center">
                <p className="text-xl font-bold text-gold">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </SurfaceCard>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}
          </div>
        ) : payments.length === 0 ? (
          <SurfaceCard variant="inset" className="p-10 text-center">
            <CreditCard size={40} className="mx-auto text-muted-foreground mb-4" />
            <h3 className={hpCn(hp.display, "text-lg mb-2")}>No payments yet</h3>
            <p className={hpCn(hp.lead, "text-sm mb-5")}>Upgrade to Pro to unlock unlimited downloads.</p>
            <Link href="/pricing">
              <Button className={hp.btnPrimary}>
                <ArrowRight size={14} /> View Pricing
              </Button>
            </Link>
          </SurfaceCard>
        ) : (
          <div className="space-y-3">
            {payments.map(p => {
              const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <SurfaceCard key={p.id} variant="raised" className="p-5 flex items-center gap-4" testId={`row-payment-${p.id}`}>
                  <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm capitalize">{p.plan.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      Ref: <span className="font-mono">{p.reference}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy, h:mm a") : "—"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm">₦{(p.amount / 100).toLocaleString()}</p>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} mt-1`}>
                      {cfg.label}
                    </span>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        )}
      </MarketingSection>
    </MarketingPageShell>
  );
}
