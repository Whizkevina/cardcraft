import type { ReactNode } from "react";
import { hp, hpCn } from "./homeTokens";

type SectionTone = "default" | "muted" | "contrast" | "grid";

interface MarketingSectionProps {
  id?: string;
  children: ReactNode;
  /** Vertical rhythm preset */
  spacing?: "open" | "default" | "compact" | "flush";
  tone?: SectionTone;
  className?: string;
  containerClassName?: string;
  wide?: boolean;
}

const toneClass: Record<SectionTone, string> = {
  default: "",
  muted: "hp-tone-muted",
  contrast: "hp-tone-contrast",
  grid: "hp-tone-grid",
};

export function MarketingSection({
  id,
  children,
  spacing = "default",
  tone = "default",
  className,
  containerClassName,
  wide = false,
}: MarketingSectionProps) {
  return (
    <section id={id} className={hpCn(hp.section[spacing], toneClass[tone], className)}>
      <div className={hpCn(wide ? hp.containerWide : hp.container, containerClassName)}>
        {children}
      </div>
    </section>
  );
}
