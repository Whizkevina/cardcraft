import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Navbar from "../components/Navbar";
import { useCtaTracking } from "@/hooks/useTelemetry";
import { hp } from "@/components/marketing/homeTokens";
import { HomeHero } from "@/components/marketing/HomeHero";
import { HomeShowcaseStrip } from "@/components/marketing/HomeShowcaseStrip";
import { HomeProcess } from "@/components/marketing/HomeProcess";
import { HomeFeatures } from "@/components/marketing/HomeFeatures";
import { HomeCta } from "@/components/marketing/HomeCta";
import { HomeFooter } from "@/components/marketing/HomeFooter";
import type { Template } from "@shared/schema";

export default function Landing() {
  const trackCta = useCtaTracking();

  const goTemplates = (source: string) => {
    trackCta("showcase_template", { source });
    window.location.hash = "#/templates";
  };

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/templates");
      return res.json();
    },
  });

  return (
    <div className={hp.page}>
      <Navbar />

      <HomeHero
        templates={templates}
        templateCount={templates.length}
        onStartDesigning={() => trackCta("hero_start_designing")}
        onViewPricing={() => trackCta("hero_view_pricing")}
      />

      <HomeShowcaseStrip
        templates={templates}
        onSelectTemplate={goTemplates}
        onNavigate={(trackId, meta) => trackCta(trackId, meta)}
      />

      <HomeProcess />

      <HomeFeatures />

      <HomeCta
        onBrowseTemplates={() => trackCta("bottom_browse_templates")}
        onViewPricing={() => trackCta("footer_pricing")}
      />

      <HomeFooter onTrack={action => trackCta(action)} />
    </div>
  );
}
