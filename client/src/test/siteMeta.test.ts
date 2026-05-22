import { describe, expect, it } from "vitest";
import { injectSiteMeta, buildRobotsTxt, buildSitemapXml } from "../../../server/siteMeta";

describe("siteMeta", () => {
  it("injects app URL and OG image placeholders", () => {
    const html = `<link rel="canonical" href="__CANONICAL_URL__" />
<meta property="og:image" content="__OG_IMAGE_URL__" />
<script type="application/ld+json">__JSON_LD__</script>`;
    const out = injectSiteMeta(html, "https://example.com");
    expect(out).toContain('href="https://example.com/"');
    expect(out).toContain('content="https://example.com/og-image.png"');
    expect(out).toContain('"@type":"WebApplication"');
    expect(out).not.toContain("__CANONICAL_URL__");
  });

  it("builds robots.txt with sitemap", () => {
    expect(buildRobotsTxt("https://example.com")).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("builds sitemap with hash routes", () => {
    const xml = buildSitemapXml("https://example.com");
    expect(xml).toContain("https://example.com/#/templates");
    expect(xml).toContain("https://example.com/#/pricing");
  });
});
