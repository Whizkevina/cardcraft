import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BrandLogo } from "@/components/marketing/BrandLogo";
import { SurfaceCard } from "@/components/marketing/SurfaceCard";
import { hp, hpCn } from "@/components/marketing/homeTokens";
import { Mail, ArrowLeft, CheckCircle, KeyRound } from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const hashSearch = window.location.hash.split("?")[1] || "";
  const token = new URLSearchParams(hashSearch).get("token");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      setSent(true);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", { token, newPassword });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setResetDone(true);
      toast({ title: "Password updated", description: "You can now sign in." });
    } catch (e: any) {
      toast({ title: "Reset failed", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const shell = (children: React.ReactNode) => (
    <div className={hpCn(hp.page, "min-h-screen flex items-center justify-center px-4 py-12 hp-tone-grid")}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <BrandLogo />
        </div>
        <SurfaceCard variant="raised" className="p-6 sm:p-8">
          {children}
        </SurfaceCard>
      </div>
    </div>
  );

  if (token) {
    return shell(
      resetDone ? (
        <div className="text-center space-y-4">
          <CheckCircle size={40} className="mx-auto text-gold" />
          <h2 className={hpCn(hp.display, "text-xl")}>Password updated</h2>
          <p className={hpCn(hp.lead, "text-sm")}>Sign in with your new password.</p>
          <Link href="/auth">
            <Button className={hpCn(hp.btnPrimary, "w-full")}>Sign in</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-6">
            <KeyRound size={18} className="text-gold" />
            <h1 className={hpCn(hp.display, "text-xl")}>Set new password</h1>
          </div>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" required className="h-10" />
            </div>
            <Button type="submit" disabled={loading} className={hpCn(hp.btnPrimary, "w-full h-10")}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        </>
      ),
    );
  }

  return shell(
    sent ? (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-xl hp-surface-inset flex items-center justify-center mx-auto">
          <Mail size={24} className="text-gold" />
        </div>
        <h2 className={hpCn(hp.display, "text-xl")}>Check your email</h2>
        <p className={hpCn(hp.lead, "text-sm")}>
          If <strong className="text-foreground">{email}</strong> is registered, you'll receive a reset link shortly.
        </p>
        <Link href="/auth" className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </div>
    ) : (
      <>
        <p className={hp.eyebrow}>Account recovery</p>
        <h1 className={hpCn(hp.display, "text-xl mt-2 mb-1")}>Forgot password?</h1>
        <p className={hpCn(hp.lead, "text-sm mb-6")}>We'll email you a secure reset link.</p>
        <form onSubmit={handleForgot} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className="h-10" data-testid="input-forgot-email" />
          </div>
          <Button type="submit" disabled={loading} className={hpCn(hp.btnPrimary, "w-full h-10")}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <Link href="/auth" className="flex items-center gap-1.5 justify-center mt-5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </>
    ),
  );
}
