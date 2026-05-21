import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { getUtmParams, parseClientUserAgent, shouldTrackPath } from "@/lib/telemetry";

interface UseTelemetryOptions {
  userId: number | null | undefined;
}

export function useTelemetry({ userId }: UseTelemetryOptions) {
  const [location] = useLocation();
  const lastPath = useRef<string | null>(null);
  const ua = parseClientUserAgent();

  useEffect(() => {
    if (!userId) return;

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
  }, [userId, location, ua.browser, ua.os, ua.deviceType]);

  useEffect(() => {
    if (!userId || !shouldTrackPath(location)) return;
    if (lastPath.current === location) return;
    lastPath.current = location;

    apiRequest("POST", "/api/telemetry/event", {
      eventType: "page_view",
      pagePath: location,
      referrer: document.referrer || undefined,
      ...ua,
    }).catch(() => {});
  }, [userId, location, ua.browser, ua.os, ua.deviceType]);
}

export function trackFeatureEvent(
  eventType: "feature_click" | "conversion" | "download" | "share_create" | "bulk_generate" | "bulk_download",
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
