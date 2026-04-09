import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../components/AuthProvider";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Edit3, Trash2, Plus, Clock } from "lucide-react";
import type { Project } from "@shared/schema";
import { format } from "date-fns";

export default function Projects() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
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
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Deleted", description: "Project removed." });
    },
  });

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <FolderOpen size={40} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Sign in to save cards</h2>
          <p className="text-muted-foreground mb-6 text-sm">Create a free account to save and revisit your designs.</p>
          <Link href="/auth">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Sign In / Register</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Boska', Georgia, serif" }}>My Cards</h1>
            <p className="text-muted-foreground text-sm">
              {projects.length} saved {projects.length === 1 ? "card" : "cards"}
            </p>
          </div>
          <Link href="/templates">
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-new-card">
              <Plus size={15} /> New Card
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl overflow-hidden border border-border">
                <div className="aspect-[4/5] skeleton" />
                <div className="p-3 bg-card space-y-2">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <FolderOpen size={44} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No saved cards yet</h3>
            <p className="text-muted-foreground text-sm mb-5">Create a card and click Save to keep it here.</p>
            <Link href="/templates">
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus size={14} /> Start Designing
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {projects.map(p => (
              <div key={p.id} className="group rounded-xl overflow-hidden border border-border bg-card" data-testid={`card-project-${p.id}`}>
                {/* Thumbnail */}
                <div
                  className="aspect-[4/5] bg-secondary cursor-pointer relative overflow-hidden"
                  onClick={() => { window.location.hash = `#/editor/p/${p.id}`; }}
                >
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FolderOpen size={32} className="text-muted-foreground" />
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                      <Edit3 size={12} /> Open Editor
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{p.title}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        {format(new Date(p.updatedAt || p.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { window.location.hash = `#/editor/p/${p.id}`; }}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                        data-testid={`button-edit-project-${p.id}`}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(p.id)}
                        className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                        data-testid={`button-delete-project-${p.id}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
