import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { PageHeader } from "@/components/marketing/PageHeader";
import { SurfaceCard } from "@/components/marketing/SurfaceCard";
import { TemplateThumbnail } from "@/components/TemplateThumbnail";
import { hp, hpCn } from "@/components/marketing/homeTokens";
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
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-xl border-border" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Preview Template</DialogTitle>
        </VisuallyHidden>
        <div className="relative">
          <TemplateThumbnail template={template} showCategory showProBadge />
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/75 to-transparent pointer-events-none">
            <p className="text-white font-semibold text-sm">{template.title}</p>
            <p className="text-white/70 text-xs capitalize">{template.category}</p>
          </div>
          <button
            onClick={onClose}
            title="Close preview"
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3 bg-card">
          {template.isPro && !isPro ? (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground hp-surface-inset rounded-lg px-3 py-2.5">
                <Lock size={12} className="text-gold shrink-0" />
                Pro template — upgrade to customize this design.
              </div>
              <Link href="/pricing">
                <Button className={hpCn(hp.btnPrimary, "w-full")}>
                  <Crown size={14} /> Upgrade to Pro
                </Button>
              </Link>
            </>
          ) : (
            <Button
              className={hpCn(hp.btnPrimary, "w-full")}
              onClick={() => { onClose(); window.location.hash = `#/editor/t/${template.id}`; }}
              data-testid={`button-use-template-${template.id}`}
            >
              <Sparkles size={14} /> Use this template
            </Button>
          )}
          <p className="text-center text-xs text-muted-foreground">Every element is editable in the canvas</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ template, onPreview, locked }: { template: Template; onPreview: () => void; locked?: boolean }) {
  return (
    <SurfaceCard
      variant="base"
      className="template-card overflow-hidden cursor-pointer group"
      testId={`card-template-${template.id}`}
    >
      <div onClick={onPreview} className="block">
        <TemplateThumbnail
          template={template}
          showCategory
          showProBadge
          locked={locked}
          hoverOverlay={
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-black/50 border border-white/20">
                Preview
              </span>
            </div>
          }
        />
        <div className="p-3 flex items-center justify-between border-t border-border/70">
          <div className="min-w-0">
            <h3 className="font-semibold text-xs truncate">{template.title}</h3>
            <p className="text-[11px] text-muted-foreground capitalize">{template.category}</p>
          </div>
          <ArrowRight size={13} className="text-muted-foreground group-hover:text-gold transition-colors shrink-0" />
        </div>
      </div>
    </SurfaceCard>
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
    <MarketingPageShell>
      <MarketingSection spacing="default">
        <PageHeader
          align="left"
          eyebrow={`${templates.length} templates`}
          title="Choose a starting point"
          description="Preview any design, then open it in the editor to customize names, photos, and colors."
          className="mb-8"
        />

        <SurfaceCard variant="inset" className="p-4 sm:p-5 mb-8 space-y-4">
          <div className="relative max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title or category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 text-sm bg-background/50 border-border/80"
              data-testid="input-template-search"
            />
            {search && (
              <button onClick={() => setSearch("")} title="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {CATEGORIES.filter(c => c.value === "all" || counts[c.value] > 0).map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setActiveCategory(cat.value)}
                  className={hpCn(hp.filterPill, isActive ? hp.filterPillActive : hp.filterPillIdle)}
                  data-testid={`button-cat-${cat.value}`}
                >
                  <Icon size={12} />
                  {cat.label}
                  <span className="text-[10px] opacity-70 tabular-nums">{counts[cat.value]}</span>
                </button>
              );
            })}
          </div>
        </SurfaceCard>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-xl overflow-hidden border border-border">
                <div className="aspect-[4/5] skeleton" />
                <div className="p-3 space-y-2"><div className="skeleton h-3 w-24" /><div className="skeleton h-2.5 w-16" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Search size={32} className="mx-auto text-muted-foreground mb-3 opacity-60" />
            <h3 className={hpCn(hp.display, "text-lg mb-2")}>No templates found</h3>
            <p className={hpCn(hp.lead, "text-sm mb-4")}>
              {search ? `No results for "${search}"` : "No templates in this category yet."}
            </p>
            <button onClick={() => { setSearch(""); setActiveCategory("all"); }} className="text-sm text-gold hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
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

        <SurfaceCard variant="ghost" className="mt-10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">Prefer a blank canvas?</p>
            <p className={hpCn(hp.lead, "text-xs mt-1")}>Start from scratch with the full editor toolkit.</p>
          </div>
          <Button variant="outline" size="sm" className={hp.btnSecondary} onClick={() => { window.location.hash = "#/editor"; }}>
            Blank canvas <ArrowRight size={14} />
          </Button>
        </SurfaceCard>
      </MarketingSection>

      {preview && <PreviewModal template={preview} isPro={isPro} onClose={() => setPreview(null)} />}
    </MarketingPageShell>
  );
}
