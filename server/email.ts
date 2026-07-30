// @ts-ignore - Missing types for connect-pg-simple environment shares this ts-ignore pattern
import nodemailer from "nodemailer";
import validator from "validator";
import { storage } from "./storage";
import { escapeHtml, generateToken } from "./routeContext";

// ─── Email transporter ────────────────────────────────────────────────────────
export const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER || "", pass: process.env.GMAIL_APP_PASSWORD || "" },
  });

// ─── Welcome email ────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(name: string, email: string) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;
  const appUrl = process.env.APP_URL || "https://cardcraft-tdog.onrender.com";
  const safeName = escapeHtml(name);
  try {
    await createTransporter().sendMail({
      from: `"CardCraft" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Welcome to CardCraft! 🎨",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#16151a;padding:36px;border-radius:14px;color:#e8e0cc;">
          <div style="text-align:center;margin-bottom:24px;">
            <svg viewBox="0 0 32 32" fill="none" width="48" height="48" style="display:inline-block;">
              <rect width="32" height="32" rx="8" fill="hsl(43,96%,58%)"/>
              <rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke="#16151a" stroke-width="2"/>
              <path d="M6 14h20" stroke="#16151a" stroke-width="1.5"/>
              <circle cx="10" cy="20" r="1.5" fill="#16151a"/>
              <path d="M13 20h9" stroke="#16151a" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <h1 style="color:#f0c040;font-size:22px;margin:12px 0 4px;">Welcome to CardCraft!</h1>
          </div>
          <p style="color:#c8bfa8;font-size:15px;line-height:1.6;">Hi <strong style="color:#f0e0a0;">${safeName}</strong>,</p>
          <p style="color:#c8bfa8;font-size:15px;line-height:1.6;">
            Your account is ready. You can now create, save, and share stunning cards — business cards, invites, event flyers, and more.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${appUrl}/#/templates"
               style="display:inline-block;background:#c9a84c;color:#16151a;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;">
              Start Designing →
            </a>
          </div>
          <p style="color:#7a7060;font-size:12px;text-align:center;margin-top:24px;">
            You're on the <strong>Free plan</strong> — upgrade to Pro anytime for unlimited downloads.<br/>
            <a href="${appUrl}/#/pricing" style="color:#c9a84c;">View Pro plans</a>
          </p>
        </div>
      `,
    });
  } catch (e) {
    // Fail silently — welcome email is non-critical
    console.error("[welcome-email] Failed to send:", e);
  }
}

// ─── Password reset ────────────────────────────────────────────────────────────
export async function sendPasswordResetForEmail(email: string): Promise<boolean> {
  const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
  const token = generateToken();
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const found = await storage.setResetToken(normalEmail, token, expiry);
  if (!found || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return !!found;
  const appUrl = process.env.APP_URL || "http://localhost:5000";
  const resetUrl = `${appUrl}/#/reset-password?token=${token}`;
  try {
    await createTransporter().sendMail({
      from: `"CardCraft" <${process.env.GMAIL_USER}>`,
      to: normalEmail,
      subject: "Reset your CardCraft password",
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f9f9f7;padding:32px;border-radius:12px;"><h2 style="color:#1a1a1a">Reset your password</h2><p style="color:#555">Click below to set a new password. This link expires in 1 hour.</p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#c9a84c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Reset Password</a><p style="color:#999;font-size:12px;">If you didn't request this, you can safely ignore this email.</p></div>`,
    });
    return true;
  } catch {
    return false;
  }
}
