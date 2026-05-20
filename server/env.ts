const isProd = process.env.NODE_ENV === "production";

export function validateProductionEnv() {
  if (!isProd) return;

  const required = [
    "DATABASE_URL",
    "SESSION_SECRET",
    "PAYSTACK_SECRET_KEY",
    "PAYSTACK_PUBLIC_KEY",
    "APP_URL",
  ] as const;

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (process.env.SESSION_SECRET === "cardcraft-fallback-secret-change-in-prod") {
    throw new Error("SESSION_SECRET must be changed from the default fallback in production");
  }
}

export function getPaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    if (isProd) throw new Error("PAYSTACK_SECRET_KEY is required in production");
    return "sk_test_placeholder";
  }
  return secret;
}

export function getPaystackPublic() {
  const key = process.env.PAYSTACK_PUBLIC_KEY;
  if (!key) {
    if (isProd) throw new Error("PAYSTACK_PUBLIC_KEY is required in production");
    return "pk_test_placeholder";
  }
  return key;
}

export function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (isProd) throw new Error("SESSION_SECRET is required in production");
    return "cardcraft-fallback-secret-change-in-prod";
  }
  return secret;
}

export function warnDevPlaceholders() {
  if (isProd) return;

  const warnings: string[] = [];
  if (!process.env.PAYSTACK_SECRET_KEY?.trim()) warnings.push("PAYSTACK_SECRET_KEY");
  if (!process.env.PAYSTACK_PUBLIC_KEY?.trim()) warnings.push("PAYSTACK_PUBLIC_KEY");
  if (!process.env.SESSION_SECRET?.trim()) warnings.push("SESSION_SECRET");
  if (!process.env.VITE_GOOGLE_CLIENT_ID?.trim()) warnings.push("VITE_GOOGLE_CLIENT_ID (Google Sign-In hidden)");

  if (warnings.length) {
    console.warn(
      `[CardCraft dev] Using placeholder/default values for: ${warnings.join(", ")}. Set these in .env.local for full functionality.`
    );
  }
}
