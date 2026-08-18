import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroCardRotator } from "./HeroCardRotator";
import { HeroBackgroundSlides } from "./HeroBackgroundSlides";
import { MarketingSection } from "./MarketingSection";
import { SurfaceCard } from "./SurfaceCard";
import { hp, hpCn } from "./homeTokens";
import type { Template } from "@shared/schema";

interface HomeHeroProps {
  templates: Template[];
  templateCount: number;
  onStartDesigning: () => void;
  onViewPricing: () => void;
}

export function HomeHero({
  templates,
  templateCount,
  onStartDesigning,
  onViewPricing,
}: HomeHeroProps) {
  const stats = [
    { value: templateCount > 0 ? `${templateCount}+` : "20+", label: "Curated templates" },
    { value: "Print-ready", label: "High-resolution exports" },
    { value: "Portrait-first", label: "Photo-centered layouts" },
  ];

  return (
    <MarketingSection id="home-hero" spacing="open" className="relative overflow-hidden">
      <HeroBackgroundSlides />
      <div className="hp-hero-content grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-12 lg:gap-16 items-center">
        <div className="text-center lg:text-left">
          <p className={hp.eyebrow}>Card design studio</p>

          <h1 className={hpCn(hp.display, "text-4xl sm:text-5xl lg:text-[3.4rem] mt-5 mb-5")}>
            Cards worth sending.
            <span className="block mt-1 text-[#e8c37a]">Built in minutes.</span>
          </h1>

          <p className={hpCn(hp.lead, hp.copy, "mx-auto lg:mx-0 mb-8")}>
            Upload a portrait, personalize every layer, and export a print-ready file for birthdays,
            graduations, church events, and corporate milestones.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 mb-10">
            <Link href="/templates" onClick={onStartDesigning}>
              <Button size="lg" className={hpCn(hp.btnPrimary, "w-full sm:w-auto")} data-testid="button-start-creating">
                <Sparkles size={16} /> Start designing for free
              </Button>
            </Link>
            <Link href="/pricing" onClick={onViewPricing}>
              <Button
                size="lg"
                variant="ghost"
                className={hpCn(hp.btnSecondary, "w-full sm:w-auto text-white/80 border-white/25 hover:bg-white/10 hover:border-white/45 hover:text-white")}
              >
                See pricing
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto lg:mx-0 pt-6 border-t border-white/15">
            {stats.map(s => (
              <div key={s.label} className="text-left">
                <p className="hp-stat-value text-gold">{s.value}</p>
                <p className="hp-stat-label">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative w-full max-w-md mx-auto lg:max-w-none lg:justify-self-end">
          <SurfaceCard variant="raised" className="p-3 sm:p-4">
            <div className="rounded-lg overflow-hidden border border-border/80 bg-[hsl(var(--hp-surface-inset))]">
              <HeroCardRotator templates={templates} showCaption={false} />
            </div>
            <p className="hp-label mt-4 px-1">Live preview, rotates through published designs</p>
          </SurfaceCard>
        </div>
      </div>
    </MarketingSection>
  );
}
