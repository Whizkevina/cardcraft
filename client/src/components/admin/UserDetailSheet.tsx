import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Crown, Shield, Calendar, FolderOpen, Share2, Download, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminPayment, AdminUser } from "./types";
import { formatKobo } from "./types";

interface UserDetailSheetProps {
  previewUser: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: number;
  onTierChange: (id: number, tier: "free" | "pro", reason?: string) => void;
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
  const userId = previewUser?.id ?? null;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/users/${userId}`);
      return res.json() as Promise<{ user: AdminUser; payments: AdminPayment[] }>;
    },
    enabled: open && userId != null,
  });

  const user = data?.user ?? previewUser;
  const payments = data?.payments ?? [];
  const isPro = user?.tier === "pro";
  const isAdmin = user?.role === "admin";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">{user?.name ?? "User details"}</SheetTitle>
          <SheetDescription>{user?.email ?? "Select a user"}</SheetDescription>
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
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Joined"
                value={user.createdAt ? format(new Date(user.createdAt), "dd MMM yyyy") : "—"}
                icon={Calendar}
              />
              <Stat label="Projects" value={user.projectCount} icon={FolderOpen} />
              <Stat label="Shared links" value={user.sharedCount} icon={Share2} />
              <Stat
                label="Downloads today"
                value={isPro ? "Unlimited" : `${user.downloadsToday}/3`}
                icon={Download}
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onTierChange(user.id, isPro ? "free" : "pro")}
                data-testid="button-detail-tier"
              >
                {isPro ? "Move to Free" : "Upgrade to Pro"}
              </Button>
              {user.id !== currentUserId && (
                <Button
                  size="sm"
                  variant="outline"
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
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const reason = (e.currentTarget.elements.namedItem("grant-reason") as HTMLInputElement).value.trim();
                    onTierChange(user.id, "pro", reason || undefined);
                    e.currentTarget.reset();
                  }}
                >
                  <Input id="grant-reason" name="grant-reason" placeholder="Support comp, refund…" className="h-8 text-xs" />
                  <Button type="submit" size="sm" className="shrink-0">Grant Pro</Button>
                </form>
              </div>
            )}

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
