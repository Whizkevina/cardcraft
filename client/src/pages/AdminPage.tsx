import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../components/AuthProvider";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Eye, EyeOff, Trash2, Users, Sparkles, Crown, Search, TrendingUp, CreditCard, LayoutTemplate, UserPlus, Pencil } from "lucide-react";
import { Link } from "wouter";
import type { Template } from "@shared/schema";
import type { AuthUser } from "../components/AuthProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color = "text-gold" }: { label: string; value: string | number; sub?: string; icon: any; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon size={15} className={color} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Template row ─────────────────────────────────────────────────────────────
function TemplateRow({ template, onToggle, onDelete }: { template: Template; onToggle: (id: number, status: "published" | "draft") => void; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card" data-testid={`row-template-${template.id}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-11 rounded-lg border border-border flex-shrink-0" style={{ background: template.thumbnailColor }} />
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{template.title}</h3>
          <p className="text-xs text-muted-foreground capitalize">{template.category} · {(template as any).usageCount || 0} uses</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${template.status === "published" ? "bg-green-500/15 text-green-500" : "bg-secondary text-muted-foreground"}`}>
          {template.status}
        </span>
        <Link href={`/editor/t/${template.id}`}>
          <a className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors" title="Edit in Editor" data-testid={`button-edit-template-${template.id}`}>
            <Pencil size={14} />
          </a>
        </Link>
        <button onClick={() => onToggle(template.id, template.status === "published" ? "draft" : "published")}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" data-testid={`button-toggle-template-${template.id}`}>
          {template.status === "published" ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button onClick={() => onDelete(template.id)}
          className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors" data-testid={`button-delete-template-${template.id}`}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────
function UserRow({ user, currentUserId, onTierChange, onRoleChange }: { user: AuthUser; currentUserId: number; onTierChange: (id: number, tier: "free" | "pro") => void; onRoleChange: (id: number, role: "user" | "admin") => void }) {
  const isPro = user.tier === "pro";
  const isAdmin = user.role === "admin";
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card gap-3" data-testid={`row-user-${user.id}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm truncate">{user.name}</span>
          {user.id === currentUserId && <span className="text-[10px] text-muted-foreground">(you)</span>}
          {isPro && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/20"><Crown size={8} /> PRO</span>}
          {isAdmin && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground border border-border"><Shield size={8} /> ADMIN</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        <p className="text-[10px] text-muted-foreground">{isPro ? "Unlimited downloads" : `${user.downloadsToday || 0}/3 today`}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={() => onTierChange(user.id, isPro ? "free" : "pro")}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${isPro ? "bg-primary/10 text-primary border-primary/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30" : "bg-secondary text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30"}`}
          data-testid={`button-tier-${user.id}`}>
          <Sparkles size={10} /> {isPro ? "Pro" : "Free"}
        </button>
        {user.id !== currentUserId && (
          <button onClick={() => onRoleChange(user.id, isAdmin ? "user" : "admin")}
            className={`p-1.5 rounded hover:bg-secondary transition-colors ${isAdmin ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}
            data-testid={`button-role-${user.id}`}>
            <Shield size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Create template dialog ───────────────────────────────────────────────────
function CreateTemplateDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(""); const [color, setColor] = useState("#1a0533");
  const { toast } = useToast(); const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const canvas = JSON.stringify({ objects: [{ type:"rect",left:0,top:0,width:800,height:1000,fill:color,selectable:false,evented:false,customType:"background",locked:true },{ type:"text",text:"Greeting",left:400,top:350,fontSize:48,fontFamily:"Georgia",fill:"#FFFFFF",textAlign:"center",originX:"center",customType:"greeting",editable:true,movable:true,styleEditable:true },{ type:"text",text:"NAME",left:400,top:430,fontSize:64,fontFamily:"Georgia",fontWeight:"bold",fill:"#FFD700",textAlign:"center",originX:"center",customType:"name",editable:true,movable:true,styleEditable:true },{ type:"text",text:"Date",left:400,top:520,fontSize:28,fontFamily:"Georgia",fill:"rgba(255,255,255,0.8)",textAlign:"center",originX:"center",customType:"date",editable:true,movable:true,styleEditable:true }], background:color });
      const res = await apiRequest("POST", "/api/templates", { title, category:"birthday", status:"draft", canvasJson:canvas, thumbnailColor:color });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/templates"] }); toast({ title:"Template created!" }); setOpen(false); setTitle(""); setColor("#1a0533"); onCreated(); },
    onError: (e: any) => toast({ title:"Error", description:e.message, variant:"destructive" }),
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
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Royal Birthday" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Background Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-border" />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!title || mutation.isPending} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {mutation.isPending ? "Creating..." : "Create Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [userSearch, setUserSearch] = useState("");

  const { data: analytics } = useQuery({
    queryKey: ["/api/admin/analytics"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/admin/analytics"); return r.json(); },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const { data: templates = [], isLoading: tmplLoading } = useQuery<Template[]>({
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
    mutationFn: async ({ id, status }: { id: number; status: "published" | "draft" }) => { await apiRequest("PATCH", `/api/templates/${id}`, { status }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/templates"] }),
  });
  const deleteTemplate = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/templates/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/templates"] }); toast({ title: "Template deleted" }); },
  });
  const changeTier = useMutation({
    mutationFn: async ({ id, tier }: { id: number; tier: "free" | "pro" }) => { const r = await apiRequest("PATCH", `/api/admin/users/${id}/tier`, { tier }); if (!r.ok) throw new Error("Failed"); },
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: `User ${v.tier === "pro" ? "upgraded to Pro" : "moved to Free"}` }); },
  });
  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: "user" | "admin" }) => { await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "Role updated" }); },
  });

  const seedAdmin = async () => {
    const res = await apiRequest("POST", "/api/admin/seed");
    const d = await res.json();
    toast({ title: d.message, description: d.password ? `Email: ${d.email} · Password: ${d.password}` : d.email });
  };

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <Shield size={40} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
          <p className="text-muted-foreground text-sm mb-6">Sign in with an admin account to access this page.</p>
          <Button onClick={seedAdmin} variant="outline">Create Admin Account</Button>
        </div>
      </div>
    );
  }

  const filteredUsers = userSearch ? users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())) : users;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1"><Shield size={18} className="text-gold" /><h1 className="text-2xl font-bold" style={{ fontFamily: "'Boska', Georgia, serif" }}>Admin Panel</h1></div>
            <p className="text-muted-foreground text-sm">Analytics, users, and template management.</p>
          </div>
          <CreateTemplateDialog onCreated={() => {}} />
        </div>

        <Tabs defaultValue="analytics">
          <TabsList className="mb-6">
            <TabsTrigger value="analytics" className="gap-2"><TrendingUp size={14} /> Analytics</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users size={14} /> Users ({users.length})</TabsTrigger>
            <TabsTrigger value="templates" className="gap-2"><LayoutTemplate size={14} /> Templates ({templates.length})</TabsTrigger>
          </TabsList>

          {/* ── Analytics ─────────────────────────────────────────────── */}
          <TabsContent value="analytics">
            {!analytics ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[1,2,3,4].map(i => <div key={i} className="h-24 skeleton rounded-xl" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <StatCard label="Total Users" value={analytics.totalUsers} sub={`${analytics.signupsToday} joined today`} icon={Users} />
                  <StatCard label="Pro Users" value={analytics.proUsers} sub={`${analytics.totalUsers > 0 ? Math.round(analytics.proUsers / analytics.totalUsers * 100) : 0}% conversion`} icon={Crown} color="text-primary" />
                  <StatCard label="Total Cards" value={analytics.totalCards} sub={`${analytics.cardsToday} created today`} icon={LayoutTemplate} color="text-blue-400" />
                  <StatCard label="Total Revenue" value={`₦${Number(analytics.totalRevenue).toLocaleString()}`} sub="Lifetime earnings" icon={CreditCard} color="text-green-400" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top templates */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><TrendingUp size={14} className="text-gold" /> Top Templates</h3>
                    {analytics.topTemplates?.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No template usage yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {analytics.topTemplates?.map((t: any, i: number) => (
                          <div key={t.id} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                            <div className="w-6 h-8 rounded flex-shrink-0" style={{ background: t.thumbnailColor }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{t.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <div className="flex-1 bg-secondary rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (t.uses / (analytics.topTemplates[0]?.uses || 1)) * 100)}%` }} />
                                </div>
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">{t.uses} uses</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent signups */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><UserPlus size={14} className="text-gold" /> Recent Signups</h3>
                    {analytics.recentSignups?.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No users yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {analytics.recentSignups?.map((u: any) => (
                          <div key={u.id} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{u.name}</p>
                              <p className="text-[10px] text-muted-foreground">{u.createdAt ? format(new Date(u.createdAt), "dd MMM yyyy") : "—"}</p>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${u.tier === "pro" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                              {u.tier}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Users ──────────────────────────────────────────────────── */}
          <TabsContent value="users">
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by name or email…" value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9 h-9 text-sm" data-testid="input-user-search" />
              </div>
              <p className="text-xs text-muted-foreground px-1">Click tier badge to toggle Free ↔ Pro · Click shield to toggle admin role</p>
              {usersLoading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
                : filteredUsers.map(u => <UserRow key={u.id} user={u} currentUserId={user.id} onTierChange={(id,tier) => changeTier.mutate({id,tier})} onRoleChange={(id,role) => changeRole.mutate({id,role})} />)}
            </div>
          </TabsContent>

          {/* ── Templates ──────────────────────────────────────────────── */}
          <TabsContent value="templates">
            <div className="space-y-3">
              {tmplLoading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
                : templates.map(t => <TemplateRow key={t.id} template={t} onToggle={(id,status) => toggleStatus.mutate({id,status})} onDelete={id => deleteTemplate.mutate(id)} />)}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
