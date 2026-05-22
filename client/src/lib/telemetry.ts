export function parseClientUserAgent(): { browser: string; os: string; deviceType: string } {
  const s = typeof navigator !== "undefined" ? navigator.userAgent : "";
  let browser = "Unknown";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/Chrome\//i.test(s)) browser = "Chrome";
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = "Safari";
  else if (/Firefox\//i.test(s)) browser = "Firefox";

  let os = "Unknown";
  if (/Windows/i.test(s)) os = "Windows";
  else if (/Mac OS X/i.test(s)) os = "macOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/iPhone|iPad/i.test(s)) os = "iOS";
  else if (/Linux/i.test(s)) os = "Linux";

  let deviceType = "desktop";
  if (/iPad|Tablet/i.test(s)) deviceType = "tablet";
  else if (/Mobile|Android|iPhone/i.test(s)) deviceType = "mobile";

  return { browser, os, deviceType };
}

export function getUtmParams(): { utmSource?: string; utmCampaign?: string } {
  if (typeof window === "undefined") return {};
  const hash = window.location.hash || "";
  const qs = hash.includes("?") ? hash.split("?")[1] : window.location.search.slice(1);
  const params = new URLSearchParams(qs);
  return {
    utmSource: params.get("utm_source") ?? undefined,
    utmCampaign: params.get("utm_campaign") ?? undefined,
  };
}

const SKIP_PATHS = ["/forgot-password", "/reset-password"];

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("cookie_consent") === "accepted";
}

export function shouldTrackPath(path: string): boolean {
  return !SKIP_PATHS.some(p => path.startsWith(p));
}
