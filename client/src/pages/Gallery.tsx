import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Palette, GraduationCap, Building2, Church, Flower2 } from "lucide-react";
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
};

function TemplateCard({ template }: { template: Template }) {
  const style = ACCENT_MAP[template.thumbnailColor] || { bg: template.thumbnailColor, accent: "#FFFFFF", shape: "circle" };

  return (
    <div
      className="template-card rounded-2xl overflow-hidden border border-border cursor-pointer group"
      data-testid={`card-template-${template.id}`}
      onClick={() => { window.location.hash = `#/editor/t/${template.id}`; }}
    >
      {/* Visual preview */}
      <div className="aspect-[4/5] relative" style={{ background: style.bg }}>
        {/* Photo frame mockup */}
        {style.shape === "circle" ? (
          <div
            className="absolute top-8 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: style.accent, opacity: 0.65, background: `${style.accent}11` }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10" style={{ color: style.accent, opacity: 0.5 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
        ) : (
          <div
            className="absolute top-8 left-8 w-20 h-20 border-2 flex items-center justify-center"
            style={{ borderColor: style.accent }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" style={{ color: style.accent, opacity: 0.4 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
        )}

        {/* Text placeholders */}
        <div className={`absolute ${style.shape === "circle" ? "bottom-10 left-0 right-0 text-center space-y-2" : "bottom-10 left-8 right-4 space-y-2"}`}>
          <div className={`h-2.5 rounded-full ${style.shape === "circle" ? "mx-auto" : ""}`} style={{ background: style.accent, opacity: 0.8, width: style.shape === "circle" ? "55%" : "70%" }} />
          <div className={`h-3.5 rounded-full ${style.shape === "circle" ? "mx-auto" : ""}`} style={{ background: style.accent, opacity: 0.95, width: style.shape === "circle" ? "72%" : "55%" }} />
          <div className={`h-2 rounded-full ${style.shape === "circle" ? "mx-auto" : ""}`} style={{ background: style.accent, opacity: 0.5, width: style.shape === "circle" ? "42%" : "40%" }} />
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Sparkles size={14} /> Use Template
          </div>
        </div>

        {/* Category badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: `${style.accent}22`, color: style.accent, border: `1px solid ${style.accent}44` }}>
          {template.category}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-card flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{template.title}</h3>
          <p className="text-xs text-muted-foreground capitalize">{template.category}</p>
        </div>
        <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}

export default function Gallery() {
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/templates");
      return res.json();
    },
  });

  const filtered = activeCategory === "all"
    ? templates
    : templates.filter(t => t.category === activeCategory);

  const counts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.value] = cat.value === "all" ? templates.length : templates.filter(t => t.category === cat.value).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-xs font-medium text-gold mb-4">
            <Palette size={11} /> Card Templates
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Boska', Georgia, serif" }}>
            Choose a Template
          </h1>
          <p className="text-muted-foreground">
            {templates.length} professional designs — fully editable photo, text, colors, and fonts.
          </p>
        </div>

        {/* Category filter tabs */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 flex-nowrap">
          {CATEGORIES.filter(c => c.value === "all" || counts[c.value] > 0).map(cat => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
                data-testid={`button-cat-${cat.value}`}
              >
                <Icon size={14} />
                {cat.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary-foreground/20" : "bg-muted"}`}>
                  {counts[cat.value]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-2xl overflow-hidden border border-border">
                <div className="aspect-[4/5] skeleton" />
                <div className="p-4 bg-card space-y-2">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Palette size={40} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No templates in this category</h3>
            <p className="text-muted-foreground text-sm mb-4">Try another category or check back later.</p>
            <button onClick={() => setActiveCategory("all")} className="text-primary text-sm hover:underline">Show all templates</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map(t => <TemplateCard key={t.id} template={t} />)}
          </div>
        )}

        {/* Blank canvas */}
        <div className="mt-10 pt-8 border-t border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm mb-1">Start from scratch</h3>
            <p className="text-xs text-muted-foreground">Blank canvas with all editing tools available.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { window.location.hash = '#/editor'; }}>
            Blank Canvas <ArrowRight size={14} />
          </Button>
        </div>
      </main>
    </div>
  );
}
