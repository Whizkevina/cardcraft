import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { PRO_PRICE_KOBO, PRO_PRICE_NGN } from "@shared/schema";
import { paystackRequest, PAYSTACK_PUBLIC } from "../paystackClient";
import { requireAuth, generateRef, logAudit, isProd } from "../routeContext";

export function registerPaymentRoutes(app: Express) {
  app.post("/api/payments/initialize", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.tier === "pro") return res.status(400).json({ error: "Already on Pro plan" });
    try {
      const reference = generateRef();
      const payment = await storage.createPayment({ userId: user.id, reference, amount: PRO_PRICE_KOBO, status: "pending", plan: "pro_lifetime" });
      await logAudit(req, "payment.initialize", "payment", payment.id, { reference, amount: PRO_PRICE_KOBO });
      const paystackRes = await paystackRequest("POST", "/transaction/initialize", {
        email: user.email, amount: PRO_PRICE_KOBO, reference, currency: "NGN",
        metadata: { userId: user.id, plan: "pro_lifetime" },
        callback_url: `${process.env.APP_URL || "http://localhost:5000"}/#/pricing`,
      });
      if (!paystackRes.status) {
        console.error("[Paystack] Initialization error payload:", paystackRes);
        return res.status(500).json({ error: "Payment initialization failed: " + (paystackRes.message || "Unknown error") });
      }
      res.json({ reference, authorizationUrl: paystackRes.data.authorization_url, accessCode: paystackRes.data.access_code, publicKey: PAYSTACK_PUBLIC, amount: PRO_PRICE_NGN, email: user.email });
    } catch (e: any) {
      console.error("[Paystack] System error:", e);
      res.status(500).json({ error: "Payment initialization failed" });
    }
  });

  app.post("/api/payments/confirm", requireAuth, async (req, res) => {
    const reference = String(req.body.reference || "").trim();
    if (!reference) return res.status(400).json({ error: "Reference required" });
    // Reference format validation to prevent injection
    if (!/^CC-[\d]+-[A-Z0-9]+$/.test(reference)) return res.status(400).json({ error: "Invalid reference format" });
    try {
      const paystackRes = await paystackRequest("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
      const payment = await storage.getPayment(reference);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      // Ownership check — can only confirm your own payment
      if (payment.userId !== req.session.userId) return res.status(403).json({ error: "Forbidden" });
      if (paystackRes.status && paystackRes.data.status === "success") {
        await storage.updatePaymentStatus(reference, "success");
        await storage.updateUserTier(payment.userId, "pro");
        req.session.userTier = "pro";
        await logAudit(req, "payment.success", "payment", payment.id, { reference, amount: payment.amount });
        return res.json({ success: true, tier: "pro" });
      }
      await logAudit(req, "payment.pending", "payment", payment.id, { reference, status: paystackRes.data?.status });
      res.json({ success: false, message: "Payment not complete yet" });
    } catch (e: any) { res.status(500).json({ error: "Verification failed" }); }
  });

  // Raw body required for HMAC verification — must be registered BEFORE express.json parses it
  app.post("/api/payments/webhook", async (req, res) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      if (isProd) return res.status(503).json({ error: "Webhook verification not configured" });
    } else {
      const rawBody = (req as any).rawBody;
      if (!rawBody) return res.status(400).send("No raw body");
      const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
      if (hash !== req.headers["x-paystack-signature"]) {
        return res.status(400).json({ error: "Invalid webhook signature" });
      }
    }
    const event = req.body;
    if (event?.event === "charge.success") {
      const ref = String(event.data?.reference || "");
      if (ref) {
        const payment = await storage.getPayment(ref);
        if (payment && payment.status !== "success") {
          await storage.updatePaymentStatus(ref, "success");
          await storage.updateUserTier(payment.userId, "pro");
          await logAudit(req, "payment.success", "payment", payment.id, { reference: ref, source: "webhook" }, { id: null, role: "system", name: "Paystack Webhook" });
        }
      }
      await storage.setSystemMeta("paystack_webhook_last", JSON.stringify({ status: "success", event: event.event, at: new Date().toISOString() }));
    } else {
      await storage.setSystemMeta("paystack_webhook_last", JSON.stringify({ status: "received", event: event?.event ?? "unknown", at: new Date().toISOString() }));
    }
    res.sendStatus(200);
  });

  app.get("/api/payments/my", requireAuth, async (req, res) => {
    res.json(await storage.getPaymentsByUser(req.session.userId!));
  });
}
