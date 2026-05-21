import fs from "fs";
import path from "path";
import maxmind, { type Reader, type CountryResponse } from "maxmind";

let reader: Reader<CountryResponse> | null | undefined;

/**
 * Recommended: MaxMind GeoLite2 Country (free, local DB — IP never leaves your server).
 * 1. Create account at https://www.maxmind.com/en/geolite2/signup
 * 2. Download GeoLite2-Country.mmdb
 * 3. Set GEOIP_DB_PATH=/path/to/GeoLite2-Country.mmdb
 */
export async function initGeoIp(): Promise<void> {
  const dbPath = process.env.GEOIP_DB_PATH?.trim();
  if (!dbPath) {
    console.log("[geoip] GEOIP_DB_PATH not set — country lookup disabled");
    reader = null;
    return;
  }
  const resolved = path.resolve(dbPath);
  if (!fs.existsSync(resolved)) {
    console.warn(`[geoip] Database not found at ${resolved}`);
    reader = null;
    return;
  }
  try {
    reader = await maxmind.open<CountryResponse>(resolved);
    console.log("[geoip] GeoLite2 Country database loaded");
  } catch (e) {
    console.error("[geoip] Failed to load database:", e);
    reader = null;
  }
}

export function lookupCountry(ip: string | null | undefined): string | null {
  if (!ip || reader === null || reader === undefined) return null;
  try {
    const result = reader.get(ip);
    return result?.country?.iso_code ?? null;
  } catch {
    return null;
  }
}
