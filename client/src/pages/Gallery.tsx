import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../components/AuthProvider";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { PageHeader } from "@/components/marketing/PageHeader";
import { TemplateThumbnail } from "@/components/TemplateThumbnail";
import { Sparkles, ArrowRight, Palette, GraduationCap, Church, Building2, Search, X, Heart, Crown, Lock } from "lucide-react";
import { Link } from "wouter";
import type { Template } from "@shared/schema";

const CATEGORIES = [
  { value: "all", label: "All", icon: Palette },
  { value: "romance", label: "Romance & Love", icon: Heart },
  { value: "birthday", label: "Birthday", icon: Sparkles },
  { value: "celebration", label: "Celebrations", icon: Sparkles },
  { value: "graduation", label: "Graduation", icon: GraduationCap },
  { value: "anniversary", label: "Anniversary", icon: Church },
  { value: "church", label: "Church", icon: Church },
  { value: "corporate", label: "Corporate", icon: Building2 },
  { value: "achievement", label: "Achievement", icon: Building2 },
  { value: "eid", label: "Eid", icon: Sparkles },
];

function PreviewModal({ template, onClose, isPro }: { template: Template; onClose: () => void; isPro: boolean }) {
  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Preview Template</DialogTitle>
        </VisuallyHidden>
        <div className="relative">
          <TemplateThumbnail template={template} showCategory showProBadge />
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
            <p className="text-white font-bold text-sm">{template.title}</p>
            <p className="text-white/70 text-xs capitalize">{template.category}</p>
          </div>
          <button
            onClick={onClose}
            title="Close preview"
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-2">
          {template.isPro && !isPro ? (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                <Lock size={12} className="text-primary" />
                Pro template — upgrade to customize this design.
              </div>
              <Link href="/pricing">
                <Button className="w-full btn-gold gap-2">
                  <Crown size={14} /> Upgrade to Pro
                </Button>
              </Link>
            </>
          ) : (
            <Button
              className="w-full btn-gold gap-2"
              onClick={() => { onClose(); window.location.hash = `#/editor/t/${template.id}`; }}
              data-testid={`button-use-template-${template.id}`}
            >
              <Sparkles size={14} /> Use This Template
            </Button>
          )}
          <p className="text-center text-xs text-muted-foreground">
            All elements are fully customizable in the editor
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ template, onPreview, locked }: { template: Template; onPreview: () => void; locked?: boolean }) {
  return (
    <div
      className="template-card premium-card rounded-2xl overflow-hidden cursor-pointer group"
      onClick={onPreview}
      data-testid={`card-template-${template.id}`}
    >
      <TemplateThumbnail
        template={template}
        showCategory
        showProBadge
        locked={locked}
        hoverOverlay={
          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold shadow-premium">
              Preview Template
            </div>
          </div>
        }
      />

      <div className="p-3 bg-card flex items-center justify-between border-t border-border/60">
        <div>
          <h3 className="font-semibold text-xs">{template.title}</h3>
          <p className="text-[11px] text-muted-foreground capitalize">{template.category}</p>
        </div>
        <ArrowRight size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}

export default function Gallery() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Template | null>(null);
  const { isPro } = useAuth();

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/templates"); return res.json(); },
  });

  const filtered = useMemo(() => {
    let list = activeCategory === "all" ? templates : templates.filter(t => t.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    }
    return list;
  }, [templates, activeCategory, search]);

  const counts = useMemo(() => CATEGORIES.reduce((acc, cat) => {
    acc[cat.value] = cat.value === "all" ? templates.length : templates.filter(t => t.category === cat.value).length;
    return acc;
  }, {} as Record<string, number>), [templates]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <PageHeader
          align="left"
          badge={{ icon: Palette, label: `${templates.length} Card Templates` }}
          title="Choose a Template"
          description="Click any template to preview it, then open in the editor to customize."
          className="mb-7"
        />

        <div className="space-y-3 mb-7">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
              data-testid="input-template-search"
            />
            {search && (
              <button onClick={() => setSearch("")} title="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-nowrap">
            {CATEGORIES.filter(c => c.value === "all" || counts[c.value] > 0).map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.value;
              return (
                <button key={cat.value} onClick={() => setActiveCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"}`}
                  data-testid={`button-cat-${cat.value}`}>
                  <Icon size={12} />
                  {cat.label}
                  <span className={`text-[10px] px-1 py-0.5 rounded-full ${isActive ? "bg-primary-foreground/20" : "bg-muted"}`}>
                    {counts[cat.value]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="rounded-2xl overflow-hidden border border-border">
                <div className="aspect-[4/5] skeleton" />
                <div className="p-3 bg-card space-y-2"><div className="skeleton h-3 w-24" /><div className="skeleton h-2.5 w-16" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Search size={36} className="mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-2">No templates found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {search ? `No results for "${search}"` : "No templates in this category yet."}
            </p>
            <button onClick={() => { setSearch(""); setActiveCategory("all"); }} className="text-primary text-sm hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                locked={!!t.isPro && !isPro}
                onPreview={() => setPreview(t)}
              />
            ))}
          </div>
        )}

        <div className="mt-10 pt-8 border-t border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm mb-1">Start from scratch</h3>
            <p className="text-xs text-muted-foreground">Blank canvas with all editing tools.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { window.location.hash = "#/editor"; }}>
            Blank Canvas <ArrowRight size={14} />
          </Button>
        </div>
      </main>

      {preview && <PreviewModal template={preview} isPro={isPro} onClose={() => setPreview(null)} />}
    </div>
  );
}
