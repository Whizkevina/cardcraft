import { Link } from "wouter";
import { hp, hpCn } from "./homeTokens";

interface HomeFooterProps {
  onTrack: (action: string) => void;
}

export function HomeFooter({ onTrack }: HomeFooterProps) {
  return (
    <footer className="border-t border-border/80 bg-[hsl(var(--hp-surface-inset))]">
      <div className={hpCn(hp.containerWide, "py-12 sm:py-14")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <svg aria-label="CardCraft" viewBox="0 0 32 32" fill="none" className="w-7 h-7">
                <rect width="32" height="32" rx="8" fill="hsl(43 96% 58%)" />
                <rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="hsl(240 20% 7%)" strokeWidth="2" />
                <path d="M6 14h20" stroke="hsl(240 20% 7%)" strokeWidth="1.5" />
                <circle cx="10" cy="20" r="1.5" fill="hsl(240 20% 7%)" />
                <path d="M13 20h9" stroke="hsl(240 20% 7%)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="font-serif text-base font-semibold tracking-tight">CardCraft</span>
            </div>
            <p className={hpCn(hp.lead, "text-sm max-w-xs")}>
              A focused card studio for people who need polished results, fast.
            </p>
          </div>

          <div>
            <p className={hp.label}>Product</p>
            <nav className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="/templates" onClick={() => onTrack("footer_templates")} className="hover:text-foreground transition-colors">Templates</Link>
              <Link href="/bulk" onClick={() => onTrack("footer_bulk")} className="hover:text-foreground transition-colors">Bulk generate</Link>
              <Link href="/pricing" onClick={() => onTrack("footer_pricing")} className="hover:text-foreground transition-colors">Pricing</Link>
            </nav>
          </div>

          <div>
            <p className={hp.label}>Account</p>
            <nav className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="/auth" onClick={() => onTrack("footer_sign_in")} className="hover:text-foreground transition-colors">Sign in</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            </nav>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} CardCraft. All rights reserved.</span>
          <span>Designed for clarity · Built for production</span>
        </div>
      </div>
    </footer>
  );
}
