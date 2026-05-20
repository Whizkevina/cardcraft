import { describe, expect, it } from "vitest";
import { convertFromNgn, currencyForCountry, formatMoney } from "@shared/pricing";

describe("pricing", () => {
  it("maps countries to expected display currencies", () => {
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry("DE")).toBe("EUR");
    expect(currencyForCountry("CN")).toBe("CNY");
    expect(currencyForCountry("JP")).toBe("JPY");
    expect(currencyForCountry("NG")).toBe("NGN");
    expect(currencyForCountry("ZZ")).toBe("USD");
  });

  it("converts NGN amounts using rate table", () => {
    const rates = { USD: 0.00065, NGN: 1 };
    expect(convertFromNgn(10000, "USD", rates)).toBeCloseTo(6.5, 2);
    expect(convertFromNgn(10000, "NGN", rates)).toBe(10000);
  });

  it("formats zero-decimal currencies without fractions", () => {
    expect(formatMoney(1234.6, "JPY", "en-US")).toBe("¥1,235");
  });
});
