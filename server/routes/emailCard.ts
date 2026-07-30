import type { Express } from "express";
import validator from "validator";
import { emailSendLimiter } from "../rateLimiters";
import { createTransporter } from "../email";
import { requireAuth, escapeHtml, validateEmail, logAudit } from "../routeContext";

export function registerEmailCardRoutes(app: Express) {
  app.post("/api/email/send-card", emailSendLimiter, requireAuth, async (req, res) => {
    const { to, subject, message, imageDataUrl, cardTitle } = req.body;

    // Validate recipient
    if (!to || !validateEmail(to)) return res.status(400).json({ error: "Valid recipient email required" });
    if (!imageDataUrl || typeof imageDataUrl !== "string") return res.status(400).json({ error: "Image data required" });

    // Validate image data URL format
    if (!imageDataUrl.match(/^data:image\/(jpeg|jpg|png);base64,/)) {
      return res.status(400).json({ error: "Invalid image format" });
    }

    // Size limit — base64 of a 2× export ≈ 6-8 MB
    if (imageDataUrl.length > 12_000_000) return res.status(413).json({ error: "Image too large" });

    // Sanitise user-controlled fields before embedding in HTML
    const safeMessage = escapeHtml(String(message || "Someone designed this card for you using CardCraft.").slice(0, 500));
    const safeTitle = escapeHtml(String(cardTitle || "Your Card").slice(0, 200));
    const safeSubject = escapeHtml(String(subject || `${safeTitle} from CardCraft`).slice(0, 200));
    const safeTo = validator.normalizeEmail(to) || to.trim();

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.log(`[SIMULATED EMAIL] To: ${safeTo}, Subject: ${safeSubject}, ImageBase64Length: ${imageDataUrl.length}`);
      await logAudit(req, "email.send_card", "project", null, { to: safeTo, cardTitle: safeTitle, simulated: true });
      return res.status(200).json({
        success: true,
        message: `[Simulated] Sent to ${safeTo}. Add GMAIL_USER in .env to send real emails.`
      });
    }

    try {
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");
      const isJpeg = imageDataUrl.startsWith("data:image/jpeg") || imageDataUrl.startsWith("data:image/jpg");
      const filename = `${safeTitle.replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 60)}.${isJpeg ? "jpg" : "png"}`;

      await createTransporter().sendMail({
        from: `"CardCraft" <${process.env.GMAIL_USER}>`,
        to: safeTo,
        subject: safeSubject,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f7;padding:32px;border-radius:12px;"><h2 style="color:#1a1a1a;">You received a card!</h2><p style="color:#666;">${safeMessage}</p><img src="cid:cardimage" alt="${safeTitle}" style="width:100%;max-width:500px;border-radius:12px;display:block;margin:16px auto;" /><p style="color:#999;font-size:12px;text-align:center;">Created with <a href="https://cardcraft.app" style="color:#c9a84c;">CardCraft</a></p></div>`,
        attachments: [{ filename, content: imageBuffer, cid: "cardimage" }],
      });
      res.json({ success: true, message: `Card sent to ${safeTo}` });
      await logAudit(req, "email.send_card", "project", null, { to: safeTo, cardTitle: safeTitle });
    } catch (e: any) { res.status(500).json({ error: "Failed to send email" }); }
  });

  app.get("/api/email/status", (req, res) => {
    res.json({ configured: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) });
    // NOTE: never expose the actual email address — just configured: true/false
  });
}
