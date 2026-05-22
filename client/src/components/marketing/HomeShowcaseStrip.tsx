import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import { Building2, Church, GraduationCap, Layers, Sparkles } from "lucide-react";
import { TemplateThumbnail } from "@/components/TemplateThumbnail";
import { MarketingSection } from "./MarketingSection";
import { hp, hpCn } from "./homeTokens";
import type { Template } from "@shared/schema";

interface UseCase {
  icon: LucideIcon;
  label: string;
  href: string;
  trackId: string;
}

const useCases: UseCase[] = [
  { icon: Sparkles, label: "Birthday", href: "/templates", trackId: "category_browse" },
  { icon: GraduationCap, label: "Graduation", href: "/templates", trackId: "category_browse" },
  { icon: Church, label: "Church events", href: "/templates", trackId: "category_browse" },
  { icon: Building2, label: "Corporate", href: "/templates", trackId: "category_browse" },
  { icon: Layers, label: "Bulk generate", href: "/bulk", trackId: "category_bulk_generate" },
];

interface HomeShowcaseStripProps {
  templates: Template[];
  onSelectTemplate: (source: string) => void;
  onNavigate: (trackId: string, meta?: Record<string, unknown>) => void;
}

export function HomeShowcaseStrip({ templates, onSelectTemplate, onNavigate }: HomeShowcaseStripProps) {
  const showcase = templates.slice(0, 10);

  return (
    <MarketingSection spacing="compact" tone="muted">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
        <div>
          <p className={hp.label}>Template library</p>
          <h2 className={hpCn(hp.display, "text-xl sm:text-2xl mt-1")}>Start from a polished base</h2>
        </div>
        <p className={hpCn(hp.lead, "text-sm max-w-sm")}>
          {templates.length > 0
            ? `${templates.length} editable designs across occasions and formats.`
            : "Professional layouts for every occasion — fully customizable in the editor."}
        </p>
      </div>

      <div className="hp-filmstrip mb-5">
        {showcase.length > 0 ? showcase.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTemplate(`filmstrip_${i}`)}
            className={hpCn(
              "template-card shrink-0 w-[7.5rem] sm:w-[8.5rem] scroll-snap-align-start",
              "rounded-lg overflow-hidden text-left border border-border/80 bg-card",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
            data-testid={`card-preview-${i}`}
          >
            <TemplateThumbnail template={t} compact className="rounded-none aspect-[3/4]" />
            <div className="px-2 py-2 border-t border-border/80">
              <span className="text-[10px] sm:text-xs font-medium block truncate">{t.title}</span>
            </div>
          </button>
        )) : Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[7.5rem] aspect-[3/4] rounded-lg skeleton" />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={hpCn(hp.label, "mr-1")}>Occasions</span>
        {useCases.map(item => (
          <Link
            key={item.label}
            href={item.href}
            onClick={() => onNavigate(item.trackId, { category: item.label })}
            className={hpCn(hp.filterPill, hp.filterPillIdle, "hover:border-border")}
          >
            <item.icon size={11} className="text-gold/90" />
            {item.label}
          </Link>
        ))}
      </div>
    </MarketingSection>
  );
}
