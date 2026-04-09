import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Eye, EyeOff } from "lucide-react";

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
      {/* Left: form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <Link href="/">
          <a className="flex items-center gap-2 mb-8">
            <svg aria-label="CardCraft" viewBox="0 0 32 32" fill="none" className="w-8 h-8">
              <rect width="32" height="32" rx="8" fill="hsl(43 96% 58%)"/>
              <rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="hsl(240 20% 7%)" strokeWidth="2"/>
              <path d="M6 14h20" stroke="hsl(240 20% 7%)" strokeWidth="1.5"/>
            </svg>
            <span className="text-xl font-bold logo-text">CardCraft</span>
          </a>
        </Link>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Boska', Georgia, serif" }}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {mode === "login" ? "Sign in to access your saved cards." : "Save and revisit your birthday card designs."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm">Full Name</Label>
                <Input
                  id="name" type="text" value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Doe" required
                  className="h-10" data-testid="input-name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="h-10" data-testid="input-email"
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
                  className="h-10 pr-10"
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

            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 gap-2" data-testid="button-submit-auth">
              <Sparkles size={14} />
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-5">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-primary hover:underline font-medium" data-testid="button-toggle-mode">
              {mode === "login" ? "Sign up free" : "Sign in"}
            </button>
          </p>

          {mode === "login" && (
            <div className="pt-2">
              <Link href="/forgot-password">
                <a className="text-xs text-muted-foreground hover:text-primary transition-colors block text-center">
                  Forgot your password?
                </a>
              </Link>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-border">
            <Link href="/templates">
              <a className="text-xs text-muted-foreground hover:text-foreground text-center block">
                ← Continue without account (guest mode)
              </a>
            </Link>
          </div>
        </div>
      </div>

      {/* Right: decorative */}
      <div className="hidden md:flex flex-1 items-center justify-center bg-secondary relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1a0533 0%, #2d0a5e 100%)" }} />
        <div className="relative z-10 text-center p-10">
          <div className="w-32 h-40 mx-auto rounded-2xl border-2 border-yellow-400/50 mb-6 flex items-center justify-center" style={{ background: "rgba(255,215,0,0.05)" }}>
            <div className="text-yellow-400 opacity-50">
              <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
          </div>
          <p className="text-yellow-400 text-sm font-medium mb-1">Save unlimited cards</p>
          <p className="text-white/60 text-xs max-w-xs">Registered users can save drafts, reopen designs, and manage all their birthday cards.</p>
        </div>
      </div>
    </div>
  );
}
