import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared admin dashboard spacing & surface tokens */
export const adminTokens = {
  gap: "gap-3",
  sectionGap: "space-y-4",
  radius: "rounded-xl",
  panel: "rounded-xl border border-border/50 bg-card shadow-sm",
  panelPadding: "p-4",
  kpiMinHeight: "min-h-[92px]",
} as const;

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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 w-full sm:w-auto">{action}</div>}
    </div>
  );
}

export function AdminDashboardSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(adminTokens.sectionGap, className)}>
      {(title || action) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <div>
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              {description && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
              )}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function AdminPanel({
  children,
  className,
  padding = "default",
}: {
  children: ReactNode;
  className?: string;
  padding?: "none" | "default" | "sm" | "lg";
}) {
  return (
    <div
      className={cn(
        adminTokens.panel,
        padding === "default" && adminTokens.panelPadding,
        padding === "sm" && "p-3",
        padding === "lg" && "p-4 sm:p-5",
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
  compact,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between",
      compact ? "mb-2" : "mb-3",
    )}>
      <div>
        <h3 className="text-sm font-semibold leading-none">{title}</h3>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

const kpiIconTones = {
  neutral: "bg-muted/80 text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
} as const;

export type AdminKpiTone = keyof typeof kpiIconTones;

export function AdminKpiCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: { text: string; positive?: boolean };
  icon?: LucideIcon;
  tone?: AdminKpiTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        adminTokens.panel,
        adminTokens.kpiMinHeight,
        "flex h-full flex-col justify-between p-3.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-tight">
          {label}
        </p>
        {Icon && (
          <div className={cn("rounded-md p-1.5 shrink-0", kpiIconTones[tone])}>
            <Icon size={13} strokeWidth={2} />
          </div>
        )}
      </div>
      <div className="mt-2.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-xl font-semibold tracking-tight tabular-nums leading-none">{value}</p>
          {delta && (
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
                delta.positive === false
                  ? "bg-destructive/10 text-destructive"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              )}
            >
              {delta.text}
            </span>
          )}
        </div>
        {hint && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">{hint}</p>
        )}
      </div>
    </div>
  );
}

/** Uniform responsive grid for KPI rows */
export function AdminKpiGrid({
  children,
  cols = 4,
  className,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const colClass =
    cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cols === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("grid", colClass, adminTokens.gap, className)}>
      {children}
    </div>
  );
}

/** Premium combined KPI strip — single surface with dividers on desktop */
export function AdminKpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        adminTokens.panel,
        "grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border/50 overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminKpiStripItem({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: { text: string; positive?: boolean };
  icon?: LucideIcon;
  tone?: AdminKpiTone;
}) {
  return (
    <div className="flex flex-col justify-center px-4 py-3.5 min-h-[88px]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && (
          <div className={cn("rounded-md p-1 shrink-0", kpiIconTones[tone])}>
            <Icon size={12} strokeWidth={2} />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-lg sm:text-xl font-semibold tabular-nums tracking-tight">{value}</p>
        {delta && (
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
              delta.positive === false
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {delta.text}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/** @deprecated Use AdminKpiCard — kept for gradual migration */
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
  const toneMap: Record<string, AdminKpiTone> = {
    gold: "primary",
    primary: "primary",
    blue: "info",
    green: "success",
  };
  return (
    <AdminKpiCard
      label={label}
      value={value}
      hint={sub}
      icon={Icon}
      tone={toneMap[tone] ?? "neutral"}
    />
  );
}

export function AdminTabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-1 overflow-x-auto pb-0 mb-4 scrollbar-none">
      <div
        className={cn(
          "inline-flex min-w-full sm:min-w-0 items-center gap-0.5 border-b border-border/60 px-1",
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
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="rounded-xl bg-muted/50 p-3 mb-3">
        <Icon size={22} className="text-muted-foreground/70" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
    </div>
  );
}

export function AdminListRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-sm border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors",
        className,
      )}
    >
      {children}
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
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold border border-primary/15",
        className,
      )}
      aria-hidden
    >
      {userInitials(name)}
    </div>
  );
}
