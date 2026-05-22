import { Link } from "wouter";
import { hpCn } from "./homeTokens";

interface BrandLogoProps {
  showText?: boolean;
  className?: string;
  href?: string;
}

export function BrandLogo({ showText = true, className, href = "/" }: BrandLogoProps) {
  const content = (
    <>
      <svg aria-label="CardCraft" viewBox="0 0 32 32" fill="none" className="w-8 h-8 shrink-0">
        <rect width="32" height="32" rx="8" fill="hsl(43 96% 58%)" />
        <rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="hsl(240 20% 7%)" strokeWidth="2" />
        <path d="M6 14h20" stroke="hsl(240 20% 7%)" strokeWidth="1.5" />
        <circle cx="10" cy="20" r="1.5" fill="hsl(240 20% 7%)" />
        <path d="M13 20h9" stroke="hsl(240 20% 7%)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {showText ? (
        <span className="font-serif text-xl font-semibold tracking-tight">CardCraft</span>
      ) : null}
    </>
  );

  return (
    <Link href={href} className={hpCn("inline-flex items-center gap-2.5 hover:opacity-90 transition-opacity", className)}>
      {content}
    </Link>
  );
}
