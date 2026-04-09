import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import helmet from "helmet";

const app = express();
const httpServer = createServer(app);

const isProd = process.env.NODE_ENV === "production";

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",    // Vite HMR in dev; tighten with nonces in prod
          "https://js.paystack.co",
          "https://cdnjs.cloudflare.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://api.fontshare.com", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://api.fontshare.com", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https://api.paystack.co", "https://cdnjs.cloudflare.com"],
        frameSrc: ["'self'", "https://checkout.paystack.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    // Allow cross-origin for iframe-embedded previews on Perplexity
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ─── Body limits ─────────────────────────────────────────────────────────────
// 15 MB to support base64 image data URLs (1080×1920 JPEG ≈ 3-5 MB → ~7 MB base64)
app.use(
  express.json({
    limit: "15mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf; // Used by Paystack webhook HMAC verification
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ─── Logging (sanitised — never log response bodies) ─────────────────────────
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      // Log method, path, status and duration — never log response body
      // (bodies can contain base64 thumbnails, tokens, PII)
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Never send raw error messages in production — they can leak stack traces
    const message = isProd && status === 500
      ? "Internal Server Error"
      : (err.message || "Internal Server Error");

    if (!isProd) console.error("Error:", err);

    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (isProd) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
