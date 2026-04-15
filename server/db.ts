import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

// Load environment variables
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

// Create Postgres connection
const queryClient = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  prepare: false,
});

// Initialize Drizzle ORM
export const db = drizzle(queryClient, { schema });

// Initialize database schema (create tables if they don't exist)
export async function initializeDatabase() {
  try {
    // SQL to create tables in PostgreSQL
    await queryClient`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        tier TEXT NOT NULL DEFAULT 'free',
        theme TEXT NOT NULL DEFAULT 'dark',
        downloads_today INTEGER NOT NULL DEFAULT 0,
        last_download_date TEXT,
        reset_token TEXT,
        reset_token_expiry TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    await queryClient`
      CREATE TABLE IF NOT EXISTS templates (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'birthday',
        status TEXT NOT NULL DEFAULT 'draft',
        preview_image TEXT,
        canvas_json TEXT NOT NULL,
        thumbnail_color TEXT NOT NULL DEFAULT '#8B5CF6',
        is_pro BOOLEAN NOT NULL DEFAULT FALSE,
        usage_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    await queryClient`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        template_id INTEGER,
        title TEXT NOT NULL DEFAULT 'Untitled Card',
        design_json TEXT NOT NULL,
        export_settings TEXT NOT NULL DEFAULT '{}',
        thumbnail TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    await queryClient`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reference TEXT NOT NULL UNIQUE,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'NGN',
        status TEXT NOT NULL DEFAULT 'pending',
        plan TEXT NOT NULL DEFAULT 'pro_lifetime',
        paystack_data TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    console.log("✅ Database schema initialized successfully");
  } catch (err: any) {
    if (!err.message.includes("already exists")) {
      console.error("❌ Database initialization error:", err.message);
      throw err;
    }
  }
}

export { queryClient };
