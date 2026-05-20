import { CheckCircle } from "lucide-react";

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
    <div
      className={
        highlighted
          ? "relative premium-card rounded-2xl p-6 md:p-7 border-2 border-primary shadow-premium-lg"
          : "premium-card rounded-2xl p-6 md:p-7"
      }
    >
      {badge}
      <div className="mb-5">
        <p className={`text-sm font-medium mb-1 ${highlighted ? "text-gold" : "text-muted-foreground"}`}>{name}</p>
        <div className="flex items-end gap-2">
          <p className="text-4xl font-bold tracking-tight" data-testid={priceTestId}>{price}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
      </div>
      <ul className="space-y-2.5 mb-6">
        {features.map((f) => (
          <li key={f} className={`flex items-start gap-2.5 text-sm ${checkMuted ? "text-muted-foreground" : ""}`}>
            <CheckCircle
              size={14}
              className={`mt-0.5 flex-shrink-0 ${checkMuted ? "text-muted-foreground/50" : "text-primary"}`}
            />
            {f}
          </li>
        ))}
      </ul>
      {footer}
    </div>
  );
}
