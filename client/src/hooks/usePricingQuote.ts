import { useQuery } from "@tanstack/react-query";
import type { PricingQuote } from "@shared/pricing";
import { PRO_PRICE_NGN, formatMoney } from "@shared/pricing";

const FALLBACK_QUOTE: PricingQuote = {
  countryCode: "NG",
  currency: "NGN",
  proPrice: { amount: PRO_PRICE_NGN, formatted: formatMoney(PRO_PRICE_NGN, "NGN", "en-NG") },
  freePrice: { amount: 0, formatted: formatMoney(0, "NGN", "en-NG") },
  charge: {
    currency: "NGN",
    amountNgn: PRO_PRICE_NGN,
    formatted: formatMoney(PRO_PRICE_NGN, "NGN", "en-NG"),
  },
  approximate: false,
  fxUpdatedAt: null,
};

export function usePricingQuote() {
  const query = useQuery<PricingQuote>({
    queryKey: ["/api/pricing/quote"],
    staleTime: 60 * 60 * 1000,
  });

  return {
    ...query,
    quote: query.data ?? FALLBACK_QUOTE,
  };
}
