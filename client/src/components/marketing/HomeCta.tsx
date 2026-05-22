import { Link } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingSection } from "./MarketingSection";
import { SurfaceCard } from "./SurfaceCard";
import { hp, hpCn } from "./homeTokens";

interface HomeCtaProps {
  onBrowseTemplates: () => void;
  onViewPricing: () => void;
}

const proof = [
  { value: "Browser", label: "No install required" },
  { value: "5 min", label: "Template to export" },
  { value: "Every layer", label: "Fully editable" },
  { value: "High-res", label: "Print & social sizes" },
];

export function HomeCta({ onBrowseTemplates, onViewPricing }: HomeCtaProps) {
  return (
    <MarketingSection spacing="default">
      <SurfaceCard variant="raised" className="overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/60 border-b border-border/60">
          {proof.map(item => (
            <div key={item.label} className="bg-[hsl(var(--hp-surface-raised))] px-5 py-4 sm:py-5">
              <p className="text-sm sm:text-base font-semibold text-foreground">{item.value}</p>
              <p className={hpCn(hp.lead, "text-xs mt-1")}>{item.label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 lg:gap-12 p-8 sm:p-10 lg:p-12">
          <div>
            <p className={hp.eyebrow}>Get started</p>
            <h2 className={hpCn(hp.display, "text-2xl sm:text-3xl mt-4 mb-3")}>
              Your next card is one template away
            </h2>
            <p className={hpCn(hp.lead, "text-sm sm:text-base max-w-lg")}>
              Design free today. Sign in to save projects, upgrade for watermark-free exports, and unlock bulk generation when volume matters.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-3 lg:border-l lg:border-border/60 lg:pl-10">
            <Link href="/templates" onClick={onBrowseTemplates}>
              <Button size="lg" className={hpCn(hp.btnPrimary, "w-full")}>
                <Sparkles size={16} /> Browse templates
              </Button>
            </Link>
            <Link href="/pricing" onClick={onViewPricing}>
              <Button size="lg" variant="ghost" className={hpCn(hp.btnSecondary, "w-full justify-center group")}>
                Compare plans
                <ArrowRight size={14} className="opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <p className={hpCn(hp.lead, "text-xs text-center lg:text-left pt-1")}>
              No credit card required to start designing.
            </p>
          </div>
        </div>
      </SurfaceCard>
    </MarketingSection>
  );
}
