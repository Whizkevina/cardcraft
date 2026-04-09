import { createContext, useContext, useState, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  tier: "free" | "pro";
  downloadsToday: number;
}

interface AuthCtx {
  user: AuthUser | null;
  isLoading: boolean;
  isPro: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, isLoading: true, isPro: false, isAdmin: false,
  login: async () => {}, register: async () => {}, logout: async () => {},
});

// ─── Force Password Change Dialog ────────────────────────────────────────────
function ForcePasswordDialog({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { toast({ title: "Too short", description: "Password must be at least 8 characters.", variant: "destructive" }); return; }
    if (newPw !== confirm) { toast({ title: "Mismatch", description: "Passwords don't match.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/change-password", { currentPassword: "admin123", newPassword: newPw });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast({ title: "Password updated", description: "Your default password has been changed." });
      onDone();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-sm" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-500" />
            <DialogTitle>Change Default Password</DialogTitle>
          </div>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">You're using the default admin password. Please set a secure password before continuing.</p>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="space-y-1">
            <Label className="text-xs">New Password</Label>
            <Input type="password" placeholder="Min. 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)} data-testid="input-new-password" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confirm Password</Label>
            <Input type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} data-testid="input-confirm-password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Saving..." : "Set New Password"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [needsPwChange, setNeedsPwChange] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/me");
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000, // Refresh every minute so tier changes propagate
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.needsPasswordChange) setNeedsPwChange(true);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ name, email, password }: { name: string; email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", { name, email, password });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/auth/me"] }),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/auth/logout"); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/auth/me"] }),
  });

  const user: AuthUser | null = data?.user ?? null;

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isPro: user?.tier === "pro",
      isAdmin: user?.role === "admin",
      login: (email, password) => loginMutation.mutateAsync({ email, password }),
      register: (name, email, password) => registerMutation.mutateAsync({ name, email, password }),
      logout: () => logoutMutation.mutateAsync(),
    }}>
      {children}
      {needsPwChange && <ForcePasswordDialog onDone={() => setNeedsPwChange(false)} />}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
