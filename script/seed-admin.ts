/**
 * Create or reset an admin user directly in PostgreSQL.
 * Works in any environment (including production) — use strong credentials there.
 *
 * Usage:
 *   npm run db:seed-admin
 *   npm run db:seed-admin -- --email you@example.com --password 'YourSecurePass1!'
 *
 * Env (optional): ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */
import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";
import { initDb, storage } from "../server/storage";

dotenv.config({ path: path.resolve(".env.local") });
dotenv.config({ path: path.resolve(".env.test") });
dotenv.config({ path: path.resolve(".env") });

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = argValue("--email") ?? process.env.ADMIN_EMAIL ?? "admin@cardcraft.com";
  const password = argValue("--password") ?? process.env.ADMIN_PASSWORD ?? "admin123";
  const name = argValue("--name") ?? process.env.ADMIN_NAME ?? "Admin";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required (.env.local)");
  }
  if (!email.includes("@")) {
    throw new Error(`Invalid email: ${email}`);
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  await initDb();

  const hashed = await bcrypt.hash(password, 12);
  const existing = await storage.getUserByEmail(email);

  if (!existing) {
    await storage.createUser({
      name,
      email,
      password: hashed,
      role: "admin",
      tier: "pro",
    });
    console.log(`[seed-admin] Created admin: ${email}`);
  } else {
    await storage.updateUserPassword(existing.id, hashed);
    if (existing.role !== "admin") {
      await storage.updateUserRole(existing.id, "admin");
    }
    if (existing.tier !== "pro") {
      await storage.updateUserTier(existing.id, "pro");
    }
    console.log(`[seed-admin] Reset admin: ${email} (id ${existing.id})`);
  }

  console.log("[seed-admin] Done — sign in and change the password from Account Settings.");
}

main().catch((err) => {
  console.error("[seed-admin] Failed:", err.message);
  process.exit(1);
});
