import type { LucideIcon } from "lucide-react";

interface SectionBadgeProps {
  icon?: LucideIcon;
  children: React.ReactNode;
}

export function SectionBadge({ icon: Icon, children }: SectionBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/12 border border-primary/25 text-xs font-medium text-gold tracking-wide">
      {Icon ? <Icon size={11} strokeWidth={2.25} /> : null}
      {children}
    </div>
  );
}
