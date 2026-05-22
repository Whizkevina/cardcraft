import type { ReactNode } from "react";
import { hp, hpCn } from "./homeTokens";

interface AppPageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Page title block for app views (projects, settings, bulk, etc.). */
export function AppPageHeader({ eyebrow, title, description, action, className }: AppPageHeaderProps) {
  return (
    <div className={hpCn("flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8 sm:mb-10", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className={hp.eyebrow}>{eyebrow}</p> : null}
        <h1 className={hpCn(hp.display, "text-2xl sm:text-3xl mt-2 tracking-tight")}>{title}</h1>
        {description ? (
          <p className={hpCn(hp.lead, "text-sm mt-2 max-w-xl")}>{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
