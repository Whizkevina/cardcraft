import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 w-full sm:w-auto">{action}</div>}
    </div>
  );
}

export function AdminPanel({
  children,
  className,
  padding = "default",
}: {
  children: ReactNode;
  className?: string;
  padding?: "none" | "default" | "lg";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm",
        padding === "default" && "p-4 sm:p-5",
        padding === "lg" && "p-5 sm:p-6",
        padding === "none" && "overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "gold",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone?: "gold" | "primary" | "blue" | "green";
}) {
  const toneClasses = {
    gold: "bg-primary/10 text-primary",
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-400",
    green: "bg-emerald-500/10 text-emerald-400",
  }[tone];

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={cn("rounded-xl p-2 shrink-0", toneClasses)}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}

export function AdminTabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1 mb-6 scrollbar-none">
      <div
        className={cn(
          "inline-flex min-w-full sm:min-w-0 items-center gap-1 border-b border-border/80 px-1",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      <div className="rounded-2xl bg-secondary/50 p-4 mb-4">
        <Icon size={28} className="text-muted-foreground/70" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>}
    </div>
  );
}

export function userInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold border border-primary/20",
        className,
      )}
      aria-hidden
    >
      {userInitials(name)}
    </div>
  );
}
