import type { Express } from "express";
import type { Server } from "http";
import { initDb, getPgPool } from "./storage";
import session from "express-session";
import PgSimpleStore from "connect-pg-simple";
import { getSessionSecret } from "./env";
import { registerSharePublicRoutes } from "./sharePublic";
import { registerSeoRoutes } from "./seoRoutes";
import { runRetentionCleanup } from "./analyticsService";
import { initGeoIp } from "./geoip";
import { apiLimiter } from "./rateLimiters";
import { isProd } from "./routeContext";
import { registerAuthRoutes } from "./routes/auth";
import { registerTelemetryRoutes } from "./routes/telemetry";
import { registerDownloadRoutes } from "./routes/downloads";
import { registerTemplateRoutes } from "./routes/templates";
import { registerProjectRoutes } from "./routes/projects";
import { registerPaymentRoutes } from "./routes/payments";
import { registerEmailCardRoutes } from "./routes/emailCard";
import { registerAdminRoutes } from "./routes/admin";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Initialize database
  await initDb();
  await initGeoIp();
  runRetentionCleanup().catch(e => console.error("[retention]", e));

  // Public share pages for crawlers (OG tags) — before SPA catch-all
  registerSeoRoutes(app);
  registerSharePublicRoutes(app);

  // Session — secure cookie in production
  // PostgreSQL-backed session store via Supabase (using pg Pool for compatibility)
  const PostgresStore = PgSimpleStore(session);
  app.use(
    session({
      store: new PostgresStore({
        pool: getPgPool(),
        tableName: "session",
      }),
      secret: getSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProd,           // HTTPS-only in production
        httpOnly: true,           // Not accessible from JS
        sameSite: "lax",          // CSRF mitigation
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  // General API rate limit
  app.use("/api", apiLimiter);

  const passwordChangeAllowlist = new Set([
    "/api/auth/me",
    "/api/auth/logout",
    "/api/auth/change-password",
  ]);

  app.use((req, res, next) => {
    if (req.session?.mustChangePassword && req.path.startsWith("/api") && !passwordChangeAllowlist.has(req.path)) {
      return res.status(403).json({ error: "Password change required" });
    }
    next();
  });

  registerAuthRoutes(app);
  registerTelemetryRoutes(app);
  registerDownloadRoutes(app);
  registerTemplateRoutes(app);
  registerProjectRoutes(app);
  registerPaymentRoutes(app);
  registerEmailCardRoutes(app);
  registerAdminRoutes(app);

  return httpServer;
}
