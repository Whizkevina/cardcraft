/** Heuristic bot/crawler detection from User-Agent (not foolproof). */
export function isLikelyBot(userAgent: string | undefined | null): boolean {
  if (!userAgent || userAgent.length < 10) return false;
  const ua = userAgent.toLowerCase();
  const patterns = [
    /googlebot|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|petalbot/,
    /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot/,
    /bot\b|crawler|spider|scrapy|headlesschrome|phantomjs|puppeteer|playwright/,
    /curl\/|wget\/|python-requests|go-http-client|axios\/|java\/|libwww/,
    /semrushbot|ahrefsbot|mj12bot|dotbot|rogerbot|archive.org_bot/,
  ];
  return patterns.some(p => p.test(ua));
}

export type VisitorType = "user" | "guest" | "bot";

export function resolveVisitorType(userAgent: string | undefined | null, isLoggedIn: boolean): VisitorType {
  if (isLikelyBot(userAgent)) return "bot";
  if (isLoggedIn) return "user";
  return "guest";
}
