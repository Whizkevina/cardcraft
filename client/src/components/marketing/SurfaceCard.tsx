import type { ReactNode } from "react";
import { hp, hpCn } from "./homeTokens";

type SurfaceVariant = "base" | "raised" | "inset" | "ghost";

interface SurfaceCardProps {
  children: ReactNode;
  variant?: SurfaceVariant;
  className?: string;
  as?: "div" | "article";
  testId?: string;
}

const variantMap: Record<SurfaceVariant, string> = {
  base: hp.surface.base,
  raised: hp.surface.raised,
  inset: hp.surface.inset,
  ghost: hp.surface.ghost,
};

export function SurfaceCard({
  children,
  variant = "base",
  className,
  as: Tag = "div",
  testId,
}: SurfaceCardProps) {
  return (
    <Tag className={hpCn(variantMap[variant], "rounded-xl", className)} data-testid={testId}>
      {children}
    </Tag>
  );
}
