CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_role" text DEFAULT 'user' NOT NULL,
	"actor_email" text,
	"actor_name" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer,
	"meta" text,
	"ip_address" text,
	"ip_hash" text,
	"session_id" text,
	"user_agent" text,
	"severity" text DEFAULT 'info' NOT NULL,
	"page_path" text,
	"referrer" text,
	"before_value" text,
	"after_value" text,
	"integrity_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_key" text,
	"user_id" integer,
	"event_type" text NOT NULL,
	"page_path" text,
	"action" text,
	"resource_type" text,
	"resource_id" integer,
	"meta" text,
	"browser" text,
	"os" text,
	"device_type" text,
	"referrer" text,
	"ip_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_key" text NOT NULL,
	"user_id" integer NOT NULL,
	"user_name" text,
	"user_email" text,
	"user_role" text,
	"user_tier" text,
	"page_path" text,
	"referrer" text,
	"utm_source" text,
	"utm_campaign" text,
	"browser" text,
	"os" text,
	"device_type" text,
	"country" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"reference" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"plan" text DEFAULT 'pro_lifetime' NOT NULL,
	"paystack_data" text,
	"refund_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"template_id" integer,
	"title" text DEFAULT 'Untitled Card' NOT NULL,
	"design_json" text NOT NULL,
	"export_settings" text DEFAULT '{}' NOT NULL,
	"thumbnail" text,
	"share_image" text,
	"share_token" text,
	"share_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'birthday' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"preview_image" text,
	"canvas_json" text NOT NULL,
	"thumbnail_color" text DEFAULT '#8B5CF6' NOT NULL,
	"is_pro" integer DEFAULT 0 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"downloads_today" integer DEFAULT 0 NOT NULL,
	"last_download_date" text,
	"reset_token" text,
	"reset_token_expiry" text,
	"auth_provider" text DEFAULT 'email' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp,
	"total_downloads" integer DEFAULT 0 NOT NULL,
	"pro_expires_at" timestamp,
	"admin_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
