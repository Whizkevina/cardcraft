/** Shared SEO copy for index.html injection and sitemap generation. */
export const SITE_META = {
  name: "CardCraft",
  title: "CardCraft — Cards Worth Sending, Built in Minutes",
  description:
    "Design birthday, graduation, church, and corporate greeting cards in your browser. Upload a portrait, customize every layer, and export print-ready PNG, JPG, or SVG files.",
  keywords:
    "greeting card maker, birthday card design, graduation cards online, church event cards, photo greeting cards, custom card templates, online card designer, bulk card generator, CardCraft",
  ogDescription:
    "Upload a portrait, personalize every layer, and export a print-ready card — for birthdays, graduations, church events, and corporate milestones.",
  twitterTitle: "CardCraft — Professional Greeting Cards in Minutes",
  twitterDescription:
    "Curated templates, portrait-first layouts, and high-resolution exports — all in your browser. Start designing free.",
  themeColor: "#c9a84c",
  locale: "en_US",
} as const;

export const PUBLIC_ROUTES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/templates", changefreq: "weekly", priority: "0.9" },
  { path: "/pricing", changefreq: "monthly", priority: "0.8" },
  { path: "/auth", changefreq: "monthly", priority: "0.5" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
] as const;

export function resolveAppUrl(fallback = "https://cardcraft.app"): string {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  return configured || fallback;
}

export function injectSiteMeta(html: string, appUrl: string): string {
  const ogImage = `${appUrl}/og-image.png`;
  const canonical = `${appUrl}/`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_META.name,
    url: canonical,
    description: SITE_META.description,
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return html
    .replaceAll("__APP_URL__", appUrl)
    .replaceAll("__CANONICAL_URL__", canonical)
    .replaceAll("__OG_IMAGE_URL__", ogImage)
    .replaceAll("__JSON_LD__", JSON.stringify(jsonLd));
}

export function buildRobotsTxt(appUrl: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${appUrl}/sitemap.xml
`;
}

export function buildSitemapXml(appUrl: string): string {
  const urls = PUBLIC_ROUTES.map(
    (route) => `  <url>
    <loc>${appUrl}/#${route.path === "/" ? "" : route.path}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
