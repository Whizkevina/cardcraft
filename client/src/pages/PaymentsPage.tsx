import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../components/AuthProvider";
import Navbar from "../components/Navbar";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle, XCircle, Clock, Download, ArrowRight, Sparkles } from "lucide-react";
import { format } from "date-fns";
import type { Payment } from "@shared/schema";

const STATUS_CONFIG = {
  success: { label: "Paid", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  pending: { label: "Pending", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  failed:  { label: "Failed",  icon: XCircle,  color: "text-destructive",  bg: "bg-destructive/10" },
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
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <CreditCard size={40} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Sign in to view payments</h2>
          <Link href="/auth"><Button className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4">Sign In</Button></Link>
        </div>
      </div>
    );
  }

  const successPayments = payments.filter(p => p.status === "success");
  const totalPaid = successPayments.reduce((sum, p) => sum + (p.amount / 100), 0);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Boska', Georgia, serif" }}>Payment History</h1>
            <p className="text-muted-foreground text-sm">Your receipts and transaction records.</p>
          </div>
          {!isPro && (
            <Link href="/pricing">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                <Sparkles size={14} /> Upgrade to Pro
              </Button>
            </Link>
          )}
        </div>

        {/* Stats */}
        {successPayments.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Total Paid", value: `₦${totalPaid.toLocaleString()}` },
              { label: "Transactions", value: payments.length },
              { label: "Current Plan", value: isPro ? "Pro" : "Free" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-xl font-bold text-gold">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Transactions */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl">
            <CreditCard size={40} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No payments yet</h3>
            <p className="text-muted-foreground text-sm mb-5">Upgrade to Pro to unlock unlimited downloads.</p>
            <Link href="/pricing">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                <ArrowRight size={14} /> View Pricing
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map(p => {
              const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <div key={p.id} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4" data-testid={`row-payment-${p.id}`}>
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
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
