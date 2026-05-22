import { CheckCircle } from "lucide-react";
import { SurfaceCard } from "./SurfaceCard";
import { hp, hpCn } from "./homeTokens";

interface PricingCardProps {
  name: string;
  price: React.ReactNode;
  subtitle: string;
  features: string[];
  highlighted?: boolean;
  badge?: React.ReactNode;
  footer: React.ReactNode;
  priceTestId?: string;
  checkMuted?: boolean;
}

export function PricingCard({
  name,
  price,
  subtitle,
  features,
  highlighted = false,
  badge,
  footer,
  priceTestId,
  checkMuted = false,
}: PricingCardProps) {
  return (
    <SurfaceCard
      variant={highlighted ? "raised" : "base"}
      className={hpCn(
        "relative p-6 md:p-7 h-full flex flex-col",
        highlighted && "border-primary/40 ring-1 ring-primary/15",
      )}
    >
      {badge}
      <div className="mb-5">
        <p className={hpCn(hp.label, highlighted && "text-gold")}>{name}</p>
        <p className={hpCn("hp-stat-value text-foreground mt-2")} data-testid={priceTestId}>
          {price}
        </p>
        <p className={hpCn(hp.lead, "text-xs mt-2")}>{subtitle}</p>
      </div>
      <ul className="space-y-2.5 mb-6 flex-1">
        {features.map(f => (
          <li key={f} className={hpCn("flex items-start gap-2.5 text-sm", checkMuted && "text-muted-foreground")}>
            <CheckCircle
              size={14}
              className={hpCn("mt-0.5 shrink-0", checkMuted ? "text-muted-foreground/45" : "text-gold")}
            />
            {f}
          </li>
        ))}
      </ul>
      {footer}
    </SurfaceCard>
  );
}
