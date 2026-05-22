import type { LucideIcon } from "lucide-react";
import { SurfaceCard } from "./SurfaceCard";
import { hp, hpCn } from "./homeTokens";

type FeatureVariant = "default" | "featured" | "compact";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  testId?: string;
  variant?: FeatureVariant;
  className?: string;
}

const variantStyles: Record<FeatureVariant, { surface: "base" | "raised" | "inset"; body: string; icon: string }> = {
  default: {
    surface: "base",
    body: "p-5",
    icon: "w-9 h-9 rounded-lg",
  },
  featured: {
    surface: "raised",
    body: "p-6 sm:p-7",
    icon: "w-10 h-10 rounded-lg",
  },
  compact: {
    surface: "inset",
    body: "p-4",
    icon: "w-8 h-8 rounded-md",
  },
};

export function FeatureCard({
  icon: Icon,
  title,
  description,
  testId,
  variant = "default",
  className,
}: FeatureCardProps) {
  const v = variantStyles[variant];

  return (
    <SurfaceCard variant={v.surface} className={hpCn("h-full group", className)} testId={testId}>
      <div className={v.body}>
        <div
          className={hpCn(
            v.icon,
            "flex items-center justify-center mb-4 border border-primary/15 bg-primary/8",
            "group-hover:border-primary/25 group-hover:bg-primary/12 transition-colors",
          )}
        >
          <Icon size={variant === "compact" ? 15 : 17} className="text-gold" strokeWidth={2} />
        </div>
        <h3 className={hpCn("font-semibold tracking-tight mb-2", variant === "featured" ? "text-base" : "text-sm")}>
          {title}
        </h3>
        <p className={hpCn(hp.lead, "text-sm leading-relaxed")}>{description}</p>
      </div>
    </SurfaceCard>
  );
}
