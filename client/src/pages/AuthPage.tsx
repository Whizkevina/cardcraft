import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
    <div className="min-h-screen flex">
      {/* Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        <Link href="/" className="flex items-center gap-2 mb-10 hover:opacity-80 transition-opacity">
          <svg aria-label="CardCraft" viewBox="0 0 32 32" fill="none" className="w-8 h-8">
            <rect width="32" height="32" rx="8" fill="hsl(43 96% 58%)"/>
            <rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="hsl(240 20% 7%)" strokeWidth="2"/>
            <path d="M6 14h20" stroke="hsl(240 20% 7%)" strokeWidth="1.5"/>
          </svg>
          <span className="text-xl font-bold logo-text">CardCraft</span>
        </Link>

        <div className="w-full max-w-sm premium-card rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold mb-1 font-display">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {mode === "login" ? "Sign in to access your saved cards." : "Save and revisit your card designs anytime."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm">Full Name</Label>
                <Input
                  id="name" type="text" value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Doe" required
                  className="h-10 bg-background" data-testid="input-name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="h-10 bg-background" data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="h-10 pr-10 bg-background"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full btn-gold h-10 gap-2" data-testid="button-submit-auth">
              <Sparkles size={14} />
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          {isGoogleAuthConfigured && (
            <>
              <div className="relative mt-8 mb-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground font-medium">Or continue with</span>
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
                  onError={() => {
                    toast({ title: "Google login failed", variant: "destructive" });
                  }}
                  theme={document.documentElement.classList.contains("dark") ? "filled_black" : "outline"}
                  size="large"
                  shape="pill"
                  width="320"
                />
              </div>
            </>
          )}

          <p className="text-center text-sm text-muted-foreground mt-8">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-primary hover:underline font-medium" data-testid="button-toggle-mode">
              {mode === "login" ? "Sign up free" : "Sign in"}
            </button>
          </p>

          {mode === "login" && (
            <div className="pt-2">
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors block text-center">
                Forgot your password?
              </Link>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-border">
            <Link href="/templates" className="text-xs text-muted-foreground hover:text-foreground text-center block transition-colors">
              ← Continue without account (guest mode)
            </Link>
          </div>
        </div>
      </div>

      {/* Hero panel */}
      <div className="hidden md:flex flex-1 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 auth-hero-gradient" />
        <div className="relative z-10 text-center p-10 max-w-md">
          <div className="w-36 h-44 mx-auto rounded-2xl border-2 border-yellow-400/40 mb-8 flex items-center justify-center auth-hero-card">
            <div className="text-center px-4">
              <FolderOpen size={32} className="text-yellow-400/70 mx-auto mb-3" />
              <p className="text-yellow-400/90 text-xs font-medium">Your saved designs</p>
            </div>
          </div>
          <p className="text-yellow-400 text-lg font-semibold mb-2 font-display">Save up to 5 cards free</p>
          <p className="text-white/55 text-sm leading-relaxed mb-6">
            Registered users can save drafts, reopen designs, and upgrade to Pro for unlimited storage and bulk generation.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-white/40">
            <Crown size={12} className="text-yellow-400/60" />
            <span>Pro unlocks bulk CSV generation &amp; no watermark</span>
          </div>
        </div>
      </div>
    </div>
  );
}
