import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import { hp, hpCn } from "./homeTokens";

interface MarketingPageShellProps {
  children: ReactNode;
  className?: string;
  /** Skip default top padding when page manages its own sections */
  flush?: boolean;
}

/** Standard marketing / app shell: dark page + sticky nav. */
export function MarketingPageShell({ children, className, flush = false }: MarketingPageShellProps) {
  return (
    <div className={hpCn(hp.page, className)}>
      <Navbar />
      <div className={flush ? undefined : "pb-16"}>{children}</div>
    </div>
  );
}
