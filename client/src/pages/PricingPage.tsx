import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "../components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, Sparkles, Zap, Crown, Loader2, Lock } from "lucide-react";

const FREE_FEATURES = [
  "All 20 card templates",
  "Full canvas editor",
  "Photo upload & bg removal",
  "QR code layer",
  "3 downloads per day",
  "CardCraft watermark on exports",
  "Save up to 5 cards",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited downloads — no cap",
  "No watermark on exports",
  "Priority support",
  "Early access to new templates",
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
      // 1. Initialize payment on backend → get reference + public key
      const res = await apiRequest("POST", "/api/payments/initialize");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Could not initialize payment");
      }
      const { reference, publicKey, amount, email } = await res.json();

      // 2. Load Paystack inline popup
      await loadPaystackScript();

      const handler = window.PaystackPop.setup({
        key: publicKey,
        email,
        amount: amount * 100, // kobo
        ref: reference,
        currency: "NGN",
        metadata: { custom_fields: [{ display_name: "Plan", variable_name: "plan", value: "CardCraft Pro Lifetime" }] },
        onClose: () => {
          setPaying(false);
          toast({ title: "Payment window closed", description: "Your account was not upgraded." });
        },
        callback: async (response: any) => {
          // 3. Confirm payment with backend
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-xs font-medium text-gold mb-4">
            <Sparkles size={11} /> Simple, honest pricing
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ fontFamily: "'Boska', Georgia, serif" }}>
            Pay once. Use forever.
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            No subscriptions, no recurring fees. Pay ₦10,000 once and get unlimited access for life.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

          {/* Free */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="mb-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">Free</p>
              <p className="text-4xl font-bold">₦0</p>
              <p className="text-xs text-muted-foreground mt-1">Always free</p>
            </div>
            <ul className="space-y-2.5 mb-6">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle size={14} className="text-muted-foreground/50 mt-0.5 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            {!user ? (
              <Link href="/auth">
                <Button variant="outline" className="w-full">Get Started Free</Button>
              </Link>
            ) : (
              <Button variant="outline" className="w-full" disabled>
                {isPro ? "Current: Pro Plan" : "Current Plan"}
              </Button>
            )}
          </div>

          {/* Pro */}
          <div className="relative bg-card border-2 border-primary rounded-2xl p-6 shadow-lg shadow-primary/10">
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              <Crown size={10} /> Most Popular
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gold mb-1">Pro — Lifetime</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-bold">₦10,000</p>
                <p className="text-muted-foreground text-sm mb-1">once</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Pay once, use forever. No subscription.</p>
            </div>

            <ul className="space-y-2.5 mb-6">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle size={14} className="text-primary mt-0.5 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>

            {isPro ? (
              <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-medium">
                <Sparkles size={15} /> You're on Pro — all features unlocked
              </div>
            ) : (
              <Button
                onClick={handleUpgrade}
                disabled={paying || isLoading}
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-11 text-sm font-semibold"
                data-testid="button-upgrade-pro"
              >
                {paying
                  ? <><Loader2 size={15} className="animate-spin" /> Processing...</>
                  : <><Zap size={15} /> Upgrade to Pro — ₦10,000</>
                }
              </Button>
            )}

            {!user && (
              <p className="text-center text-xs text-muted-foreground mt-3">
                <Link href="/auth"><a className="text-primary hover:underline">Sign in</a></Link> to pay
              </p>
            )}
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-10 text-center space-y-2">
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
