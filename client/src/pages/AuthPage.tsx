import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BrandLogo } from "@/components/marketing/BrandLogo";
import { SurfaceCard } from "@/components/marketing/SurfaceCard";
import { hp, hpCn } from "@/components/marketing/homeTokens";
import { Sparkles, Eye, EyeOff, Crown, FolderOpen } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { isGoogleAuthConfigured } from "@/lib/googleAuth";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast({ title: "Welcome back!" });
      } else {
        await register(name, email, password);
        toast({ title: "Account created!" });
      }
      setLocation("/projects");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={hpCn(hp.page, "min-h-screen flex")}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <BrandLogo className="mb-10" />

        <SurfaceCard variant="raised" className="w-full max-w-sm p-6 sm:p-8">
          <p className={hp.eyebrow}>{mode === "login" ? "Sign in" : "Create account"}</p>
          <h1 className={hpCn(hp.display, "text-2xl mt-3 mb-1")}>
            {mode === "login" ? "Welcome back" : "Join CardCraft"}
          </h1>
          <p className={hpCn(hp.lead, "text-sm mb-6")}>
            {mode === "login" ? "Access your saved cards and downloads." : "Save designs and pick up where you left off."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm">Full name</Label>
                <Input id="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required className="h-10 bg-background/60" data-testid="input-name" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className="h-10 bg-background/60" data-testid="input-email" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-10 pr-10 bg-background/60"
                  data-testid="input-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className={hpCn(hp.btnPrimary, "w-full h-10")} data-testid="button-submit-auth">
              <Sparkles size={14} />
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {isGoogleAuthConfigured && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                  <span className="bg-[hsl(var(--hp-surface-raised))] px-3 text-muted-foreground">Or</span>
                </div>
              </div>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    setLoading(true);
                    try {
                      await login(undefined, undefined, credentialResponse.credential);
                      toast({ title: "Welcome back!" });
                      setLocation("/projects");
                    } catch (err: any) {
                      toast({ title: "Login failed", description: err.message, variant: "destructive" });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  onError={() => toast({ title: "Google login failed", variant: "destructive" })}
                  theme="filled_black"
                  size="large"
                  shape="pill"
                  width="320"
                />
              </div>
            </>
          )}

          <p className="text-center text-sm text-muted-foreground mt-8">
            {mode === "login" ? "No account? " : "Already registered? "}
            <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-gold hover:underline font-medium" data-testid="button-toggle-mode">
              {mode === "login" ? "Sign up free" : "Sign in"}
            </button>
          </p>

          {mode === "login" && (
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-gold transition-colors block text-center mt-3">
              Forgot password?
            </Link>
          )}

          <div className="mt-5 pt-5 border-t border-border/70">
            <Link href="/templates" className="text-xs text-muted-foreground hover:text-foreground text-center block">
              Continue without account →
            </Link>
          </div>
        </SurfaceCard>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center hp-tone-grid border-l border-border/60">
        <div className="max-w-sm px-10 text-center">
          <SurfaceCard variant="inset" className="w-36 h-44 mx-auto mb-8 flex items-center justify-center">
            <div className="text-center px-4">
              <FolderOpen size={28} className="text-gold/70 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">Your saved designs</p>
            </div>
          </SurfaceCard>
          <p className={hpCn(hp.display, "text-xl text-gold mb-2")}>Save up to 5 cards free</p>
          <p className={hpCn(hp.lead, "text-sm mb-6")}>
            Reopen drafts anytime. Upgrade to Pro for unlimited storage, bulk CSV generation, and watermark-free exports.
          </p>
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground hp-surface-ghost rounded-lg px-3 py-2">
            <Crown size={12} className="text-gold" />
            Pro unlocks bulk generation
          </div>
        </div>
      </div>
    </div>
  );
}
