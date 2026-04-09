import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../components/AuthProvider";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Eye, EyeOff, Trash2, Users, Sparkles, Crown, UserCheck, UserX, Search } from "lucide-react";
import type { Template } from "@shared/schema";
import type { AuthUser } from "../components/AuthProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Template row ─────────────────────────────────────────────────────────────
function TemplateRow({ template, onToggle, onDelete }: {
  template: Template;
  onToggle: (id: number, status: "published" | "draft") => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card" data-testid={`row-template-${template.id}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-12 rounded-lg border border-border flex-shrink-0" style={{ background: template.thumbnailColor }} />
        <div>
          <h3 className="font-semibold text-sm">{template.title}</h3>
          <p className="text-xs text-muted-foreground capitalize">{template.category}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={template.status === "published" ? "default" : "secondary"} className="text-xs">
          {template.status}
        </Badge>
        <button
          onClick={() => onToggle(template.id, template.status === "published" ? "draft" : "published")}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title={template.status === "published" ? "Unpublish" : "Publish"}
          data-testid={`button-toggle-template-${template.id}`}
        >
          {template.status === "published" ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button
          onClick={() => onDelete(template.id)}
          className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
          data-testid={`button-delete-template-${template.id}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────
function UserRow({ user, currentUserId, onTierChange, onRoleChange }: {
  user: AuthUser & { lastDownloadDate?: string };
  currentUserId: number;
  onTierChange: (id: number, tier: "free" | "pro") => void;
  onRoleChange: (id: number, role: "user" | "admin") => void;
}) {
  const isCurrentUser = user.id === currentUserId;
  const isPro = user.tier === "pro";
  const isAdmin = user.role === "admin";

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card gap-4" data-testid={`row-user-${user.id}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate">{user.name}</span>
          {isCurrentUser && <span className="text-xs text-muted-foreground">(you)</span>}
          {isPro && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/20">
              <Crown size={8} /> PRO
            </span>
          )}
          {isAdmin && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground border border-border">
              <Shield size={8} /> ADMIN
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        <p className="text-xs text-muted-foreground">
          {isPro ? "Unlimited downloads" : `${user.downloadsToday || 0}/3 downloads today`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Tier toggle */}
        <button
          onClick={() => onTierChange(user.id, isPro ? "free" : "pro")}
          disabled={isCurrentUser && isAdmin}
          title={isPro ? "Downgrade to Free" : "Upgrade to Pro"}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            isPro
              ? "bg-primary/10 text-primary border-primary/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              : "bg-secondary text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30"
          }`}
          data-testid={`button-tier-${user.id}`}
        >
          {isPro ? <><Sparkles size={11} /> Pro</> : <><Sparkles size={11} /> Free</>}
        </button>

        {/* Admin toggle */}
        {!isCurrentUser && (
          <button
            onClick={() => onRoleChange(user.id, isAdmin ? "user" : "admin")}
            title={isAdmin ? "Remove admin" : "Make admin"}
            className={`p-1.5 rounded hover:bg-secondary transition-colors ${isAdmin ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}
            data-testid={`button-role-${user.id}`}
          >
            <Shield size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Create Template Dialog ───────────────────────────────────────────────────
function CreateTemplateDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState("#1a0533");
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const blankCanvas = JSON.stringify({
        objects: [
          { type: "rect", left: 0, top: 0, width: 800, height: 1000, fill: color, selectable: false, evented: false, customType: "background", locked: true },
          { type: "text", text: "Happy Birthday", left: 400, top: 350, fontSize: 48, fontFamily: "Georgia", fill: "#FFFFFF", textAlign: "center", originX: "center", customType: "greeting", editable: true, movable: true, styleEditable: true },
          { type: "text", text: "NAME", left: 400, top: 430, fontSize: 64, fontFamily: "Georgia", fontWeight: "bold", fill: "#FFD700", textAlign: "center", originX: "center", customType: "name", editable: true, movable: true, styleEditable: true },
          { type: "text", text: "Date · Year", left: 400, top: 520, fontSize: 28, fontFamily: "Georgia", fill: "rgba(255,255,255,0.8)", textAlign: "center", originX: "center", customType: "date", editable: true, movable: true, styleEditable: true },
        ],
        background: color
      });
      const res = await apiRequest("POST", "/api/templates", {
        title, category: "birthday", status: "draft",
        canvasJson: blankCanvas, thumbnailColor: color,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template created!" });
      setOpen(false); setTitle(""); setColor("#1a0533");
      onCreated();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-create-template">
          <Plus size={15} /> New Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Royal Birthday" data-testid="input-template-title" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Background Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-border" />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!title || mutation.isPending}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-submit-template">
            {mutation.isPending ? "Creating..." : "Create Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [userSearch, setUserSearch] = useState("");

  const { data: templates = [], isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/templates"); return r.json(); },
    enabled: isAdmin,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<AuthUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/admin/users"); return r.json(); },
    enabled: isAdmin,
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "published" | "draft" }) => {
      await apiRequest("PATCH", `/api/templates/${id}`, { status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/templates"] }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/templates/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/templates"] }); toast({ title: "Template deleted" }); },
  });

  const changeTier = useMutation({
    mutationFn: async ({ id, tier }: { id: number; tier: "free" | "pro" }) => {
      const r = await apiRequest("PATCH", `/api/admin/users/${id}/tier`, { tier });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: `User ${vars.tier === "pro" ? "upgraded to Pro" : "moved to Free"}` });
    },
    onError: () => toast({ title: "Failed to change tier", variant: "destructive" }),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: "user" | "admin" }) => {
      const r = await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated" });
    },
  });

  const seedAdmin = async () => {
    const res = await apiRequest("POST", "/api/admin/seed");
    const data = await res.json();
    toast({ title: data.message, description: data.password ? `Email: ${data.email} · Password: ${data.password}` : data.email });
  };

  if (authLoading) return null;

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <Shield size={40} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
          <p className="text-muted-foreground text-sm mb-6">Sign in with an admin account to access this page.</p>
          <Button onClick={seedAdmin} variant="outline" data-testid="button-seed-admin">Create Admin Account</Button>
        </div>
      </div>
    );
  }

  const published = templates.filter(t => t.status === "published").length;
  const proUsers = users.filter(u => u.tier === "pro").length;
  const filteredUsers = userSearch
    ? users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
    : users;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={18} className="text-gold" />
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Boska', Georgia, serif" }}>Admin Panel</h1>
            </div>
            <p className="text-muted-foreground text-sm">Manage templates, users, and account tiers.</p>
          </div>
          <CreateTemplateDialog onCreated={() => {}} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Templates", value: templates.length, icon: Eye },
            { label: "Published", value: published, icon: Eye },
            { label: "Total Users", value: users.length, icon: Users },
            { label: "Pro Users", value: proUsers, icon: Crown },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <p className="text-2xl font-bold text-gold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs: Templates | Users */}
        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="gap-2"><Users size={14} /> Users ({users.length})</TabsTrigger>
            <TabsTrigger value="templates" className="gap-2"><Eye size={14} /> Templates ({templates.length})</TabsTrigger>
          </TabsList>

          {/* ── Users tab ────────────────────────────────────────────── */}
          <TabsContent value="users">
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                  data-testid="input-user-search"
                />
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
                <span className="flex items-center gap-1"><Sparkles size={10} className="text-primary" /> Click tier badge to toggle Free ↔ Pro</span>
                <span className="flex items-center gap-1"><Shield size={10} className="text-gold" /> Click shield to toggle admin role</span>
              </div>

              {usersLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <p className="text-muted-foreground text-sm">No users found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map(u => (
                    <UserRow
                      key={u.id}
                      user={u as any}
                      currentUserId={user.id}
                      onTierChange={(id, tier) => changeTier.mutate({ id, tier })}
                      onRoleChange={(id, role) => changeRole.mutate({ id, role })}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Templates tab ─────────────────────────────────────────── */}
          <TabsContent value="templates">
            <div className="space-y-3">
              {templatesLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <p className="text-muted-foreground text-sm">No templates yet.</p>
                </div>
              ) : (
                templates.map(t => (
                  <TemplateRow
                    key={t.id} template={t}
                    onToggle={(id, status) => toggleStatus.mutate({ id, status })}
                    onDelete={id => deleteTemplate.mutate(id)}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
