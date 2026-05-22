import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/AuthProvider";
import { getUtmParams, hasAnalyticsConsent, parseClientUserAgent, shouldTrackPath } from "@/lib/telemetry";

interface UseTelemetryOptions {
  /** Logged-in user id — always tracked when present. */
  userId: number | null | undefined;
}

export function useTelemetry({ userId }: UseTelemetryOptions) {
  const [location] = useLocation();
  const lastPath = useRef<string | null>(null);
  const ua = parseClientUserAgent();
  const isLoggedIn = userId != null && userId > 0;
  const canTrack = isLoggedIn || hasAnalyticsConsent();

  useEffect(() => {
    if (!canTrack) return;

    const sendHeartbeat = () => {
      if (!shouldTrackPath(location)) return;
      apiRequest("POST", "/api/telemetry/heartbeat", {
        pagePath: location,
        referrer: document.referrer || undefined,
        ...getUtmParams(),
        ...ua,
      }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60_000);
    return () => clearInterval(interval);
  }, [canTrack, location, ua.browser, ua.os, ua.deviceType]);

  useEffect(() => {
    if (!canTrack || !shouldTrackPath(location)) return;
    if (lastPath.current === location) return;
    lastPath.current = location;

    apiRequest("POST", "/api/telemetry/event", {
      eventType: "page_view",
      pagePath: location,
      referrer: document.referrer || undefined,
      ...ua,
    }).catch(() => {});
  }, [canTrack, location, ua.browser, ua.os, ua.deviceType]);
}

export function trackFeatureEvent(
  eventType: "feature_click" | "conversion" | "download" | "share_create" | "bulk_generate" | "bulk_download" | "cta_click",
  payload: {
    pagePath?: string;
    action?: string;
    resourceType?: string;
    resourceId?: number;
    meta?: Record<string, unknown>;
  },
) {
  const ua = parseClientUserAgent();
  return apiRequest("POST", "/api/telemetry/event", {
    eventType,
    pagePath: payload.pagePath ?? (window.location.hash.replace(/^#/, "") || "/"),
    action: payload.action,
    resourceType: payload.resourceType,
    resourceId: payload.resourceId,
    meta: payload.meta,
    referrer: document.referrer || undefined,
    ...ua,
  });
}

/** Track marketing CTA taps (e.g. “Get started”, “Browse templates”). */
export function trackCtaClick(action: string, meta?: Record<string, unknown>) {
  return trackFeatureEvent("cta_click", {
    action,
    meta,
    pagePath: typeof window !== "undefined"
      ? window.location.hash.replace(/^#/, "") || "/"
      : "/",
  });
}

/** Hook — respects cookie consent for guests; always tracks for signed-in users. */
export function useCtaTracking() {
  const { user } = useAuth();

  return (action: string, meta?: Record<string, unknown>) => {
    if (localStorage.getItem("cookie_consent") === "declined") return;
    if (!user && !hasAnalyticsConsent()) return;
    trackCtaClick(action, meta).catch(() => {});
  };
}
