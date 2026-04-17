import Navbar from "../components/Navbar";
import { useLocation } from "wouter";
import { Shield, FileText } from "lucide-react";

const LAST_UPDATED = "April 9, 2026";
const COMPANY = "CardCraft";
const EMAIL = "support@cardcraft.app";

function TermsContent() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
      <p>By using CardCraft you agree to these Terms of Service. Please read them carefully.</p>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">1. Service Description</h2>
        <p>CardCraft is an online card design platform that allows users to create, customize, and download greeting cards. The service is provided "as is" without warranty of any kind.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">2. User Accounts</h2>
        <p>You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your password. Notify us immediately of any unauthorized use of your account.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">3. Free and Pro Plans</h2>
        <p>Free accounts may download up to 3 cards per day with a CardCraft watermark. Pro accounts (₦10,000 one-time payment) receive unlimited downloads with no watermark. Payment is non-refundable after the account has been upgraded.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">4. Acceptable Use</h2>
        <p>You may not use CardCraft to create cards that contain:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Content that infringes third-party intellectual property rights</li>
          <li>Hate speech, harassment, or defamatory content</li>
          <li>Fraudulent, deceptive, or illegal material</li>
          <li>Content that violates any applicable law</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">5. Content Ownership</h2>
        <p>You retain ownership of all content you upload (photos, logos). By uploading content, you grant CardCraft a limited license to process and display it solely to render your cards. CardCraft does not claim ownership of your uploaded content.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">6. Intellectual Property</h2>
        <p>CardCraft templates, designs, code, and branding are the intellectual property of CardCraft. You may not copy, modify, or redistribute them without written permission.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">7. Payments</h2>
        <p>Payments are processed by Paystack, a secure third-party payment processor. CardCraft does not store your card details. All transactions are in Nigerian Naira (NGN). The Pro plan is a one-time lifetime purchase — there are no recurring charges.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">8. Limitation of Liability</h2>
        <p>CardCraft shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount you paid for your Pro plan.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">9. Termination</h2>
        <p>We reserve the right to suspend or terminate accounts that violate these terms without prior notice. Upon termination, your right to access the service ceases immediately.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">10. Changes to Terms</h2>
        <p>We may update these terms periodically. Continued use of CardCraft after changes constitutes acceptance of the updated terms.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">11. Contact</h2>
        <p>For questions about these terms, contact us at <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>.</p>
      </section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
      <p>This Privacy Policy explains how CardCraft collects, uses, and protects your personal information.</p>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">1. Information We Collect</h2>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Account information:</strong> name and email address when you register</li>
          <li><strong>Payment information:</strong> transaction reference and amount (we do not store card details — payments are handled by Paystack)</li>
          <li><strong>Content you upload:</strong> photos and logos used in your cards</li>
          <li><strong>Usage data:</strong> which templates you use, how many cards you create, download history</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>To provide and improve the CardCraft service</li>
          <li>To process payments and manage your subscription</li>
          <li>To send transactional emails (password resets, card deliveries)</li>
          <li>To enforce our Terms of Service and prevent abuse</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">3. Data Storage</h2>
        <p>Your data is stored securely on our servers. Uploaded images are processed in memory to generate your cards and are not permanently stored on our servers beyond what is needed to save your projects.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">4. Data Sharing</h2>
        <p>We do not sell, trade, or rent your personal data to third parties. We share data only with:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Paystack</strong> — to process payments (their privacy policy applies)</li>
          <li><strong>Gmail/Google</strong> — to send email notifications (their privacy policy applies)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">5. Cookies</h2>
        <p>We use session cookies to keep you signed in. We do not use tracking or advertising cookies.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">6. Your Rights under GDPR and NDPR</h2>
        <p>If you are a resident of the European Economic Area (EEA) or Nigeria, you have specific data protection rights under the GDPR and NDPR respectively:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>The right to access:</strong> You can request copies of your personal data.</li>
          <li><strong>The right to rectification:</strong> You can request that we correct inaccurate information.</li>
          <li><strong>The right to erasure (Right to be forgotten):</strong> You can request that we erase your personal data, under certain conditions.</li>
          <li><strong>The right to restrict processing:</strong> You can request that we restrict the processing of your personal data.</li>
          <li><strong>The right to data portability:</strong> You can request that we transfer the data that we have collected to another organization, or directly to you.</li>
        </ul>
        <p className="mt-2">To request deletion of your account and associated data, or exercise any of these rights, contact us at <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">7. International Data Transfers</h2>
        <p>CardCraft is hosted on international servers. By using our service, you consent to the transfer, storage, and processing of your information outside your country of residence, including to the United States and European Union, in accordance with GDPR and NDPR standards.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">8. Security</h2>
        <p>We implement industry-standard security measures including password hashing (bcrypt), secure session management, and HTTPS. However, no system is 100% secure — use a strong, unique password.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">9. Children's Privacy (COPPA)</h2>
        <p>CardCraft is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal data, please contact us.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">10. Changes</h2>
        <p>We may update this policy as our service evolves. We'll notify registered users of significant changes by email.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">11. Contact & Data Controller</h2>
        <p>For privacy questions or to reach our Data Protection Officer (DPO), please contact: <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a></p>
      </section>
    </div>
  );
}

export default function LegalPage() {
  const [location] = useLocation();
  const isPrivacy = location === "/privacy";

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          {isPrivacy
            ? <Shield size={22} className="text-gold flex-shrink-0" />
            : <FileText size={22} className="text-gold flex-shrink-0" />}
          <div>
            <h1 className="text-2xl font-bold font-display">
              {isPrivacy ? "Privacy Policy" : "Terms of Service"}
            </h1>
            <p className="text-xs text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-2 mb-8 border-b border-border pb-4">
          <a href="#/terms" className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${!isPrivacy ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Terms of Service
          </a>
          <a href="#/privacy" className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${isPrivacy ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Privacy Policy
          </a>
        </div>

        {isPrivacy ? <PrivacyContent /> : <TermsContent />}

        <div className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground">
          <p>{COMPANY} · {EMAIL}</p>
        </div>
      </main>
    </div>
  );
}
