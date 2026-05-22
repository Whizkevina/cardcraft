import { cn } from "@/lib/utils";

/** Semantic homepage layout + surface tokens (pairs with .hp-* in index.css). */
export const hp = {
  page: "hp-page min-h-screen bg-background text-foreground",
  container: "hp-container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8",
  containerWide: "hp-container-wide max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
  copy: "hp-copy max-w-xl",
  copyWide: "hp-copy-wide max-w-2xl",

  section: {
    open: "hp-section hp-section-open",
    default: "hp-section hp-section-default",
    compact: "hp-section hp-section-compact",
    flush: "hp-section hp-section-flush",
  },

  surface: {
    base: "hp-surface",
    raised: "hp-surface hp-surface-raised",
    inset: "hp-surface hp-surface-inset",
    ghost: "hp-surface hp-surface-ghost",
  },

  eyebrow: "hp-eyebrow",
  display: "hp-display font-serif",
  lead: "hp-lead text-muted-foreground",
  label: "hp-label",

  btnPrimary: "btn-gold h-11 px-6 text-sm font-semibold gap-2 rounded-lg",
  btnSecondary:
    "h-11 px-6 text-sm font-medium gap-2 rounded-lg border border-border bg-transparent hover:bg-secondary/60 hover:border-border/80 transition-colors",

  filterPill:
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border",
  filterPillActive: "bg-primary/12 border-primary/30 text-foreground",
  filterPillIdle: "bg-transparent border-border/70 text-muted-foreground hover:text-foreground hover:border-border",
} as const;

export function hpCn(...classes: (string | false | null | undefined)[]) {
  return cn(...classes);
}
