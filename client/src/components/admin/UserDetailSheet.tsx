import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Crown, Shield, Calendar, FolderOpen, Share2, Download, CreditCard,
  LogIn, KeyRound, Ban, LogOut, Mail, Copy, ExternalLink, Eye,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdminPayment, AdminUser, AdminUserProject } from "./types";
import { formatKobo, sharePreviewUrl } from "./types";

interface UserDetailSheetProps {
  previewUser: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: number;
  onTierChange: (id: number, tier: "free" | "pro", reason?: string, proExpiresAt?: string) => void;
  onRoleChange: (id: number, role: "user" | "admin") => void;
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Calendar }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon size={12} />
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

export function UserDetailSheet({
  previewUser,
  open,
  onOpenChange,
  currentUserId,
  onTierChange,
  onRoleChange,
}: UserDetailSheetProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { startImpersonation, isStaff } = useAuth();
  const [, setLocation] = useLocation();
  const userId = previewUser?.id ?? null;
  const [proExpiry, setProExpiry] = useState("");
  const [adminNote, setAdminNote] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/users/${userId}`);
      return res.json() as Promise<{ user: AdminUser; payments: AdminPayment[] }>;
    },
    enabled: open && userId != null,
  });

  const { data: userProjects = [] } = useQuery({
    queryKey: ["admin-user-projects", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/users/${userId}/projects`);
      return res.json() as Promise<AdminUserProject[]>;
    },
    enabled: open && userId != null,
  });

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const saveNote = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      const r = await apiRequest("PATCH", `/api/admin/users/${id}/note`, { adminNote: note.trim() || null });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      invalidateUser();
      qc.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
      toast({ title: "Support note saved" });
    },
    onError: () => toast({ title: "Could not save note", variant: "destructive" }),
  });

  const invalidateUser = () => {
    qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
    qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    qc.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
  };

  const passwordReset = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/admin/users/${id}/send-password-reset`);
      if (!r.ok) throw new Error("Failed to send reset email");
      return r.json();
    },
    onSuccess: (d) => {
      invalidateUser();
      toast({ title: "Password reset sent", description: d.message });
    },
    onError: () => toast({ title: "Could not send reset email", variant: "destructive" }),
  });

  const forceLogout = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/admin/users/${id}/force-logout`);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ sessionsDestroyed: number }>;
    },
    onSuccess: (d) => {
      invalidateUser();
      toast({ title: "User logged out", description: `${d.sessionsDestroyed} session(s) cleared` });
    },
    onError: (e: Error) => toast({ title: "Force logout failed", description: e.message, variant: "destructive" }),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "active" | "suspended" }) => {
      const r = await apiRequest("PATCH", `/api/admin/users/${id}/status`, { status });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: (_, v) => {
      invalidateUser();
      toast({ title: v.status === "suspended" ? "User suspended" : "User reactivated" });
    },
    onError: (e: Error) => toast({ title: "Status update failed", description: e.message, variant: "destructive" }),
  });

  const user = data?.user ?? previewUser;
  const payments = data?.payments ?? [];
  const isPro = user?.tier === "pro";
  const isAdmin = user?.role === "admin";
  const isSuspended = user?.status === "suspended";
  const isSelf = user?.id === currentUserId;

  useEffect(() => {
    if (!open) {
      setAdminNote("");
      setProExpiry("");
    }
  }, [open]);

  useEffect(() => {
    if (data?.user) {
      setAdminNote(data.user.adminNote ?? "");
    }
  }, [data?.user?.id, data?.user?.adminNote]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="pr-8">
          <SheetTitle className="font-display text-left truncate">{user?.name ?? "User details"}</SheetTitle>
          <SheetDescription className="text-left truncate">{user?.email ?? "Select a user"}</SheetDescription>
          {user && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => copyText(String(user.id), "User ID")}
                data-testid="button-copy-user-id"
              >
                <Copy size={11} /> ID {user.id}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => copyText(user.email, "Email")}
                data-testid="button-copy-user-email"
              >
                <Copy size={11} /> Email
              </Button>
              {isStaff && !isSelf && user.role !== "admin" && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs gap-1"
                  onClick={async () => {
                    try {
                      await startImpersonation(user.id);
                      onOpenChange(false);
                      setLocation("/projects");
                      toast({ title: "Support view active", description: `Read-only view as ${user.name}` });
                    } catch {
                      toast({ title: "Could not start support view", variant: "destructive" });
                    }
                  }}
                  data-testid="button-view-as-user"
                >
                  <Eye size={11} /> View as user
                </Button>
              )}
            </div>
          )}
        </SheetHeader>

        {!user ? (
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 skeleton rounded-lg" />)}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              {isPro && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/20">
                  <Crown size={10} /> PRO
                </span>
              )}
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-secondary text-muted-foreground border border-border">
                  <Shield size={10} /> ADMIN
                </span>
              )}
              {isSuspended && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-destructive/15 text-destructive border border-destructive/20">
                  <Ban size={10} /> SUSPENDED
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Joined"
                value={user.createdAt ? format(new Date(user.createdAt), "dd MMM yyyy") : "—"}
                icon={Calendar}
              />
              <Stat
                label="Last login"
                value={user.lastLoginAt ? format(new Date(user.lastLoginAt), "dd MMM yyyy") : "Never"}
                icon={LogIn}
              />
              <Stat
                label="Auth"
                value={user.authProvider === "google" ? "Google" : "Email"}
                icon={Mail}
              />
              <Stat label="Projects" value={user.projectCount} icon={FolderOpen} />
              <Stat label="Shared links" value={user.sharedCount} icon={Share2} />
              <Stat
                label="Downloads today"
                value={isPro ? "Unlimited" : `${user.downloadsToday}/3`}
                icon={Download}
              />
              <Stat label="Total downloads" value={user.totalDownloads ?? 0} icon={Download} />
            </div>

            {isPro && user.proExpiresAt && (
              <p className="text-xs text-muted-foreground -mt-2">
                Pro expires {format(new Date(user.proExpiresAt), "dd MMM yyyy")}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 w-full sm:w-auto"
                onClick={() => onTierChange(user.id, isPro ? "free" : "pro")}
                data-testid="button-detail-tier"
              >
                {isPro ? "Move to Free" : "Upgrade to Pro"}
              </Button>
              {!isSelf && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => onRoleChange(user.id, isAdmin ? "user" : "admin")}
                  data-testid="button-detail-role"
                >
                  {isAdmin ? "Remove admin" : "Make admin"}
                </Button>
              )}
            </div>

            {!isPro && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label htmlFor="grant-reason" className="text-xs">Grant Pro with note (optional)</Label>
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const reason = (e.currentTarget.elements.namedItem("grant-reason") as HTMLInputElement).value.trim();
                    onTierChange(user.id, "pro", reason || undefined, proExpiry || undefined);
                    e.currentTarget.reset();
                    setProExpiry("");
                  }}
                >
                  <Input id="grant-reason" name="grant-reason" placeholder="Support comp, refund…" className="h-8 text-xs" />
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="pro-expiry" className="text-[10px] text-muted-foreground">Pro expiry (optional)</Label>
                      <Input
                        id="pro-expiry"
                        type="date"
                        value={proExpiry}
                        onChange={e => setProExpiry(e.target.value)}
                        className="h-8 text-xs w-full"
                        data-testid="input-pro-expiry"
                      />
                    </div>
                    <Button type="submit" size="sm" className="shrink-0 w-full sm:w-auto">Grant Pro</Button>
                  </div>
                </form>
              </div>
            )}

            {!isSelf && (
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin actions</h4>
                <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 w-full sm:w-auto"
                    disabled={passwordReset.isPending}
                    onClick={() => passwordReset.mutate(user.id)}
                    data-testid="button-send-password-reset"
                  >
                    <KeyRound size={12} /> Reset password
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 w-full sm:w-auto"
                    disabled={forceLogout.isPending}
                    onClick={() => forceLogout.mutate(user.id)}
                    data-testid="button-force-logout"
                  >
                    <LogOut size={12} /> Force logout
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={isSuspended ? "outline" : "destructive"}
                    className="h-8 text-xs gap-1.5 w-full sm:w-auto"
                    disabled={changeStatus.isPending}
                    onClick={() => changeStatus.mutate({ id: user.id, status: isSuspended ? "active" : "suspended" })}
                    data-testid="button-suspend-user"
                  >
                    <Ban size={12} /> {isSuspended ? "Reactivate" : "Suspend"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal support note</h4>
              <Textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="Private note for support — not visible to the user"
                className="min-h-[72px] text-xs resize-y"
                data-testid="textarea-admin-note"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                disabled={saveNote.isPending}
                onClick={() => saveNote.mutate({ id: user.id, note: adminNote })}
                data-testid="button-save-admin-note"
              >
                {saveNote.isPending ? "Saving…" : "Save note"}
              </Button>
            </div>

            <div className="pt-2 border-t border-border">
              <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-3">
                <FolderOpen size={13} className="text-gold" /> Saved cards ({userProjects.length})
              </h4>
              {userProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved cards.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {userProjects.map(p => (
                    <div key={p.id} className="rounded-lg border border-border p-2.5 text-xs">
                      <p className="font-medium truncate">{p.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {p.templateTitle ?? "Custom"} · {p.updatedAt ? format(new Date(p.updatedAt), "dd MMM yyyy") : "—"}
                      </p>
                      {p.shareEnabled && p.shareToken && (
                        <Button type="button" size="sm" variant="ghost" className="h-auto p-0 mt-1 text-[10px] gap-1 text-primary" asChild>
                          <a href={sharePreviewUrl(p.shareToken)} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={10} /> Open share preview
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border">
              <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-3">
                <CreditCard size={13} className="text-gold" /> Payment history
              </h4>
              {isLoading ? (
                <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-12 skeleton rounded-lg" />)}</div>
              ) : isError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                  <p className="text-destructive font-medium mb-1">Could not load payments</p>
                  <p className="text-muted-foreground mb-2">{error instanceof Error ? error.message : "Request failed"}</p>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => refetch()}>
                    Retry
                  </Button>
                </div>
              ) : payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No payments recorded.</p>
              ) : (
                <div className="space-y-2">
                  {payments.map(p => (
                    <div key={p.id} className="rounded-lg border border-border p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium">{formatKobo(p.amount, p.currency)}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                          p.status === "success" ? "bg-green-500/15 text-green-600" :
                          p.status === "failed" ? "bg-destructive/15 text-destructive" :
                          "bg-secondary text-muted-foreground"
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate">{p.reference}</p>
                      {p.refundNote && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 italic">Refund: {p.refundNote}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy · HH:mm") : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
