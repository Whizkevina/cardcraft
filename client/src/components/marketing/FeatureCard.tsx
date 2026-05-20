import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  testId?: string;
}

export function FeatureCard({ icon: Icon, title, description, testId }: FeatureCardProps) {
  return (
    <div
      className="premium-card group rounded-2xl p-5 h-full"
      data-testid={testId}
    >
      <div className="w-9 h-9 rounded-xl bg-primary/12 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/18 transition-colors">
        <Icon size={17} className="text-gold" strokeWidth={2} />
      </div>
      <h3 className="font-semibold text-sm mb-2 tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
    </div>
  );
}
