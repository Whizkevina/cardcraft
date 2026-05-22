import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { hp, hpCn } from "@/components/marketing/homeTokens";
import { Home, ArrowLeft, Palette, Search } from "lucide-react";

export default function NotFound() {
  return (
    <MarketingPageShell>
      <MarketingSection spacing="open" containerClassName="max-w-md mx-auto px-4 text-center">
        <div className="relative mb-8">
          <p className="text-[120px] font-bold leading-none select-none font-serif text-gold/15">404</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={hpCn(hp.surface.inset, "w-24 h-24 rounded-2xl flex items-center justify-center")}>
              <Search size={36} className="text-gold/50" />
            </div>
          </div>
        </div>

        <h1 className={hpCn(hp.display, "text-2xl mb-2")}>Page not found</h1>
        <p className={hpCn(hp.lead, "text-sm mb-8 leading-relaxed")}>
          The page you're looking for doesn't exist or may have been moved. Let's get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/">
            <Button className={hpCn(hp.btnPrimary, "w-full sm:w-auto")}>
              <Home size={15} /> Go Home
            </Button>
          </Link>
          <Link href="/templates">
            <Button variant="outline" className={hpCn(hp.btnSecondary, "w-full sm:w-auto")}>
              <Palette size={15} /> Browse Templates
            </Button>
          </Link>
        </div>

        <button onClick={() => window.history.back()} className="mt-5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 mx-auto transition-colors">
          <ArrowLeft size={12} /> Go back to previous page
        </button>
      </MarketingSection>
    </MarketingPageShell>
  );
}
