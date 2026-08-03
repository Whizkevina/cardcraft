import type { ReactNode } from "react";
import { hp, hpCn } from "./homeTokens";

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  /** h1 for a page's own title (default), h2 for a section heading within a page. */
  level?: "h1" | "h2";
  className?: string;
}

/**
 * Canonical marketing/page heading — eyebrow + display title + lead copy.
 * Use `level="h2"` for a section heading nested under a page's own h1.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  align,
  level = "h1",
  className = "",
}: PageHeaderProps) {
  const resolvedAlign = align ?? (level === "h1" ? "center" : "left");
  const centered = resolvedAlign === "center";
  const Heading = level;

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
      <Heading className={hpCn(hp.display, "text-3xl sm:text-4xl mt-3 tracking-tight")}>
        {title}
      </Heading>
      {description ? (
        <div className={hpCn(hp.lead, "text-base sm:text-lg mt-3 leading-relaxed", centered ? "mx-auto max-w-lg" : hp.copyWide)}>
          {description}
        </div>
      ) : null}
    </header>
  );
}
