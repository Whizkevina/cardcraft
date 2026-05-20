import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../components/AuthProvider";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { EmptyState } from "@/components/marketing/EmptyState";
import { FolderOpen, Edit3, Trash2, Plus, Clock, Copy, Check, Pencil } from "lucide-react";
import type { Project } from "@shared/schema";
import { format } from "date-fns";

function EmptyProjects() {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No cards saved yet"
      description="Design your first card — birthday, graduation, church event, or corporate celebration. Sign in to save and revisit anytime."
      actions={[{ label: "Start Designing", href: "/templates", icon: Plus }]}
    />
  );
}

function ProjectCard({ project, onDelete, onDuplicate }: {
  project: Project;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (newTitle: string) => {
      const res = await apiRequest("PATCH", `/api/projects/${project.id}/rename`, { title: newTitle });
      if (!res.ok) throw new Error("Failed to rename");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
      setSaved(true);
      setTimeout(() => { setSaved(false); setRenaming(false); }, 1200);
    },
    onError: () => toast({ title: "Rename failed", variant: "destructive" }),
  });

  return (
    <div className="group rounded-xl overflow-hidden border border-border bg-card hover:border-primary/30 transition-colors" data-testid={`card-project-${project.id}`}>
      {/* Thumbnail */}
      <div
        className="aspect-[4/5] bg-secondary cursor-pointer relative overflow-hidden"
        onClick={() => { window.location.hash = `#/editor/p/${project.id}`; }}
      >
        {project.thumbnail ? (
          <img src={project.thumbnail} alt={project.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FolderOpen size={32} className="text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Edit3 size={12} /> Open Editor
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3">
        {/* Inline rename */}
        {renaming ? (
          <div className="flex items-center gap-1.5 mb-1">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") renameMutation.mutate(title); if (e.key === "Escape") { setTitle(project.title); setRenaming(false); } }}
              className="h-7 text-xs px-2 flex-1"
              autoFocus
              data-testid={`input-rename-${project.id}`}
            />
            <button onClick={() => renameMutation.mutate(title)} className="p-1 rounded hover:bg-secondary text-primary">
              {saved ? <Check size={13} /> : <Check size={13} />}
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-1 mb-1">
            <h3 className="font-semibold text-sm truncate flex-1">{project.title}</h3>
            <button
              onClick={() => setRenaming(true)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
              title="Rename"
              data-testid={`button-rename-${project.id}`}
            >
              <Pencil size={12} />
            </button>
          </div>
        )}

        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
          <Clock size={10} />
          {format(new Date(project.updatedAt || project.createdAt), "MMM d, yyyy")}
        </p>

        <div className="flex items-center gap-1">
          <button
            onClick={() => { window.location.hash = `#/editor/p/${project.id}`; }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs bg-secondary hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`button-edit-project-${project.id}`}
          >
            <Edit3 size={11} /> Edit
          </button>
          <button
            onClick={() => onDuplicate(project.id)}
            className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded text-xs bg-secondary hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
            title="Duplicate"
            data-testid={`button-duplicate-project-${project.id}`}
          >
            <Copy size={11} />
          </button>
          <button
            onClick={() => onDelete(project.id)}
            className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded text-xs hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
            data-testid={`button-delete-project-${project.id}`}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/projects");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/projects/${id}`);
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/projects"] }); toast({ title: "Deleted" }); },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/projects/${id}/duplicate`);
      if (!res.ok) throw new Error("Failed to duplicate");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/projects"] }); toast({ title: "Card duplicated", description: "A copy has been added to your cards." }); },
    onError: () => toast({ title: "Duplicate failed", variant: "destructive" }),
  });

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <EmptyState
          icon={FolderOpen}
          title="Sign in to save cards"
          description="Create a free account to save and revisit your designs."
          actions={[
            { label: "Sign In / Register", href: "/auth" },
            { label: "Browse Templates", href: "/templates", variant: "outline" },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold font-display">My Cards</h1>
            <p className="text-muted-foreground text-sm">{projects.length} saved {projects.length === 1 ? "card" : "cards"}</p>
          </div>
          <Link href="/templates">
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-new-card">
              <Plus size={15} /> New Card
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-xl overflow-hidden border border-border">
                <div className="aspect-[4/5] skeleton" />
                <div className="p-3 bg-card space-y-2">
                  <div className="skeleton h-3 w-28" /><div className="skeleton h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyProjects />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {projects.map(p => (
              <ProjectCard
                key={p.id} project={p}
                onDelete={id => deleteMutation.mutate(id)}
                onDuplicate={id => duplicateMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
