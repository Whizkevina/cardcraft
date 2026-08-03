import { Download, Image, Palette, Share2 } from "lucide-react";
import { FeatureCard } from "./FeatureCard";
import { MarketingSection } from "./MarketingSection";
import { PageHeader } from "./PageHeader";

const features = [
  {
    icon: Palette,
    title: "Curated templates",
    desc: "Birthday, graduation, church, corporate, and seasonal layouts — each one fully editable.",
  },
  {
    icon: Image,
    title: "Portrait framing",
    desc: "Upload a photo and fit it cleanly inside the card frame with scale and position controls.",
  },
  {
    icon: Download,
    title: "Print-ready export",
    desc: "PNG, JPG, or SVG at high resolution — including 1080×1080 for social posts.",
  },
  {
    icon: Share2,
    title: "Share & bulk generate",
    desc: "Publish a preview link for one card, or run CSV-driven batches for teams.",
  },
];

export function HomeFeatures() {
  return (
    <MarketingSection spacing="default" tone="contrast" className="border-y border-border/60">
      <PageHeader
        level="h2"
        eyebrow="Editor"
        title="Four things that matter"
        description="Templates, portraits, exports, and scale — without a sprawling toolbar or design degree."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {features.map((f, i) => (
          <FeatureCard
            key={f.title}
            icon={f.icon}
            title={f.title}
            description={f.desc}
            variant={i === 0 ? "featured" : "default"}
            testId={`card-feature-${i}`}
          />
        ))}
      </div>
    </MarketingSection>
  );
}
