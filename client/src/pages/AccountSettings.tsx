import { useState } from "react";
import { useAuth } from "../components/AuthProvider";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { User, Lock, Sparkles, Crown, Shield, ArrowRight, CheckCircle } from "lucide-react";

export default function AccountSettings() {
  const { user, isPro } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <User size={40} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Sign in to access settings</h2>
          <Link href="/auth"><Button className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4">Sign In</Button></Link>
        </div>
      </div>
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

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 font-display">Account Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your profile, password, and subscription.</p>
        </div>

        {/* Profile info */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
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
        </div>

        {/* Subscription */}
        <div className={`rounded-xl p-6 border ${isPro ? "bg-card border-primary/25 shadow-sm" : "bg-card border-border"}`}>
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
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 flex-shrink-0">
                  Upgrade to Pro <ArrowRight size={13} />
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Payment history link */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Payment History</p>
              <p className="text-xs text-muted-foreground">View receipts for your Pro purchase</p>
            </div>
            <Link href="/payments">
              <Button variant="outline" size="sm" className="gap-2">View Payments <ArrowRight size={13} /></Button>
            </Link>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-card border border-border rounded-xl p-6">
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
            <Button type="submit" disabled={changingPw} className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6">
              {changingPw ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
