import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, ArrowLeft, CheckCircle, KeyRound } from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Detect if we're in reset mode (token in URL hash)
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
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
    } catch (e: any) {
      toast({ title: "Reset failed", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const Logo = () => (
    <Link href="/" className="flex items-center gap-2 mb-8 justify-center hover:opacity-80 transition-opacity">
        <svg aria-label="CardCraft" viewBox="0 0 32 32" fill="none" className="w-8 h-8">
          <rect width="32" height="32" rx="8" fill="hsl(43 96% 58%)"/>
          <rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="hsl(240 20% 7%)" strokeWidth="2"/>
          <path d="M6 14h20" stroke="hsl(240 20% 7%)" strokeWidth="1.5"/>
        </svg>
        <span className="text-xl font-bold logo-text">CardCraft</span>
    </Link>
  );

  // ── Reset password form (token present) ───────────────────────────────────
  if (token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <Logo />
          {resetDone ? (
            <div className="text-center space-y-4">
              <CheckCircle size={48} className="mx-auto text-primary" />
              <h2 className="text-xl font-bold">Password updated!</h2>
              <p className="text-muted-foreground text-sm">You can now sign in with your new password.</p>
              <Link href="/auth">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Sign In</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6 justify-center">
                <KeyRound size={20} className="text-gold" />
                <h1 className="text-2xl font-bold font-display">Set new password</h1>
              </div>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters" required minLength={8} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm Password</Label>
                  <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password" required className="h-10" />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10">
                  {loading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Forgot password form ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Logo />
        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
              <Mail size={28} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold">Check your email</h2>
            <p className="text-muted-foreground text-sm">
              If <strong>{email}</strong> is registered, you'll receive a password reset link within a few minutes.
            </p>
            <p className="text-xs text-muted-foreground">Didn't get it? Check your spam folder.</p>
            <Link href="/auth" className="flex items-center gap-1.5 justify-center text-sm text-primary hover:underline">
                <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-1 text-center font-display">
              Forgot password?
            </h1>
            <p className="text-muted-foreground text-sm text-center mb-6">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required className="h-10" data-testid="input-forgot-email" />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10">
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
            <Link href="/auth" className="flex items-center gap-1.5 justify-center mt-5 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
