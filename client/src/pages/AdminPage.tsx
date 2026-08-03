import { useState } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "@/lib/queryClient";

import { useAuth } from "../components/AuthProvider";

import Navbar from "../components/Navbar";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { useToast } from "@/hooks/use-toast";

import { Users, TrendingUp, CreditCard, LayoutTemplate, Pencil, ScrollText, FolderOpen, Shield, Plus, Eye, EyeOff, Trash2, Search, Crown } from "lucide-react";

import { Link } from "wouter";

import type { Template } from "@shared/schema";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { colorSwatchDataUri } from "@/lib/utils";

import { UserDetailSheet } from "@/components/admin/UserDetailSheet";

import { AdminPaymentsTab } from "@/components/admin/AdminPaymentsTab";

import { AdminAuditTab } from "@/components/admin/AdminAuditTab";

import { AdminUsersTab } from "@/components/admin/AdminUsersTab";

import { AdminHealthStrip } from "@/components/admin/AdminHealthStrip";

import { AdminProjectsTab } from "@/components/admin/AdminProjectsTab";

import { AdminAnalyticsDashboard } from "@/components/admin/AdminAnalyticsDashboard";

import {

  AdminPageHeader,

  AdminPanel,

  AdminSectionHeader,

  AdminTabsList,

} from "@/components/admin/AdminShell";

import type { AdminUser } from "@/components/admin/types";



const tabTriggerClass =
  "rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium text-muted-foreground shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";



function TemplateRow({ template, onToggle, onToggleIsPro, onDelete }: { template: Template; onToggle: (id: number, status: "published" | "draft") => void; onToggleIsPro: (id: number, isPro: boolean) => void; onDelete: (id: number) => void }) {

  return (

    <div

      className="flex items-center gap-3 sm:gap-4 px-4 py-3.5 sm:px-5 sm:py-4 hover:bg-secondary/30 transition-colors border-b border-border/60 last:border-b-0"

      data-testid={`row-template-${template.id}`}

    >

      <img

        alt=""

        aria-hidden="true"

        src={colorSwatchDataUri(template.thumbnailColor, 40, 48)}

        className="w-10 h-12 rounded-lg border border-border flex-shrink-0 object-cover shadow-sm"

      />

      <div className="min-w-0 flex-1">

        <h3 className="font-semibold text-sm truncate">{template.title}</h3>

        <p className="text-xs text-muted-foreground capitalize mt-0.5">

          {template.category} · {(template as any).usageCount || 0} uses

        </p>

      </div>

      <div className="flex items-center gap-1.5 shrink-0">

        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${

          template.status === "published" ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"

        }`}>

          {template.status}

        </span>

        {Boolean(template.isPro) && (

          <span className="text-[10px] px-2 py-1 rounded-full font-medium bg-gold/15 text-gold flex items-center gap-1">

            <Crown size={10} /> Pro

          </span>

        )}

        <button

          type="button"

          onClick={() => onToggleIsPro(template.id, !template.isPro)}

          title={template.isPro ? "Make free" : "Make Pro-only"}

          className={`p-2 rounded-lg transition-colors ${template.isPro ? "text-gold hover:bg-gold/15" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}

          data-testid={`button-toggle-pro-template-${template.id}`}

        >

          <Crown size={14} />

        </button>

        <Link

          href={`/editor/t/${template.id}`}

          className="p-2 rounded-lg hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors"

          title="Edit in Editor"

          data-testid={`button-edit-template-${template.id}`}

        >

          <Pencil size={14} />

        </Link>

        <button

          type="button"

          onClick={() => onToggle(template.id, template.status === "published" ? "draft" : "published")}

          title={template.status === "published" ? "Unpublish template" : "Publish template"}

          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"

          data-testid={`button-toggle-template-${template.id}`}

        >

          {template.status === "published" ? <EyeOff size={14} /> : <Eye size={14} />}

        </button>

        <button

          type="button"

          onClick={() => onDelete(template.id)}

          title="Delete template"

          className="p-2 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"

          data-testid={`button-delete-template-${template.id}`}

        >

          <Trash2 size={14} />

        </button>

      </div>

    </div>

  );

}



function CreateTemplateDialog({ onCreated }: { onCreated: () => void }) {

  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");

  const [color, setColor] = useState("#1a0533");

  const [isPro, setIsPro] = useState(false);

  const { toast } = useToast();

  const qc = useQueryClient();



  const mutation = useMutation({

    mutationFn: async () => {

      const canvas = JSON.stringify({ objects: [{ type:"rect",left:0,top:0,width:800,height:1000,fill:color,selectable:false,evented:false,customType:"background",locked:true },{ type:"text",text:"Greeting",left:400,top:350,fontSize:48,fontFamily:"Georgia",fill:"#FFFFFF",textAlign:"center",originX:"center",customType:"greeting",editable:true,movable:true,styleEditable:true },{ type:"text",text:"NAME",left:400,top:430,fontSize:64,fontFamily:"Georgia",fontWeight:"bold",fill:"#FFD700",textAlign:"center",originX:"center",customType:"name",editable:true,movable:true,styleEditable:true },{ type:"text",text:"Date",left:400,top:520,fontSize:28,fontFamily:"Georgia",fill:"rgba(255,255,255,0.8)",textAlign:"center",originX:"center",customType:"date",editable:true,movable:true,styleEditable:true }], background:color });

      const res = await apiRequest("POST", "/api/templates", { title, category:"birthday", status:"draft", canvasJson:canvas, thumbnailColor:color, isPro: isPro ? 1 : 0 });

      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }

    },

    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/templates"] }); toast({ title:"Template created!" }); setOpen(false); setTitle(""); setColor("#1a0533"); setIsPro(false); onCreated(); },

    onError: (e: any) => toast({ title:"Error", description:e.message, variant:"destructive" }),

  });



  return (

    <Dialog open={open} onOpenChange={setOpen}>

      <DialogTrigger asChild>

        <Button className="gap-2 h-9 px-3 text-xs" data-testid="button-create-template">

          <Plus size={15} /> New Template

        </Button>

      </DialogTrigger>

      <DialogContent className="max-w-sm" aria-describedby={undefined}>

        <DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>

        <div className="space-y-4 pt-2">

          <div className="space-y-1.5">

            <label className="text-sm font-medium">Title</label>

            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Royal Birthday" />

          </div>

          <div className="space-y-1.5">

            <label className="text-sm font-medium">Background Color</label>

            <div className="flex items-center gap-3">

              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-border" aria-label="Background color" title="Background color" />

              <span className="text-sm text-muted-foreground">{color}</span>

            </div>

          </div>

          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">

            <input type="checkbox" checked={isPro} onChange={e => setIsPro(e.target.checked)} className="w-4 h-4 rounded cursor-pointer accent-gold" data-testid="checkbox-template-pro" />

            Pro-only template

          </label>

          <Button onClick={() => mutation.mutate()} disabled={!title || mutation.isPending} className="w-full">

            {mutation.isPending ? "Creating..." : "Create Template"}

          </Button>

        </div>

      </DialogContent>

    </Dialog>

  );

}



export default function AdminPage() {

  const { user, isStaff } = useAuth();

  const { toast } = useToast();

  const qc = useQueryClient();

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);

  const [templateSearch, setTemplateSearch] = useState("");



  const { data: templates = [], isLoading: tmplLoading } = useQuery<Template[]>({

    queryKey: ["/api/templates"],

    queryFn: async () => { const r = await apiRequest("GET", "/api/templates"); return r.json(); },

    enabled: isStaff,

  });



  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({

    queryKey: ["/api/admin/users"],

    queryFn: async () => { const r = await apiRequest("GET", "/api/admin/users"); return r.json(); },

    enabled: isStaff,

  });



  const toggleStatus = useMutation({

    mutationFn: async ({ id, status }: { id: number; status: "published" | "draft" }) => { await apiRequest("PATCH", `/api/templates/${id}`, { status }); },

    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/templates"] }),

  });

  const toggleIsPro = useMutation({

    mutationFn: async ({ id, isPro }: { id: number; isPro: boolean }) => { await apiRequest("PATCH", `/api/templates/${id}`, { isPro: isPro ? 1 : 0 }); },

    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/templates"] }); toast({ title: "Template updated" }); },

  });

  const deleteTemplate = useMutation({

    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/templates/${id}`); },

    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/templates"] }); toast({ title: "Template deleted" }); },

  });

  const changeTier = useMutation({

    mutationFn: async ({ id, tier, reason, proExpiresAt }: { id: number; tier: "free" | "pro"; reason?: string; proExpiresAt?: string }) => {

      const body: Record<string, string | undefined> = { tier, reason };

      if (proExpiresAt) body.proExpiresAt = proExpiresAt;

      const r = await apiRequest("PATCH", `/api/admin/users/${id}/tier`, body);

      if (!r.ok) throw new Error("Failed");

    },

    onSuccess: (_, v) => {

      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });

      qc.invalidateQueries({ queryKey: ["admin-user-detail", v.id] });

      qc.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });

      qc.invalidateQueries({ queryKey: ["/api/admin/analytics"] });

      toast({ title: `User ${v.tier === "pro" ? "upgraded to Pro" : "moved to Free"}` });

    },

  });

  const changeRole = useMutation({

    mutationFn: async ({ id, role }: { id: number; role: "user" | "admin" | "support" | "content" }) => { await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role }); },

    onSuccess: () => {

      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });

      qc.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });

      toast({ title: "Role updated" });

    },

  });

  const deleteUser = useMutation({

    mutationFn: async (id: number) => {

      const r = await apiRequest("DELETE", `/api/admin/users/${id}`);

      if (!r.ok) {

        const body = await r.json().catch(() => ({}));

        throw new Error(body.error || "Failed to delete user");

      }

    },

    onSuccess: (_, id) => {

      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });

      qc.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });

      qc.invalidateQueries({ queryKey: ["/api/admin/analytics/dashboard"] });

      setDetailOpen(false);

      setSelectedUser(null);

      toast({ title: "User deleted" });

    },

    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),

  });

  const bulkDeleteUsers = useMutation({

    mutationFn: async (ids: number[]) => {

      const r = await apiRequest("POST", "/api/admin/users/bulk-delete", { ids });

      if (!r.ok) throw new Error("Bulk delete failed");

      return r.json() as Promise<{ deleted: number; failed: { id: number; reason: string }[] }>;

    },

    onSuccess: (result) => {

      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });

      qc.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });

      qc.invalidateQueries({ queryKey: ["/api/admin/analytics/dashboard"] });

      const skipped = result.failed.length;

      toast({

        title: `${result.deleted} user${result.deleted !== 1 ? "s" : ""} deleted`,

        description: skipped > 0 ? `${skipped} skipped (admin, self, or not found)` : undefined,

      });

    },

    onError: () => toast({ title: "Bulk delete failed", variant: "destructive" }),

  });

  const canDeleteUsers = user?.role === "admin";

  const filteredTemplates = templates.filter(t => {

    if (!templateSearch.trim()) return true;

    const q = templateSearch.toLowerCase();

    return t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);

  });



  const seedAdmin = async () => {

    try {

      const res = await apiRequest("POST", "/api/admin/seed");

      const d = await res.json();

      const creds = d.email && d.password ? `Email: ${d.email} · Password: ${d.password}` : undefined;

      const resetNote = d.admin === "reset" ? " (existing account — password reset to default)" : undefined;

      toast({ title: d.message, description: creds ? `${creds}${resetNote ?? ""}` : undefined });

    } catch (e: any) {

      toast({

        title: "Could not seed admin",

        description: e.message?.includes("403")

          ? "Seed only works on local dev (127.0.0.1). Use npm run db:seed-admin for production."

          : e.message,

        variant: "destructive",

      });

    }

  };



  if (!user || !isStaff) {

    return (

      <div className="min-h-screen bg-background">

        <Navbar />

        <div className="max-w-md mx-auto px-4 py-20 text-center">

          <div className="rounded-2xl bg-card border border-border p-8 shadow-sm">

            <Shield size={40} className="mx-auto text-muted-foreground mb-4" />

            <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>

            <p className="text-muted-foreground text-sm mb-6">Sign in with an admin account to access this page.</p>

            <Button onClick={seedAdmin} variant="outline">Create Admin Account</Button>

          </div>

        </div>

      </div>

    );

  }



  return (

    <div className="min-h-screen bg-background">

      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-5 lg:px-6 py-5 sm:py-6">

        <AdminPageHeader

          title="Admin Panel"

          description="Growth, users, payments, and templates."

          action={<CreateTemplateDialog onCreated={() => {}} />}

        />

        <AdminHealthStrip />

        <Tabs defaultValue="analytics" className="space-y-0">

          <AdminTabsList>

            <TabsList className="h-auto w-max min-w-full sm:min-w-0 justify-start gap-0 rounded-none bg-transparent p-0">

              <TabsTrigger value="analytics" className={tabTriggerClass}>

                <TrendingUp size={14} className="mr-1.5 shrink-0" /> Analytics

              </TabsTrigger>

              <TabsTrigger value="users" className={tabTriggerClass}>

                <Users size={14} className="mr-1.5 shrink-0" /> Users ({users.length})

              </TabsTrigger>

              <TabsTrigger value="projects" className={tabTriggerClass}>

                <FolderOpen size={14} className="mr-1.5 shrink-0" /> Projects

              </TabsTrigger>

              <TabsTrigger value="payments" className={tabTriggerClass}>

                <CreditCard size={14} className="mr-1.5 shrink-0" /> Payments

              </TabsTrigger>

              <TabsTrigger value="activity" className={tabTriggerClass}>

                <ScrollText size={14} className="mr-1.5 shrink-0" /> Activity

              </TabsTrigger>

              <TabsTrigger value="templates" className={tabTriggerClass}>

                <LayoutTemplate size={14} className="mr-1.5 shrink-0" /> Templates ({templates.length})

              </TabsTrigger>

            </TabsList>

          </AdminTabsList>



          <TabsContent value="analytics" className="mt-0 focus-visible:outline-none">

            <AdminAnalyticsDashboard />

          </TabsContent>



          <TabsContent value="users" className="mt-0 focus-visible:outline-none">

            <AdminUsersTab

              users={users}

              usersLoading={usersLoading}

              currentUserId={user.id}

              canDelete={canDeleteUsers}

              onSelect={(u) => { setSelectedUser(u); setDetailOpen(true); }}

              onTierChange={(id, tier) => changeTier.mutate({ id, tier })}

              onRoleChange={(id, role) => changeRole.mutate({ id, role })}

              onBulkDelete={ids => bulkDeleteUsers.mutate(ids)}

              deletePending={deleteUser.isPending || bulkDeleteUsers.isPending}

            />

          </TabsContent>



          <TabsContent value="projects" className="mt-0 focus-visible:outline-none">

            <AdminProjectsTab />

          </TabsContent>



          <TabsContent value="payments" className="mt-0 focus-visible:outline-none">

            <AdminPaymentsTab />

          </TabsContent>



          <TabsContent value="activity" className="mt-0 focus-visible:outline-none">

            <AdminAuditTab />

          </TabsContent>



          <TabsContent value="templates" className="mt-0 focus-visible:outline-none">

            <AdminPanel padding="none">

              <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border/60 space-y-4">

                <AdminSectionHeader

                  title="Template library"

                  description={`${templates.length} templates · publish, edit, or remove designs`}

                />

                <div className="relative">

                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />

                  <Input

                    placeholder="Search templates by title or category…"

                    value={templateSearch}

                    onChange={e => setTemplateSearch(e.target.value)}

                    className="pl-10 h-10 text-sm bg-secondary/20 border-border/70"

                    data-testid="input-template-search"

                  />

                </div>

              </div>

              {tmplLoading ? (

                <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}

                </div>

              ) : templates.length === 0 ? (

                <div className="py-12 text-center text-sm text-muted-foreground">No templates yet.</div>

              ) : filteredTemplates.length === 0 ? (

                <div className="py-12 text-center text-sm text-muted-foreground">No templates match your search.</div>

              ) : (

                filteredTemplates.map(t => (

                  <TemplateRow

                    key={t.id}

                    template={t}

                    onToggle={(id, status) => toggleStatus.mutate({ id, status })}

                    onToggleIsPro={(id, isPro) => toggleIsPro.mutate({ id, isPro })}

                    onDelete={id => deleteTemplate.mutate(id)}

                  />

                ))

              )}

            </AdminPanel>

          </TabsContent>

        </Tabs>



        <UserDetailSheet

          previewUser={selectedUser}

          open={detailOpen}

          onOpenChange={(open) => {

            setDetailOpen(open);

            if (!open) setSelectedUser(null);

          }}

          currentUserId={user.id}

          onTierChange={(id, tier, reason, proExpiresAt) => changeTier.mutate({ id, tier, reason, proExpiresAt })}

          onRoleChange={(id, role) => changeRole.mutate({ id, role })}

          canDelete={canDeleteUsers}

          onDelete={id => deleteUser.mutate(id)}

          deletePending={deleteUser.isPending}

        />

      </main>

    </div>

  );

}

