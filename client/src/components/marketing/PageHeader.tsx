import { SectionBadge } from "./SectionBadge";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  badge?: { icon?: LucideIcon; label: string };
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

export function PageHeader({
  badge,
  title,
  description,
  align = "center",
  className = "",
}: PageHeaderProps) {
  const centered = align === "center";

  return (
    <div className={`mb-12 ${centered ? "text-center" : ""} ${className}`}>
      {badge ? (
        <div className={centered ? "mb-4" : "mb-4"}>
          <SectionBadge icon={badge.icon}>{badge.label}</SectionBadge>
        </div>
      ) : null}
      <h1 className={`text-3xl sm:text-4xl lg:text-[2.75rem] font-bold mb-3 font-display leading-[1.12] tracking-tight ${centered ? "mx-auto max-w-3xl" : "max-w-2xl"}`}>
        {title}
      </h1>
      {description ? (
        <div className={`text-muted-foreground text-base leading-relaxed ${centered ? "max-w-lg mx-auto" : "max-w-xl"}`}>
          {description}
        </div>
      ) : null}
    </div>
  );
}
