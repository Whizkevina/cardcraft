import type { Request } from "express";
import {
  PRO_PRICE_NGN,
  type PricingQuote,
  convertFromNgn,
  currencyForCountry,
  formatMoney,
} from "@shared/pricing";

const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Fallback rates (1 NGN → target) if the FX API is unreachable */
const FALLBACK_NGN_RATES: Record<string, number> = {
  NGN: 1,
  USD: 0.00065,
  EUR: 0.0006,
  GBP: 0.00051,
  CAD: 0.00089,
  AUD: 0.00098,
  CNY: 0.0047,
  JPY: 0.097,
  INR: 0.054,
  GHS: 0.0098,
  KES: 0.084,
  ZAR: 0.012,
};

let fxCache: { rates: Record<string, number>; fetchedAt: number } | null = null;

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "127.0.0.1";
}

async function lookupCountryByIp(ip: string): Promise<string | null> {
  if (isPrivateIp(ip)) return null;
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string; countryCode?: string };
    if (data.status === "success" && data.countryCode) return data.countryCode.toUpperCase();
  } catch {
    // ignore — fall through to default
  }
  return null;
}

export async function detectCountryCode(req: Request): Promise<string> {
  const headerCountry =
    (req.headers["cf-ipcountry"] as string | undefined) ||
    (req.headers["x-vercel-ip-country"] as string | undefined) ||
    (req.headers["fly-client-country"] as string | undefined);

  if (headerCountry && headerCountry !== "XX" && headerCountry.length === 2) {
    return headerCountry.toUpperCase();
  }

  const ip = getClientIp(req);
  const lookedUp = await lookupCountryByIp(ip);
  if (lookedUp) return lookedUp;

  return "NG";
}

async function getNgnRates(): Promise<{ rates: Record<string, number>; fetchedAt: number | null }> {
  if (fxCache && Date.now() - fxCache.fetchedAt < FX_CACHE_TTL_MS) {
    return { rates: fxCache.rates, fetchedAt: fxCache.fetchedAt };
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/NGN", { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
      if (data.result === "success" && data.rates) {
        fxCache = { rates: data.rates, fetchedAt: Date.now() };
        return { rates: data.rates, fetchedAt: fxCache.fetchedAt };
      }
    }
  } catch (err) {
    console.warn("[pricing] FX rate fetch failed:", err);
  }

  if (fxCache) return { rates: fxCache.rates, fetchedAt: fxCache.fetchedAt };
  return { rates: FALLBACK_NGN_RATES, fetchedAt: null };
}

export async function buildPricingQuote(req: Request): Promise<PricingQuote> {
  const countryCode = await detectCountryCode(req);
  const currency = currencyForCountry(countryCode);
  const { rates, fetchedAt } = await getNgnRates();

  const chargeFormatted = formatMoney(PRO_PRICE_NGN, "NGN", "en-NG");
  const freeFormatted = formatMoney(0, currency);

  if (currency === "NGN") {
    return {
      countryCode,
      currency,
      proPrice: { amount: PRO_PRICE_NGN, formatted: chargeFormatted },
      freePrice: { amount: 0, formatted: freeFormatted },
      charge: { currency: "NGN", amountNgn: PRO_PRICE_NGN, formatted: chargeFormatted },
      approximate: false,
      fxUpdatedAt: fetchedAt ? new Date(fetchedAt).toISOString() : null,
    };
  }

  const converted = convertFromNgn(PRO_PRICE_NGN, currency, rates);
  if (converted == null) {
    return {
      countryCode,
      currency: "NGN",
      proPrice: { amount: PRO_PRICE_NGN, formatted: chargeFormatted },
      freePrice: { amount: 0, formatted: formatMoney(0, "NGN", "en-NG") },
      charge: { currency: "NGN", amountNgn: PRO_PRICE_NGN, formatted: chargeFormatted },
      approximate: false,
      fxUpdatedAt: fetchedAt ? new Date(fetchedAt).toISOString() : null,
    };
  }

  return {
    countryCode,
    currency,
    proPrice: { amount: converted, formatted: formatMoney(converted, currency) },
    freePrice: { amount: 0, formatted: freeFormatted },
    charge: { currency: "NGN", amountNgn: PRO_PRICE_NGN, formatted: chargeFormatted },
    approximate: true,
    fxUpdatedAt: fetchedAt ? new Date(fetchedAt).toISOString() : null,
  };
}
