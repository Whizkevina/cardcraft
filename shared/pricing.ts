import { PRO_PRICE_NGN } from "./schema";

export type PricingQuote = {
  countryCode: string;
  currency: string;
  proPrice: { amount: number; formatted: string };
  freePrice: { amount: number; formatted: string };
  charge: { currency: "NGN"; amountNgn: number; formatted: string };
  approximate: boolean;
  fxUpdatedAt: string | null;
};

/** Eurozone + EU members commonly shown EUR pricing */
export const EU_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

const COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN",
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  AU: "AUD",
  NZ: "NZD",
  CN: "CNY",
  JP: "JPY",
  IN: "INR",
  GH: "GHS",
  KE: "KES",
  ZA: "ZAR",
  AE: "AED",
  SA: "SAR",
  SG: "SGD",
  MY: "MYR",
  PH: "PHP",
  BR: "BRL",
  MX: "MXN",
  CH: "CHF",
  NO: "NOK",
  SE: "SEK",
  DK: "DKK",
  PL: "PLN",
  TR: "TRY",
  EG: "EGP",
  PK: "PKR",
  BD: "BDT",
  ID: "IDR",
  KR: "KRW",
  HK: "HKD",
  TW: "TWD",
  IL: "ILS",
};

export function currencyForCountry(countryCode: string): string {
  const cc = countryCode.toUpperCase();
  if (cc === "NG") return "NGN";
  if (EU_COUNTRY_CODES.has(cc)) return "EUR";
  return COUNTRY_CURRENCY[cc] ?? "USD";
}

export function formatMoney(amount: number, currency: string, locale?: string): string {
  const zeroDecimal = new Set(["JPY", "KRW", "VND", "CLP"]);
  const fractionDigits = zeroDecimal.has(currency) ? 0 : 2;
  const rounded =
    fractionDigits === 0 ? Math.round(amount) : Math.round(amount * 100) / 100;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(rounded);
}

export function convertFromNgn(amountNgn: number, targetCurrency: string, ngnRates: Record<string, number>): number | null {
  if (targetCurrency === "NGN") return amountNgn;
  const rate = ngnRates[targetCurrency];
  if (!rate || !Number.isFinite(rate)) return null;
  return amountNgn * rate;
}

export { PRO_PRICE_NGN };
