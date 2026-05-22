import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "../components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { PageHeader } from "@/components/marketing/PageHeader";
import { PricingCard } from "@/components/marketing/PricingCard";
import { SurfaceCard } from "@/components/marketing/SurfaceCard";
import { hp, hpCn } from "@/components/marketing/homeTokens";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, Sparkles, Zap, Crown, Loader2, Lock } from "lucide-react";
import { usePricingQuote } from "@/hooks/usePricingQuote";
import { useCtaTracking } from "@/hooks/useTelemetry";

const FREE_FEATURES = [
  "All free templates",
  "Full canvas editor",
  "Photo upload & bg removal",
  "QR code layer",
  "3 downloads per day",
  "CardCraft watermark on exports",
  "Save up to 5 cards",
  "Email delivery (sign in required)",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited downloads — no cap",
  "No watermark on exports",
  "Unlimited saved cards",
  "Bulk card generator (CSV upload)",
  "Lifetime access — pay once",
];

declare global {
  interface Window {
    PaystackPop: any;
  }
}

export default function PricingPage() {
  const { user, isPro, isLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { quote } = usePricingQuote();
  const trackCta = useCtaTracking();
  const [paying, setPaying] = useState(false);

  const loadPaystackScript = (): Promise<void> => {
    return new Promise(resolve => {
      if (window.PaystackPop) { resolve(); return; }
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  };

  const handleUpgrade = async () => {
    trackCta("pricing_upgrade_pro");
    if (!user) {
      toast({ title: "Sign in first", description: "Create a free account to upgrade to Pro.", variant: "destructive" });
      return;
    }

    setPaying(true);
    try {
      const res = await apiRequest("POST", "/api/payments/initialize");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Could not initialize payment");
      }
      const { reference, publicKey, amount, email } = await res.json();

      await loadPaystackScript();

      const handler = window.PaystackPop.setup({
        key: publicKey,
        email,
        amount: amount * 100,
        ref: reference,
        currency: "NGN",
        metadata: { custom_fields: [{ display_name: "Plan", variable_name: "plan", value: "CardCraft Pro Lifetime" }] },
        onClose: () => {
          setPaying(false);
          toast({ title: "Payment window closed", description: "Your account was not upgraded." });
        },
        callback: async (response: any) => {
          try {
            const verifyRes = await apiRequest("POST", "/api/payments/confirm", { reference: response.reference });
            const data = await verifyRes.json();
            if (data.success) {
              qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
              toast({ title: "Welcome to Pro", description: "Unlimited downloads and no watermark are now active." });
            } else {
              toast({ title: "Payment received", description: "Verification pending. Refresh in a moment.", variant: "destructive" });
            }
          } catch {
            toast({ title: "Verify manually", description: "Contact support with reference: " + response.reference });
          } finally {
            setPaying(false);
          }
        },
      });
      handler.openIframe();
    } catch (e: any) {
      setPaying(false);
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <MarketingPageShell>
      <MarketingSection spacing="default" tone="grid">
        <PageHeader
          eyebrow="Pricing"
          title="Pay once. Use forever."
          description={
            <>
              No subscriptions. One {quote.proPrice.formatted} payment unlocks Pro for life.
              {quote.approximate ? (
                <span className="block text-xs mt-3 text-muted-foreground" data-testid="pricing-fx-disclaimer">
                  Price shown in {quote.currency} for your region. Checkout charges {quote.charge.formatted} via Paystack.
                </span>
              ) : null}
            </>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          <PricingCard
            name="Free"
            price={quote.freePrice.formatted}
            subtitle="Always free"
            features={FREE_FEATURES}
            checkMuted
            priceTestId="price-free"
            footer={
              !user ? (
                <Link href="/auth" onClick={() => trackCta("pricing_get_started_free")}>
                  <Button variant="outline" className={hpCn(hp.btnSecondary, "w-full")}>Get started free</Button>
                </Link>
              ) : (
                <Button variant="outline" className={hpCn(hp.btnSecondary, "w-full")} disabled>
                  {isPro ? "Current: Pro" : "Current plan"}
                </Button>
              )
            }
          />

          <PricingCard
            name="Pro — Lifetime"
            price={quote.proPrice.formatted}
            subtitle="One payment · no subscription"
            features={PRO_FEATURES}
            highlighted
            priceTestId="price-pro"
            badge={
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide">
                <Crown size={10} /> Recommended
              </div>
            }
            footer={
              isPro ? (
                <div className="w-full flex items-center justify-center gap-2 py-3 rounded-lg hp-surface-inset text-sm font-medium text-gold">
                  <Sparkles size={15} /> Pro active — all features unlocked
                </div>
              ) : (
                <>
                  <Button
                    onClick={handleUpgrade}
                    disabled={paying || isLoading}
                    className={hpCn(hp.btnPrimary, "w-full")}
                    data-testid="button-upgrade-pro"
                  >
                    {paying
                      ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
                      : <><Zap size={15} /> Upgrade — {quote.proPrice.formatted}</>
                    }
                  </Button>
                  {!user && (
                    <p className="text-center text-xs text-muted-foreground mt-3">
                      <Link href="/auth" className="text-gold hover:underline">Sign in</Link> to pay
                    </p>
                  )}
                </>
              )
            }
          />
        </div>

        <SurfaceCard variant="inset" className="mt-10 p-5 sm:p-6 max-w-2xl mx-auto text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground mb-3">
            <span className="inline-flex items-center gap-1.5"><Lock size={11} className="text-gold" /> Secured by Paystack</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle size={11} className="text-gold" /> Instant upgrade</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle size={11} className="text-gold" /> No recurring charges</span>
          </div>
          <p className={hpCn(hp.lead, "text-xs")}>
            Pay with card, bank transfer, or USSD. Questions?{" "}
            <a href="mailto:support@cardcraft.app" className="text-gold hover:underline">support@cardcraft.app</a>
          </p>
        </SurfaceCard>
      </MarketingSection>
    </MarketingPageShell>
  );
}
