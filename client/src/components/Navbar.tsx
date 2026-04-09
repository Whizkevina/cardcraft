import { Link, useLocation } from "wouter";
import { useAuth } from "./AuthProvider";
import { useTheme } from "./ThemeProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Sun, Moon, User, LogOut, FolderOpen, Shield, Layers, Sparkles, Settings, CreditCard } from "lucide-react";

export default function Navbar() {
  const { user, isPro, isAdmin, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [location] = useLocation();
  const isEditor = location.startsWith("/editor");

  if (isEditor) return null;

  const isActive = (href: string) => location === href;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/">
          <a className="flex items-center gap-2 select-none" data-testid="link-home">
            <svg aria-label="CardCraft" viewBox="0 0 32 32" fill="none" className="w-7 h-7">
              <rect width="32" height="32" rx="8" fill="hsl(43 96% 58%)"/>
              <rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="hsl(240 20% 7%)" strokeWidth="2"/>
              <path d="M6 14h20" stroke="hsl(240 20% 7%)" strokeWidth="1.5"/>
              <circle cx="10" cy="20" r="1.5" fill="hsl(240 20% 7%)"/>
              <path d="M13 20h9" stroke="hsl(240 20% 7%)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="font-bold text-base tracking-tight logo-text hidden sm:block">CardCraft</span>
          </a>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {[{ href: "/templates", label: "Templates" }, { href: "/bulk", label: "Bulk Generate" }].map(({ href, label }) => (
            <Link key={href} href={href}>
              <a className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive(href) ? "bg-accent/20 text-gold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                {label}
              </a>
            </Link>
          ))}
          {user && (
            <Link href="/projects">
              <a className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive("/projects") ? "bg-accent/20 text-gold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                My Cards
              </a>
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin">
              <a className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive("/admin") ? "bg-accent/20 text-gold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                Admin
              </a>
            </Link>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button onClick={toggle} data-testid="button-theme-toggle"
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

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
                    <a className="flex items-center gap-2 w-full cursor-pointer"><FolderOpen size={14} /> My Cards</a>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/bulk">
                    <a className="flex items-center gap-2 w-full cursor-pointer"><Layers size={14} /> Bulk Generate</a>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/payments">
                    <a className="flex items-center gap-2 w-full cursor-pointer"><CreditCard size={14} /> Payments</a>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <a className="flex items-center gap-2 w-full cursor-pointer"><Settings size={14} /> Account Settings</a>
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <a className="flex items-center gap-2 w-full cursor-pointer"><Shield size={14} /> Admin Panel</a>
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
              <Link href="/auth">
                <Button variant="ghost" size="sm" data-testid="button-login">Sign In</Button>
              </Link>
              <Link href="/templates">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-get-started">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
