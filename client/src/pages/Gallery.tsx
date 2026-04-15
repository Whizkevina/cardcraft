import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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

const PREVIEW_THEME_CLASSES: Record<string, { bg: string; accent: string; border: string; fill: string; badge: string }> = {
  "#2d0a5e": { bg: "bg-[#1a0533]", accent: "text-[#FFD700]", border: "border-[#FFD700]", fill: "bg-[#FFD700]", badge: "bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/40" },
  "#FF6B6B": { bg: "bg-[#FF6B6B]", accent: "text-[#FFFFFF]", border: "border-[#FFFFFF]", fill: "bg-[#FFFFFF]", badge: "bg-[#FFFFFF]/15 text-[#FFFFFF] border-[#FFFFFF]/40" },
  "#FAFAF8": { bg: "bg-[#FAFAF8]", accent: "text-[#2D2D2D]", border: "border-[#2D2D2D]", fill: "bg-[#2D2D2D]", badge: "bg-[#2D2D2D]/10 text-[#2D2D2D] border-[#2D2D2D]/30" },
  "#0a1628": { bg: "bg-[#0a1628]", accent: "text-[#D4AF37]", border: "border-[#D4AF37]", fill: "bg-[#D4AF37]", badge: "bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/40" },
  "#4a1942": { bg: "bg-[#4a1942]", accent: "text-[#FFD700]", border: "border-[#FFD700]", fill: "bg-[#FFD700]", badge: "bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/40" },
  "#0f2744": { bg: "bg-[#0f2744]", accent: "text-[#C9A84C]", border: "border-[#C9A84C]", fill: "bg-[#C9A84C]", badge: "bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/40" },
  "#7b3f6e": { bg: "bg-[#7b3f6e]", accent: "text-[#FFB6C1]", border: "border-[#FFB6C1]", fill: "bg-[#FFB6C1]", badge: "bg-[#FFB6C1]/15 text-[#FFB6C1] border-[#FFB6C1]/40" },
  "#5c1a00": { bg: "bg-[#2a0800]", accent: "text-[#f09820]", border: "border-[#f09820]", fill: "bg-[#f09820]", badge: "bg-[#f09820]/15 text-[#f09820] border-[#f09820]/40" },
  "#0d4a2e": { bg: "bg-[#0d4a2e]", accent: "text-[#D4AF37]", border: "border-[#D4AF37]", fill: "bg-[#D4AF37]", badge: "bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/40" },
  "#6b0f2b": { bg: "bg-[#6b0f2b]", accent: "text-[#FFB6C1]", border: "border-[#FFB6C1]", fill: "bg-[#FFB6C1]", badge: "bg-[#FFB6C1]/15 text-[#FFB6C1] border-[#FFB6C1]/40" },
  "#1a4a7a": { bg: "bg-[#1a4a7a]", accent: "text-[#FFFFFF]", border: "border-[#FFFFFF]", fill: "bg-[#FFFFFF]", badge: "bg-[#FFFFFF]/15 text-[#FFFFFF] border-[#FFFFFF]/40" },
  "#7a3a00": { bg: "bg-[#FFF8F0]", accent: "text-[#7a3a00]", border: "border-[#7a3a00]", fill: "bg-[#7a3a00]", badge: "bg-[#7a3a00]/10 text-[#7a3a00] border-[#7a3a00]/30" },
  "#1c3a5c": { bg: "bg-[#1c3a5c]", accent: "text-[#C9A84C]", border: "border-[#C9A84C]", fill: "bg-[#C9A84C]", badge: "bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/40" },
  "#1a1a2e": { bg: "bg-[#1a1a2e]", accent: "text-[#e8b800]", border: "border-[#e8b800]", fill: "bg-[#e8b800]", badge: "bg-[#e8b800]/15 text-[#e8b800] border-[#e8b800]/40" },
  "#8b0000": { bg: "bg-[#1a0000]", accent: "text-[#FF6B6B]", border: "border-[#FF6B6B]", fill: "bg-[#FF6B6B]", badge: "bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/40" },
  "#7a2060": { bg: "bg-[#FDF0F8]", accent: "text-[#7a2060]", border: "border-[#7a2060]", fill: "bg-[#7a2060]", badge: "bg-[#7a2060]/10 text-[#7a2060] border-[#7a2060]/30" },
  "#0a2a4a": { bg: "bg-[#0a2a4a]", accent: "text-[#C9A84C]", border: "border-[#C9A84C]", fill: "bg-[#C9A84C]", badge: "bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/40" },
  "#0a0a1a": { bg: "bg-[#0a0a1a]", accent: "text-[#FFD700]", border: "border-[#FFD700]", fill: "bg-[#FFD700]", badge: "bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/40" },
  "#0d3b1e": { bg: "bg-[#0d3b1e]", accent: "text-[#FF4444]", border: "border-[#FF4444]", fill: "bg-[#FF4444]", badge: "bg-[#FF4444]/15 text-[#FF4444] border-[#FF4444]/40" },
  "#1a2a1a": { bg: "bg-[#FFFFFF]", accent: "text-[#4CAF50]", border: "border-[#4CAF50]", fill: "bg-[#4CAF50]", badge: "bg-[#4CAF50]/15 text-[#4CAF50] border-[#4CAF50]/40" },
};

const getPreviewTheme = (thumbnailColor: string) => PREVIEW_THEME_CLASSES[thumbnailColor] || {
  bg: `bg-[${thumbnailColor}]`,
  accent: "text-[#FFFFFF]",
  border: "border-[#FFFFFF]",
  fill: "bg-[#FFFFFF]",
  badge: "bg-white/15 text-white border-white/40",
};

const previewBarWidthClass = (percentage: number) => {
  if (percentage >= 90) return "w-[78%]";
  if (percentage >= 70) return "w-[72%]";
  if (percentage >= 50) return "w-[60%]";
  if (percentage >= 30) return "w-[48%]";
  return "w-[38%]";
};

// ─── Preview modal ────────────────────────────────────────────────────────────
function PreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const style = ACCENT_MAP[template.thumbnailColor] || { bg: template.thumbnailColor, accent: "#FFFFFF", shape: "circle" };
  const theme = getPreviewTheme(template.thumbnailColor);

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Preview Template</DialogTitle>
        </VisuallyHidden>
        {/* Card preview */}
        <div className={`aspect-[4/5] relative ${theme.bg}`}>
          {style.shape === "circle" ? (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full border-2 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full border-2 opacity-65 ${theme.border}`} />
              <div className={`absolute inset-0 rounded-full ${theme.fill} opacity-10`} />
              <svg viewBox="0 0 24 24" fill="none" className={`relative z-10 w-14 h-14 ${theme.accent} opacity-40`}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
          ) : (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-32 h-32 border-2 flex items-center justify-center">
              <div className={`absolute inset-0 border-2 ${theme.border}`} />
              <svg viewBox="0 0 24 24" fill="none" className={`relative z-10 w-12 h-12 ${theme.accent} opacity-40`}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
          )}

          <div className="absolute bottom-16 left-0 right-0 text-center space-y-2 px-4">
            <div className={`h-4 rounded-full mx-auto ${theme.fill} opacity-80 w-[60%]`} />
            <div className={`h-5 rounded-full mx-auto font-bold ${theme.fill} opacity-95 w-[78%]`} />
            <div className={`h-3 rounded-full mx-auto ${theme.fill} opacity-50 w-[44%]`} />
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-white font-bold text-sm">{template.title}</p>
            <p className="text-white/70 text-xs capitalize">{template.category}</p>
          </div>

          <button onClick={onClose} title="Close preview" className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors">
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
  const theme = getPreviewTheme(template.thumbnailColor);

  return (
    <div
      className="template-card rounded-2xl overflow-hidden border border-border cursor-pointer group"
      onClick={onPreview}
      data-testid={`card-template-${template.id}`}
    >
      <div className={`aspect-[4/5] relative ${theme.bg}`}>
        {style.shape === "circle" ? (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-2 flex items-center justify-center">
            <div className={`absolute inset-0 rounded-full border-2 opacity-65 ${theme.border}`} />
            <div className={`absolute inset-0 rounded-full ${theme.fill} opacity-10`} />
            <svg viewBox="0 0 24 24" fill="none" className={`relative z-10 w-9 h-9 ${theme.accent} opacity-45`}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
        ) : (
          <div className={`absolute top-6 left-6 w-16 h-16 border-2 flex items-center justify-center ${theme.border}`}>
            <svg viewBox="0 0 24 24" fill="none" className={`w-8 h-8 ${theme.accent} opacity-40`}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
        )}

        <div className={`absolute ${style.shape === "circle" ? "bottom-8 left-0 right-0 text-center space-y-1.5" : "bottom-8 left-4 right-2 space-y-1.5"}`}>
          <div className={`h-2.5 rounded-full ${style.shape === "circle" ? "mx-auto w-[55%]" : "w-[70%]"} ${theme.fill} opacity-80`} />
          <div className={`h-3 rounded-full ${style.shape === "circle" ? "mx-auto w-[72%]" : "w-[50%]"} ${theme.fill} opacity-95`} />
          <div className={`h-2 rounded-full ${style.shape === "circle" ? "mx-auto w-[40%]" : "w-[38%]"} ${theme.fill} opacity-50`} />
        </div>

        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold">
            Preview Template
          </div>
        </div>

        <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize border ${theme.badge}`}>
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
          <h1 className="text-3xl font-bold mb-1 font-display">Choose a Template</h1>
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
