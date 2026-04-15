import { Link } from "wouter";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { Sparkles, Download, Palette, Layers, Image, GraduationCap, Church, Building2, Undo2, ZoomIn, ArrowRight, CheckCircle } from "lucide-react";

const features = [
  { icon: Palette, title: "8 Professional Templates", desc: "Birthday, graduation, church anniversaries, and corporate milestones — every design fully editable." },
  { icon: Image, title: "Photo Upload", desc: "Upload any portrait. Scale, reposition, and fit it perfectly inside the card frame." },
  { icon: Layers, title: "Layer-Based Editing", desc: "Click any element to edit it. Drag, resize, reorder layers, lock decorative elements." },
  { icon: Undo2, title: "Undo / Redo", desc: "Never lose your work. Full history stack with keyboard shortcuts." },
  { icon: ZoomIn, title: "Zoom & Pan", desc: "Scroll to zoom in and inspect details. Works on desktop and mobile." },
  { icon: Download, title: "High-Res Export", desc: "Download in PNG or JPG at multiple size presets including 1080×1080 for social media." },
  { icon: Sparkles, title: "Rich Text Controls", desc: "Font family, size, color, bold, italic, opacity, and drop shadow — all adjustable." },
  { icon: Layers, title: "Bulk Generator", desc: "Upload a CSV and generate a personalized card for every name automatically." },
];

const TEMPLATES = [
  { label: "Royal Elegance", cat: "Birthday" },
  { label: "Vibrant Celebration", cat: "Birthday" },
  { label: "Modern Minimal", cat: "Birthday" },
  { label: "Golden Graduation", cat: "Graduation" },
  { label: "Church Anniversary", cat: "Church" },
  { label: "Corporate Milestone", cat: "Corporate" },
  { label: "Floral Birthday", cat: "Birthday" },
  { label: "ICT Group Style", cat: "Birthday" },
];

const TEMPLATE_CLASSES = [
  "template-preview-royal",
  "template-preview-vibrant",
  "template-preview-minimal",
  "template-preview-graduation",
  "template-preview-church",
  "template-preview-corporate",
  "template-preview-floral",
  "template-preview-ict",
];

const steps = [
  { n: "01", title: "Pick a Template", desc: "Choose from professionally designed card styles for any occasion." },
  { n: "02", title: "Upload Your Photo", desc: "Add a portrait. It slots directly into the card frame." },
  { n: "03", title: "Personalize Everything", desc: "Edit name, date, greeting, colors, and fonts in real time." },
  { n: "04", title: "Download & Share", desc: "Export as PNG or JPG, ready for WhatsApp, print, or Instagram." },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/8 blur-[140px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-xs font-medium text-gold mb-5">
            <Sparkles size={11} /> Personalized cards, ready to download
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight font-display">
            Create Stunning Cards<br />
            <span className="logo-text">In Minutes, Not Hours</span>
          </h1>

          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8 leading-relaxed">
            Design beautiful birthday, graduation, church, and corporate cards. Upload a photo, customize every detail, and download a print-ready file — no design skills needed.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <Link href="/templates">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 gap-2 text-base" data-testid="button-start-creating">
                <Sparkles size={16} /> Start Designing — Free
              </Button>
            </Link>
            <Link href="/bulk">
              <Button size="lg" variant="outline" className="px-8 text-base gap-2">
                <Layers size={14} /> Bulk Generator
              </Button>
            </Link>
          </div>

          {/* Template preview strip */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-w-3xl mx-auto">
            {TEMPLATES.map((t, i) => (
              <div
                key={i}
                className={`template-card ${TEMPLATE_CLASSES[i]} rounded-xl overflow-hidden border border-border cursor-pointer aspect-square relative`}
                onClick={() => { window.location.hash = "#/templates"; }}
                data-testid={`card-preview-${i}`}
              >
                <div className="absolute inset-0 flex items-end justify-center pb-1.5">
                  <span className={`text-[7px] font-medium leading-tight text-center px-1 template-label-${i}`}>{t.label}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">8 templates across 4 occasion types</p>
        </div>
      </section>

      {/* ── Category strip ─────────────────────────────────────────────── */}
      <section className="border-y border-border py-5 bg-secondary/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-center gap-3">
          {[
            { icon: Sparkles, label: "Birthday Cards", count: "4 designs" },
            { icon: GraduationCap, label: "Graduation", count: "1 design" },
            { icon: Church, label: "Church Events", count: "1 design" },
            { icon: Building2, label: "Corporate", count: "1 design" },
            { icon: Layers, label: "Bulk Generate", count: "CSV upload" },
          ].map(({ icon: Icon, label, count }) => (
            <Link key={label} href={label === "Bulk Generate" ? "/bulk" : "/templates"} className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-foreground">
              <Icon size={13} className="text-gold" />
              <span className="font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{count}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="py-16 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 font-display">
              How it works
            </h2>
            <p className="text-muted-foreground text-sm">From zero to a downloadable card in under 5 minutes.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="relative">
                <p className="text-4xl font-bold text-gold/20 mb-3 font-display">{s.n}</p>
                <h3 className="font-semibold text-sm mb-1.5">{s.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{s.desc}</p>
                {i < steps.length - 1 && (
                  <ArrowRight size={14} className="hidden lg:block absolute top-10 -right-3 text-muted-foreground/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="py-16">
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
              <div key={i} className="bg-card rounded-xl p-4 border border-border hover:border-primary/30 transition-colors" data-testid={`card-feature-${i}`}>
                <f.icon size={17} className="text-gold mb-3" />
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof / trust signals ───────────────────────────────── */}
      <section className="py-10 border-t border-border bg-secondary/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            {[
              "No account required to design",
              "Free to download",
              "Works on mobile and desktop",
              "PNG & JPG export",
              "WhatsApp & print ready",
            ].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle size={12} className="text-gold flex-shrink-0" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="py-16 border-t border-border">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-2 font-display">
            Ready to create your first card?
          </h2>
          <p className="text-muted-foreground mb-6 text-sm">No sign-up. No watermarks. Just design and download.</p>
          <Link href="/templates">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-10">
              <Sparkles size={16} /> Browse Templates
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg aria-label="CardCraft" viewBox="0 0 32 32" fill="none" className="w-6 h-6">
              <rect width="32" height="32" rx="8" fill="hsl(43 96% 58%)"/>
              <rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="hsl(240 20% 7%)" strokeWidth="2"/>
              <path d="M6 14h20" stroke="hsl(240 20% 7%)" strokeWidth="1.5"/>
              <circle cx="10" cy="20" r="1.5" fill="hsl(240 20% 7%)"/>
              <path d="M13 20h9" stroke="hsl(240 20% 7%)" strokeWidth="1.5" strokeLinecap="round"/>
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
