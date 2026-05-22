import type { ReactNode } from "react";
import { hp, hpCn } from "./homeTokens";

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  align = "center",
  className = "",
}: PageHeaderProps) {
  const centered = align === "center";

  return (
    <header
      className={hpCn(
        "mb-10 sm:mb-12",
        centered && "text-center mx-auto max-w-2xl",
        className,
      )}
    >
      {eyebrow ? (
        <p className={hpCn(hp.eyebrow, centered && "justify-center")}>{eyebrow}</p>
      ) : null}
      <h1 className={hpCn(hp.display, "text-3xl sm:text-4xl mt-3 tracking-tight")}>
        {title}
      </h1>
      {description ? (
        <div className={hpCn(hp.lead, "text-base sm:text-lg mt-3 leading-relaxed", centered ? "mx-auto max-w-lg" : hp.copyWide)}>
          {description}
        </div>
      ) : null}
    </header>
  );
}
