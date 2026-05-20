import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "../components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/marketing/PageHeader";
import { PricingCard } from "@/components/marketing/PricingCard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, Sparkles, Zap, Crown, Loader2, Lock } from "lucide-react";
import { usePricingQuote } from "@/hooks/usePricingQuote";

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
              toast({ title: "🎉 Welcome to Pro!", description: "Your account is now upgraded. Unlimited downloads, no watermark." });
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
    <div className="min-h-screen">
      <Navbar />
      <main className="relative max-w-4xl mx-auto px-4 sm:px-6 py-14 section-glow">
        <PageHeader
          badge={{ icon: Sparkles, label: "Simple, honest pricing" }}
          title="Pay once. Use forever."
          description={
            <>
              No subscriptions, no recurring fees. Pay {quote.proPrice.formatted} once and get unlimited access for life.
              {quote.approximate ? (
                <span className="block text-xs mt-3" data-testid="pricing-fx-disclaimer">
                  Price shown in {quote.currency} for your region. Checkout charges {quote.charge.formatted} via Paystack; your bank may apply its own exchange rate.
                </span>
              ) : null}
            </>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <PricingCard
            name="Free"
            price={quote.freePrice.formatted}
            subtitle="Always free"
            features={FREE_FEATURES}
            checkMuted
            priceTestId="price-free"
            footer={
              !user ? (
                <Link href="/auth">
                  <Button variant="outline" className="w-full h-11">Get Started Free</Button>
                </Link>
              ) : (
                <Button variant="outline" className="w-full h-11" disabled>
                  {isPro ? "Current: Pro Plan" : "Current Plan"}
                </Button>
              )
            }
          />

          <PricingCard
            name="Pro — Lifetime"
            price={quote.proPrice.formatted}
            subtitle="Pay once, use forever. No subscription."
            features={PRO_FEATURES}
            highlighted
            priceTestId="price-pro"
            badge={
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-premium">
                <Crown size={10} /> Most Popular
              </div>
            }
            footer={
              isPro ? (
                <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-medium">
                  <Sparkles size={15} /> You're on Pro — all features unlocked
                </div>
              ) : (
                <>
                  <Button
                    onClick={handleUpgrade}
                    disabled={paying || isLoading}
                    className="w-full gap-2 btn-gold h-11 text-sm font-semibold"
                    data-testid="button-upgrade-pro"
                  >
                    {paying
                      ? <><Loader2 size={15} className="animate-spin" /> Processing...</>
                      : <><Zap size={15} /> Upgrade to Pro — {quote.proPrice.formatted}</>
                    }
                  </Button>
                  {!user && (
                    <p className="text-center text-xs text-muted-foreground mt-3">
                      <Link href="/auth" className="text-primary hover:underline">Sign in</Link> to pay
                    </p>
                  )}
                </>
              )
            }
          />
        </div>

        <div className="mt-12 text-center space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Lock size={11} className="text-gold" /> Secured by Paystack</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={11} className="text-gold" /> Instant upgrade after payment</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={11} className="text-gold" /> No recurring charges</span>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Pay with Mastercard, Visa, Verve, bank transfer, or USSD.
            Questions? Contact <a href="mailto:support@cardcraft.app" className="text-primary hover:underline">support@cardcraft.app</a>
          </p>
        </div>
      </main>
    </div>
  );
}
