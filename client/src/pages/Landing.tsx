import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { SectionBadge } from "@/components/marketing/SectionBadge";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { HeroCardRotator } from "@/components/marketing/HeroCardRotator";
import { TemplateThumbnail } from "@/components/TemplateThumbnail";
import type { Template } from "@shared/schema";
import {
  Sparkles, Download, Palette, Layers, Image, GraduationCap, Church,
  Building2, Undo2, ZoomIn, ArrowRight, CheckCircle, Share2,
} from "lucide-react";

const features = [
  { icon: Palette, title: "20+ Professional Templates", desc: "Birthday, graduation, church, corporate, and seasonal designs — every template fully editable." },
  { icon: Image, title: "Photo Upload", desc: "Upload any portrait. Scale, reposition, and fit it perfectly inside the card frame." },
  { icon: Layers, title: "Layer-Based Editing", desc: "Click any element to edit it. Drag, resize, reorder layers, lock decorative elements." },
  { icon: Undo2, title: "Undo / Redo", desc: "Never lose your work. Full history stack with keyboard shortcuts." },
  { icon: ZoomIn, title: "Zoom & Pan", desc: "Scroll to zoom in and inspect details. Works on desktop and mobile." },
  { icon: Download, title: "High-Res Export", desc: "Download PNG, JPG, or SVG at multiple size presets including 1080×1080 for social." },
  { icon: Sparkles, title: "Rich Text Controls", desc: "Font family, size, color, bold, italic, opacity, and drop shadow — all adjustable." },
  { icon: Share2, title: "Share & Bulk Generate", desc: "Copy a public share link with preview, or upload a CSV to generate cards for every name." },
];


const steps = [
  { n: "01", title: "Pick a Template", desc: "Choose from professionally designed card styles for any occasion." },
  { n: "02", title: "Upload Your Photo", desc: "Add a portrait. It slots directly into the card frame." },
  { n: "03", title: "Personalize Everything", desc: "Edit name, date, greeting, colors, and fonts in real time." },
  { n: "04", title: "Download & Share", desc: "Export as PNG or JPG, or copy a share link with a live preview." },
];

export default function Landing() {
  const goTemplates = () => { window.location.hash = "#/templates"; };

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/templates");
      return res.json();
    },
  });

  const showcase = templates.slice(0, 8);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden section-glow">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/10 blur-[160px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-14 lg:pt-20 lg:pb-16">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <SectionBadge icon={Sparkles}>Personalized cards, ready to download</SectionBadge>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold mt-5 mb-5 leading-[1.1] font-display tracking-tight">
                Create stunning cards<br />
                <span className="logo-text">in minutes, not hours</span>
              </h1>

              <p className="text-muted-foreground text-lg max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                Design beautiful birthday, graduation, church, and corporate cards. Upload a photo, customize every detail, and download a print-ready file — no design skills needed.
              </p>

              <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
                <Link href="/templates">
                  <Button size="lg" className="btn-gold px-8 gap-2 text-base h-11" data-testid="button-start-creating">
                    <Sparkles size={16} /> Start Designing — Free
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="px-8 text-base gap-2 h-11 border-primary/30 hover:border-primary/50 hover:bg-primary/5">
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>

            {/* Featured card showcase */}
            <div className="relative max-w-sm mx-auto lg:max-w-none lg:ml-auto w-full">
              <div className="absolute -inset-4 rounded-3xl bg-primary/8 blur-2xl pointer-events-none" />
              <div className="relative premium-card rounded-2xl p-4 shadow-premium-lg">
                <HeroCardRotator templates={templates} />
              </div>
            </div>
          </div>

          {/* Template strip */}
          <div className="mt-14 lg:mt-16">
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3 max-w-4xl mx-auto">
              {showcase.length > 0 ? showcase.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={goTemplates}
                  className="template-card rounded-xl overflow-hidden border border-border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  data-testid={`card-preview-${i}`}
                >
                  <TemplateThumbnail template={t} compact className="rounded-none aspect-[3/4]" />
                  <div className="px-1.5 py-1.5 bg-card border-t border-border">
                    <span className="text-[10px] sm:text-xs font-medium leading-tight block truncate">{t.title}</span>
                  </div>
                </button>
              )) : [0,1,2,3,4,5,6,7].map(i => (
                <div key={i} className="aspect-[3/4] rounded-xl skeleton" />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-5 text-center">
              {templates.length > 0 ? `${templates.length} templates across birthdays, graduations, church, and corporate events` : "20+ templates across birthdays, graduations, church, and corporate events"}
            </p>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-y border-border py-6 bg-secondary/25">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-center gap-3">
          {[
            { icon: Sparkles, label: "Birthday", count: "8+ designs" },
            { icon: GraduationCap, label: "Graduation", count: "2 designs" },
            { icon: Church, label: "Church Events", count: "2 designs" },
            { icon: Building2, label: "Corporate", count: "3 designs" },
            { icon: Layers, label: "Bulk Generate", count: "Pro feature" },
          ].map(({ icon: Icon, label, count }) => (
            <Link
              key={label}
              href={label === "Bulk Generate" ? "/bulk" : "/templates"}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border hover:border-primary/35 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-foreground shadow-sm"
            >
              <Icon size={13} className="text-gold" />
              <span className="font-medium">{label}</span>
              <span className="text-xs opacity-70">{count}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="page-section border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 font-display">How it works</h2>
            <p className="text-muted-foreground text-sm">From zero to a downloadable card in under 5 minutes.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="relative premium-card rounded-2xl p-5">
                <p className="text-3xl font-bold text-gold/25 mb-3 font-display">{s.n}</p>
                <h3 className="font-semibold text-sm mb-1.5">{s.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{s.desc}</p>
                {i < steps.length - 1 && (
                  <ArrowRight size={14} className="hidden lg:block absolute top-8 -right-3 text-muted-foreground/25" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="page-section">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 font-display">
              Everything you need to design great cards
            </h2>
            <p className="text-muted-foreground text-sm max-w-md">
              A full canvas editor built for non-designers — powerful enough for design teams.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <FeatureCard
                key={f.title}
                icon={f.icon}
                title={f.title}
                description={f.desc}
                testId={`card-feature-${i}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-10 border-t border-border bg-secondary/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            {[
              "No account required to design",
              "Free to download",
              "Works on mobile and desktop",
              "PNG, JPG & SVG export",
              "Share links with preview",
            ].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle size={12} className="text-gold flex-shrink-0" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="page-section border-t border-border">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="cta-panel px-8 py-10">
            <h2 className="text-2xl font-bold mb-2 font-display">Ready to create your first card?</h2>
            <p className="text-muted-foreground mb-6 text-sm">Start designing free — sign in to save cards and remove watermarks with Pro.</p>
            <Link href="/templates">
              <Button size="lg" className="btn-gold gap-2 px-10 h-11">
                <Sparkles size={16} /> Browse Templates
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg aria-label="CardCraft" viewBox="0 0 32 32" fill="none" className="w-6 h-6">
              <rect width="32" height="32" rx="8" fill="hsl(43 96% 58%)"/>
              <rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="#222" strokeWidth="2"/>
              <path d="M6 14h20" stroke="#222" strokeWidth="1.5"/>
              <circle cx="10" cy="20" r="1.5" fill="#222"/>
              <path d="M13 20h9" stroke="#222" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-sm font-semibold logo-text">CardCraft</span>
          </div>
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/templates" className="hover:text-foreground transition-colors">Templates</Link>
            <Link href="/bulk" className="hover:text-foreground transition-colors">Bulk Generate</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
          </nav>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <span>&copy; {new Date().getFullYear()} CardCraft</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
