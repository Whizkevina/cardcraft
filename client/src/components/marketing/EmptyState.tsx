import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "./SurfaceCard";
import type { LucideIcon } from "lucide-react";
import { hp, hpCn } from "./homeTokens";

interface EmptyStateAction {
  label: string;
  href: string;
  icon?: LucideIcon;
  variant?: "default" | "outline";
  testId?: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
}

export function EmptyState({ icon: Icon, title, description, actions = [] }: EmptyStateProps) {
  return (
    <div className="text-center py-16 sm:py-20 px-4 max-w-md mx-auto">
      <SurfaceCard variant="inset" className="w-20 h-20 mx-auto mb-6 flex items-center justify-center">
        <Icon size={32} className="text-gold/85" strokeWidth={1.5} />
      </SurfaceCard>
      <h3 className={hpCn(hp.display, "text-xl mb-2")}>{title}</h3>
      <p className={hpCn(hp.lead, "text-sm mb-7")}>{description}</p>
      {actions.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {actions.map(action => {
            const ActionIcon = action.icon;
            const btn = (
              <Button
                variant={action.variant === "outline" ? "outline" : "default"}
                className={action.variant === "outline" ? hp.btnSecondary : hp.btnPrimary}
                data-testid={action.testId}
              >
                {ActionIcon ? <ActionIcon size={15} /> : null}
                {action.label}
              </Button>
            );
            return (
              <Link key={action.href + action.label} href={action.href}>
                {btn}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
