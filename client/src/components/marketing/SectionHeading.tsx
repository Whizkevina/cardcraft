import type { ReactNode } from "react";
import { hp, hpCn } from "./homeTokens";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeadingProps) {
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
      <h2 className={hpCn(hp.display, "text-3xl sm:text-4xl tracking-tight mt-3")}>
        {title}
      </h2>
      {description ? (
        <p className={hpCn(hp.lead, "text-base sm:text-lg mt-3 leading-relaxed", !centered && hp.copyWide)}>
          {description}
        </p>
      ) : null}
    </header>
  );
}
