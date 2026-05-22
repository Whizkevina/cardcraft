import type { Express, Request } from "express";
import { buildRobotsTxt, buildSitemapXml, resolveAppUrl } from "./siteMeta";
import { getAppBaseUrl } from "./sharePublic";

function siteBaseUrl(req: Request): string {
  try {
    return getAppBaseUrl(req);
  } catch {
    return resolveAppUrl();
  }
}

export function registerSeoRoutes(app: Express) {
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(buildRobotsTxt(siteBaseUrl(req)));
  });

  app.get("/sitemap.xml", (req, res) => {
    res.type("application/xml").send(buildSitemapXml(siteBaseUrl(req)));
  });
}
