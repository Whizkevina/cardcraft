import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

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
    <div className="text-center py-20 px-4 max-w-md mx-auto">
      <div className="relative w-28 h-28 mx-auto mb-6">
        <div className="absolute inset-0 rounded-2xl bg-primary/8 blur-xl" />
        <div className="relative inset-0 w-full h-full rounded-2xl bg-card border border-border shadow-premium flex items-center justify-center">
          <Icon size={36} className="text-gold/80" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="font-display text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed mb-7">{description}</p>
      {actions.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {actions.map((action) => {
            const ActionIcon = action.icon;
            const btn = (
              <Button
                variant={action.variant === "outline" ? "outline" : "default"}
                className={action.variant === "outline" ? "gap-2" : "gap-2 btn-gold"}
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
