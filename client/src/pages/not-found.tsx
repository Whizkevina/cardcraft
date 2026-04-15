import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Palette, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Animated 404 */}
        <div className="relative mb-8">
          <p className="text-[120px] font-bold leading-none select-none font-display text-gold/15">404</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-2xl border-2 border-primary/30 bg-primary/5 flex items-center justify-center">
              <Search size={36} className="text-primary/50" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2 font-display">
          Page not found
        </h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          The page you're looking for doesn't exist or may have been moved. Let's get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/">
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
              <Home size={15} /> Go Home
            </Button>
          </Link>
          <Link href="/templates">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <Palette size={15} /> Browse Templates
            </Button>
          </Link>
        </div>

        <button onClick={() => window.history.back()} className="mt-5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 mx-auto transition-colors">
          <ArrowLeft size={12} /> Go back to previous page
        </button>
      </div>
    </div>
  );
}
