import { useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { useTheme } from "../components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { AppPageHeader } from "@/components/marketing/AppPageHeader";
import { SurfaceCard } from "@/components/marketing/SurfaceCard";
import { EmptyState } from "@/components/marketing/EmptyState";
import { hp, hpCn } from "@/components/marketing/homeTokens";
import { User, Lock, Sparkles, Crown, Shield, ArrowRight, CheckCircle, Moon, Sun, Monitor } from "lucide-react";

export default function AccountSettings() {
  const { user, isPro } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  if (!user) {
    return (
      <MarketingPageShell>
        <MarketingSection spacing="default" containerClassName="max-w-lg mx-auto px-4 sm:px-6">
          <EmptyState
            icon={User}
            title="Sign in to access settings"
            description="Manage your profile, password, and subscription after you sign in."
            actions={[{ label: "Sign In", href: "/auth" }]}
          />
        </MarketingSection>
      </MarketingPageShell>
    );
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (newPw.length < 8) { toast({ title: "Password too short", description: "At least 8 characters required.", variant: "destructive" }); return; }
    setChangingPw(true);
    try {
      const res = await apiRequest("POST", "/api/auth/change-password", { currentPassword: currentPw, newPassword: newPw });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast({ title: "Password updated successfully" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setChangingPw(false); }
  };

  const themeOptions = [
    { value: "dark" as const, label: "Dark", icon: Moon, description: "CardCraft default" },
    { value: "light" as const, label: "Light", icon: Sun, description: "Higher contrast in bright rooms" },
  ];

  return (
    <MarketingPageShell>
      <MarketingSection spacing="default" containerClassName="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <AppPageHeader
          eyebrow="Account"
          title="Settings"
          description="Manage your profile, password, and subscription."
        />

        <div className="space-y-5">
          <SurfaceCard variant="raised" className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <User size={16} className="text-gold" />
              <h2 className="font-semibold">Profile</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Name</p>
                <p className="font-medium">{user.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Role</p>
                <p className="font-medium capitalize flex items-center gap-1.5">
                  {user.role === "admin" && <Shield size={13} className="text-gold" />}
                  {user.role}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Plan</p>
                <p className="font-medium flex items-center gap-1.5">
                  {isPro ? <><Crown size={13} className="text-primary" /> Pro — Lifetime</> : "Free"}
                </p>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard variant="raised" className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Monitor size={16} className="text-gold" />
              <div>
                <h2 className="font-semibold">Appearance</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Choose how CardCraft looks on your device.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              {themeOptions.map(({ value, label, icon: Icon, description }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    data-testid={`button-theme-${value}`}
                    className={hpCn(
                      "rounded-lg border p-4 text-left transition-colors",
                      active ? "border-primary/40 bg-primary/8" : "border-border hover:border-border/80 hover:bg-secondary/40",
                    )}
                  >
                    <Icon size={18} className={active ? "text-gold" : "text-muted-foreground"} />
                    <p className="font-medium text-sm mt-2">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </button>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard variant="raised" className={hpCn("p-6", isPro && "border-primary/25")}>
            <div className="flex items-center gap-3 mb-3">
              <Sparkles size={16} className="text-gold" />
              <h2 className="font-semibold">Subscription</h2>
            </div>
            {isPro ? (
              <div className="flex items-center gap-3">
                <CheckCircle size={18} className="text-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">You're on the Pro plan</p>
                  <p className="text-xs text-muted-foreground">Unlimited downloads · No watermark · Lifetime access</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">Free Plan</p>
                  <p className="text-xs text-muted-foreground">3 downloads/day · CardCraft watermark on exports</p>
                </div>
                <Link href="/pricing">
                  <Button size="sm" className={hp.btnPrimary}>
                    Upgrade to Pro <ArrowRight size={13} />
                  </Button>
                </Link>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard variant="raised" className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Payment History</p>
                <p className="text-xs text-muted-foreground">View receipts for your Pro purchase</p>
              </div>
              <Link href="/payments">
                <Button variant="outline" size="sm" className={hp.btnSecondary}>
                  View Payments <ArrowRight size={13} />
                </Button>
              </Link>
            </div>
          </SurfaceCard>

          <SurfaceCard variant="raised" className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Lock size={16} className="text-gold" />
              <h2 className="font-semibold">Change Password</h2>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
              <div className="space-y-1.5">
                <Label className="text-sm">Current Password</Label>
                <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                  placeholder="Your current password" required className="h-10" data-testid="input-current-password" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">New Password</Label>
                <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                  placeholder="At least 8 characters" required minLength={8} className="h-10" data-testid="input-new-password" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Confirm New Password</Label>
                <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password" required className="h-10" data-testid="input-confirm-password" />
              </div>
              <Button type="submit" disabled={changingPw} className={hp.btnPrimary}>
                {changingPw ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </SurfaceCard>
        </div>
      </MarketingSection>
    </MarketingPageShell>
  );
}
