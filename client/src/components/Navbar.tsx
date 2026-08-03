import { Link, useLocation } from "wouter";
import { useAuth } from "./AuthProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { User, LogOut, FolderOpen, Shield, Layers, Sparkles, Settings, CreditCard } from "lucide-react";
import { useCtaTracking } from "@/hooks/useTelemetry";

export default function Navbar() {
  const { user, isPro, isAdmin, logout } = useAuth();
  const trackCta = useCtaTracking();
  const [location] = useLocation();
  const isEditor = location.startsWith("/editor");

  if (isEditor) return null;

  const isActive = (href: string) => location === href;

  const navLinks = [
    { href: "/templates", label: "Templates" },
    { href: "/pricing", label: "Pricing" },
    ...(isPro ? [{ href: "/bulk", label: "Bulk Generate" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-[3.75rem]">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2.5 select-none" data-testid="link-home">
            <svg aria-label="CardCraft" viewBox="0 0 32 32" fill="none" className="w-7 h-7">
              <rect width="32" height="32" rx="8" fill="hsl(43 96% 58%)"/>
              <rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="hsl(240 20% 7%)" strokeWidth="2"/>
              <path d="M6 14h20" stroke="hsl(240 20% 7%)" strokeWidth="1.5"/>
              <circle cx="10" cy="20" r="1.5" fill="hsl(240 20% 7%)"/>
              <path d="M13 20h9" stroke="hsl(240 20% 7%)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="font-serif text-base font-semibold tracking-tight hidden sm:block">CardCraft</span>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href}>
              <div className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${isActive(href) ? "nav-pill-active" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"}`}>
                {label}
              </div>
            </Link>
          ))}
          {user && (
            <Link href="/projects">
              <div className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/projects") ? "nav-pill-active" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"}`}>
                My Cards
              </div>
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin">
              <div className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/admin") ? "nav-pill-active" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"}`}>
                Admin
              </div>
            </Link>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-user-menu">
                  <User size={14} />
                  <span className="hidden sm:inline max-w-[80px] truncate">{user.name}</span>
                  {isPro && (
                    <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary text-primary-foreground leading-none">
                      PRO
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {/* Tier status */}
                <div className="px-2 py-2 border-b border-border">
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {isPro ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <Sparkles size={10} /> Pro Plan
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Free · {user.downloadsToday}/3 downloads today
                      </span>
                    )}
                  </div>
                </div>

                <DropdownMenuItem asChild>
                  <Link href="/projects">
                    <div className="flex items-center gap-2 w-full cursor-pointer"><FolderOpen size={14} /> My Cards</div>
                  </Link>
                </DropdownMenuItem>
                {isPro && (
                  <DropdownMenuItem asChild>
                    <Link href="/bulk">
                      <div className="flex items-center gap-2 w-full cursor-pointer"><Layers size={14} /> Bulk Generate</div>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/payments">
                    <div className="flex items-center gap-2 w-full cursor-pointer"><CreditCard size={14} /> Payments</div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <div className="flex items-center gap-2 w-full cursor-pointer"><Settings size={14} /> Account Settings</div>
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <div className="flex items-center gap-2 w-full cursor-pointer"><Shield size={14} /> Admin Panel</div>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut size={14} className="mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-9 px-3" asChild>
                <Link href="/auth" onClick={() => trackCta("nav_sign_in")} data-testid="button-login">Sign In</Link>
              </Button>
              <Button className="h-9 px-4 btn-gold shadow-none font-semibold" asChild>
                <Link href="/templates" onClick={() => trackCta("nav_get_started")} data-testid="button-get-started">Get Started</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
