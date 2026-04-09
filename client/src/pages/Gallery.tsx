import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, ArrowRight, Palette, GraduationCap, Church, Building2, Search, X } from "lucide-react";
import type { Template } from "@shared/schema";

const CATEGORIES = [
  { value: "all", label: "All", icon: Palette },
  { value: "birthday", label: "Birthday", icon: Sparkles },
  { value: "celebration", label: "Celebrations", icon: Sparkles },
  { value: "graduation", label: "Graduation", icon: GraduationCap },
  { value: "anniversary", label: "Anniversary", icon: Church },
  { value: "church", label: "Church", icon: Church },
  { value: "corporate", label: "Corporate", icon: Building2 },
  { value: "achievement", label: "Achievement", icon: Building2 },
  { value: "eid", label: "Eid", icon: Sparkles },
];

const ACCENT_MAP: Record<string, { bg: string; accent: string; shape: "circle" | "square" }> = {
  "#2d0a5e": { bg: "#1a0533", accent: "#FFD700", shape: "circle" },
  "#FF6B6B": { bg: "#FF6B6B", accent: "#FFFFFF", shape: "circle" },
  "#FAFAF8": { bg: "#FAFAF8", accent: "#2D2D2D", shape: "square" },
  "#0a1628": { bg: "#0a1628", accent: "#D4AF37", shape: "circle" },
  "#4a1942": { bg: "#4a1942", accent: "#FFD700", shape: "circle" },
  "#0f2744": { bg: "#0f2744", accent: "#C9A84C", shape: "square" },
  "#7b3f6e": { bg: "#7b3f6e", accent: "#FFB6C1", shape: "circle" },
  "#5c1a00": { bg: "#2a0800", accent: "#f09820", shape: "square" },
  "#0d4a2e": { bg: "#0d4a2e", accent: "#D4AF37", shape: "circle" },
  "#6b0f2b": { bg: "#6b0f2b", accent: "#FFB6C1", shape: "circle" },
  "#1a4a7a": { bg: "#1a4a7a", accent: "#FFFFFF", shape: "circle" },
  "#7a3a00": { bg: "#FFF8F0", accent: "#7a3a00", shape: "square" },
  "#1c3a5c": { bg: "#1c3a5c", accent: "#C9A84C", shape: "circle" },
  "#1a1a2e": { bg: "#1a1a2e", accent: "#e8b800", shape: "circle" },
  "#8b0000": { bg: "#1a0000", accent: "#FF6B6B", shape: "circle" },
  "#7a2060": { bg: "#FDF0F8", accent: "#7a2060", shape: "circle" },
  "#0a2a4a": { bg: "#0a2a4a", accent: "#C9A84C", shape: "circle" },
  "#0a0a1a": { bg: "#0a0a1a", accent: "#FFD700", shape: "circle" },
  "#0d3b1e": { bg: "#0d3b1e", accent: "#FF4444", shape: "circle" },
  "#1a2a1a": { bg: "#FFFFFF", accent: "#4CAF50", shape: "circle" },
};

// ─── Preview modal ────────────────────────────────────────────────────────────
function PreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const style = ACCENT_MAP[template.thumbnailColor] || { bg: template.thumbnailColor, accent: "#FFFFFF", shape: "circle" };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        {/* Card preview */}
        <div className="aspect-[4/5] relative" style={{ background: style.bg }}>
          {style.shape === "circle" ? (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full border-2 flex items-center justify-center"
              style={{ borderColor: style.accent, opacity: 0.65, background: `${style.accent}11` }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-14 h-14" style={{ color: style.accent, opacity: 0.4 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
          ) : (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-32 h-32 border-2 flex items-center justify-center"
              style={{ borderColor: style.accent }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12" style={{ color: style.accent, opacity: 0.4 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
          )}

          <div className="absolute bottom-16 left-0 right-0 text-center space-y-2 px-4">
            <div className="h-4 rounded-full mx-auto" style={{ background: style.accent, opacity: 0.8, width: "60%" }} />
            <div className="h-5 rounded-full mx-auto font-bold" style={{ background: style.accent, opacity: 0.95, width: "78%" }} />
            <div className="h-3 rounded-full mx-auto" style={{ background: style.accent, opacity: 0.5, width: "44%" }} />
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-white font-bold text-sm">{template.title}</p>
            <p className="text-white/70 text-xs capitalize">{template.category}</p>
          </div>

          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            onClick={() => { onClose(); window.location.hash = `#/editor/t/${template.id}`; }}
            data-testid={`button-use-template-${template.id}`}
          >
            <Sparkles size={14} /> Use This Template
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            All elements are fully customizable in the editor
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────
function TemplateCard({ template, onPreview }: { template: Template; onPreview: () => void }) {
  const style = ACCENT_MAP[template.thumbnailColor] || { bg: template.thumbnailColor, accent: "#FFFFFF", shape: "circle" };

  return (
    <div
      className="template-card rounded-2xl overflow-hidden border border-border cursor-pointer group"
      onClick={onPreview}
      data-testid={`card-template-${template.id}`}
    >
      <div className="aspect-[4/5] relative" style={{ background: style.bg }}>
        {style.shape === "circle" ? (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: style.accent, opacity: 0.65, background: `${style.accent}11` }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9" style={{ color: style.accent, opacity: 0.45 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
        ) : (
          <div className="absolute top-6 left-6 w-16 h-16 border-2 flex items-center justify-center" style={{ borderColor: style.accent }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" style={{ color: style.accent, opacity: 0.4 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
        )}

        <div className={`absolute ${style.shape === "circle" ? "bottom-8 left-0 right-0 text-center space-y-1.5" : "bottom-8 left-4 right-2 space-y-1.5"}`}>
          <div className={`h-2.5 rounded-full ${style.shape === "circle" ? "mx-auto" : ""}`} style={{ background: style.accent, opacity: 0.8, width: style.shape === "circle" ? "55%" : "70%" }} />
          <div className={`h-3 rounded-full ${style.shape === "circle" ? "mx-auto" : ""}`} style={{ background: style.accent, opacity: 0.95, width: style.shape === "circle" ? "72%" : "50%" }} />
          <div className={`h-2 rounded-full ${style.shape === "circle" ? "mx-auto" : ""}`} style={{ background: style.accent, opacity: 0.5, width: style.shape === "circle" ? "40%" : "38%" }} />
        </div>

        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold">
            Preview Template
          </div>
        </div>

        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize"
          style={{ background: `${style.accent}22`, color: style.accent, border: `1px solid ${style.accent}44` }}>
          {template.category}
        </div>
      </div>

      <div className="p-3 bg-card flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-xs">{template.title}</h3>
          <p className="text-[11px] text-muted-foreground capitalize">{template.category}</p>
        </div>
        <ArrowRight size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}

// ─── Gallery page ─────────────────────────────────────────────────────────────
export default function Gallery() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Template | null>(null);

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
        {/* Header */}
        <div className="mb-7">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-xs font-medium text-gold mb-4">
            <Palette size={11} /> {templates.length} Card Templates
          </div>
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Boska', Georgia, serif" }}>Choose a Template</h1>
          <p className="text-muted-foreground text-sm">Click any template to preview it, then open in the editor to customize.</p>
        </div>

        {/* Search + category filters */}
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
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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

        {/* Grid */}
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
            {filtered.map(t => <TemplateCard key={t.id} template={t} onPreview={() => setPreview(t)} />)}
          </div>
        )}

        {/* Blank canvas */}
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

      {/* Preview modal */}
      {preview && <PreviewModal template={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
