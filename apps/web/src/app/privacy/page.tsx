import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { Shield, Lock, FileText, CheckCircle2, Mail, MapPin, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | ICX Studios Africa',
  description:
    'Comprehensive Privacy Policy for ICX Studios (LearnArk Technology Limited). Learn how we protect your uploaded creative assets, personal data, and payment transactions under the Nigeria Data Protection Act (NDPA).',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'November 4, 2026';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="border-b border-zinc-200 pb-8 sm:pb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1 text-xs font-bold text-zinc-800 shadow-xs">
              <Shield className="h-3.5 w-3.5 text-emerald-600" />
              <span>NDPA &amp; Global Privacy Compliant</span>
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-zinc-950">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm sm:text-base text-zinc-600 leading-relaxed">
              Operated by <strong>LearnArk Technology Limited</strong> (&ldquo;ICX Studios&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). This document governs how we collect, store, safeguard, and process your creative visual assets, personal credentials, and transaction records.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-500">
              <span>Effective Date: January 1, 2026</span>
              <span>•</span>
              <span>Last Revised: {lastUpdated}</span>
              <span>•</span>
              <span>Jurisdiction: Federal Republic of Nigeria</span>
            </div>
          </div>

          {/* Quick Summary Highlights */}
          <div className="my-8 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
            <h2 className="text-base font-black text-zinc-950 flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-600" />
              <span>Core Privacy Commitments</span>
            </h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs leading-relaxed text-zinc-600">
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <span className="font-bold text-zinc-950 block mb-1">100% Asset Ownership</span>
                You retain complete copyright and proprietary rights over all raw images, video clips, and creative files uploaded to ICX Studios.
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <span className="font-bold text-zinc-950 block mb-1">Zero Financial Credential Storage</span>
                All payments are processed via PCI-DSS Level 1 compliant gateways (Paystack/Flutterwave). We never store your card numbers or CVV.
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <span className="font-bold text-zinc-950 block mb-1">Strict NDPA Compliance</span>
                Full adherence to the Nigeria Data Protection Act (NDPA 2023) and global best practices for identity and biometric data protection.
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <span className="font-bold text-zinc-950 block mb-1">1-Click Account Deletion</span>
                You have the absolute right to download your data or permanently delete your account and all associated media from our platform.
              </div>
            </div>
          </div>

          {/* Detailed Policy Content */}
          <div className="prose prose-zinc max-w-none space-y-10 text-xs sm:text-sm text-zinc-700 leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                1. Identification of the Data Controller
              </h2>
              <p>
                The data controller responsible for the processing of your personal data is <strong>LearnArk Technology Limited</strong> (trading as ICX Studios), an incorporated entity under the laws of the Federal Republic of Nigeria, with operations headquartered in Victoria Island &amp; Lekki Phase 1, Lagos, and Maitama, Abuja.
              </p>
              <p>
                For any inquiries regarding data protection, privacy rights, or data processing, you may reach our Data Protection Officer (DPO) at <a href="mailto:privacy@icxora.com" className="font-bold text-zinc-950 underline">privacy@icxora.com</a>.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                2. Information We Collect
              </h2>
              <p>
                Depending on how you interact with our platform (as a Client, Photographer, Retoucher, or Equipment Renter), we collect the following categories of information:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Account &amp; Profile Credentials:</strong> Full name, verified email address, telephone number, account password (stored exclusively as salted Argon2id hashes; plaintext is never stored or accessible), and role designation.
                </li>
                <li>
                  <strong>Creative Visual Assets:</strong> High-resolution RAW and raster photography files, video recordings, color reference files, and retouching instructions uploaded to our secure TUS storage infrastructure.
                </li>
                <li>
                  <strong>Photographer Verification &amp; Portfolio Data:</strong> Portfolio images, professional biographies, operating studio locations, service pricing tiers, and government-issued identification for vetted photographer certification.
                </li>
                <li>
                  <strong>Cinema Equipment Rental Records:</strong> Valid physical identity documents, verified residential or business addresses, and equipment condition inspection manifests required for cinema vault dispatches.
                </li>
                <li>
                  <strong>Transactional Metadata:</strong> Order timestamps, job package IDs, photographer booking time slots, payment reference tokens, and escrow release audit logs.
                </li>
                <li>
                  <strong>Technical &amp; Telemetry Data:</strong> IP address, device operating system version, browser user-agent, and append-only administrative security logs to prevent fraudulent access and unauthorized downloads.
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                3. Purpose and Legal Basis for Processing
              </h2>
              <p>
                In accordance with the Nigeria Data Protection Act 2023 (NDPA), we process personal data under the following legitimate grounds:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Performance of a Contract:</strong> To ingest RAW files, assign retouching orders to certified retouchers, reserve photographer shoot windows, verify booking slots, dispatch cinema equipment, and process escrow clearances.
                </li>
                <li>
                  <strong>Security &amp; Fraud Prevention:</strong> To protect client assets with cryptographic server-side watermarking, detect unauthorized screenshot captures on mobile devices, prevent account takeovers, and maintain immutable audit trails.
                </li>
                <li>
                  <strong>Direct Communications:</strong> To transmit automated transactional updates (order completion notices, email confirmation tokens, booking reminders, and rental check-in alerts). We do not sell or rent user contact details to third-party advertisers.
                </li>
                <li>
                  <strong>Legal Compliance:</strong> To comply with financial transaction retention laws, taxation filings, and applicable commercial regulations in the Federal Republic of Nigeria.
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                4. Creative Media Confidentiality &amp; Intellectual Property
              </h2>
              <p>
                We treat every creative asset uploaded to ICX Studios with bank-grade confidentiality:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Ownership:</strong> You maintain 100% intellectual property ownership of your source imagery and final retouched deliverables.
                </li>
                <li>
                  <strong>Internal Access Controls:</strong> Only retouchers explicitly assigned to your order have access to edit your source files. All staff retouchers and partner editors are bound by binding Non-Disclosure Agreements (NDAs).
                </li>
                <li>
                  <strong>Watermarked Client Previews:</strong> Preview images rendered prior to final balance settlement are dynamically burned with tamper-evident digital watermarks to protect photographer and retoucher intellectual property.
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                5. Third-Party Service Providers
              </h2>
              <p>
                We collaborate strictly with certified infrastructure partners who meet or exceed global security and privacy standards:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Payment Gateways:</strong> Paystack and Flutterwave process all card, USSD, and bank transfer transactions under PCI-DSS Level 1 certification.
                </li>
                <li>
                  <strong>Email Infrastructure:</strong> Self-hosted DKIM/SPF/DMARC authenticated mail nodes and Resend for transactional delivery.
                </li>
                <li>
                  <strong>Hosting &amp; Storage:</strong> Tier-3 data centers equipped with AES-256 encrypted volumes, automated snapshot backups, and high-availability PostgreSQL clusters.
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                6. Data Retention and Deletion
              </h2>
              <p>
                We retain personal data only for as long as required to fulfill the purposes set out in this Policy:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Master Creative Files:</strong> Retained in active storage during your active project and for a standard recovery grace window (typically 30–90 days following project delivery and approval), after which files are archived or purged according to storage policies.
                </li>
                <li>
                  <strong>Financial &amp; Audit Logs:</strong> Cryptographic transaction references and immutable audit ledger entries are retained in accordance with Nigerian statutory accounting obligations.
                </li>
                <li>
                  <strong>Account Deletion:</strong> You may request permanent deletion of your account and associated media at any time through your account security dashboard or by contacting <a href="mailto:privacy@icxora.com" className="font-bold text-zinc-950 underline">privacy@icxora.com</a>. Upon verification, all non-statutory records are irrevocably deleted within thirty (30) days.
                </li>
              </ul>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                7. Your Legal Rights Under NDPA
              </h2>
              <p>
                As a data subject, you are entitled to comprehensive rights under the Nigeria Data Protection Act 2023:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Right of Access:</strong> Request a copy of the personal information we hold concerning you.</li>
                <li><strong>Right to Rectification:</strong> Request correction of inaccurate, outdated, or incomplete data.</li>
                <li><strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> Request the permanent deletion of your personal data where there is no overriding legal ground for its retention.</li>
                <li><strong>Right to Data Portability:</strong> Obtain your personal data in a structured, commonly used, and machine-readable format.</li>
                <li><strong>Right to Object:</strong> Object to processing carried out on the basis of legitimate interests.</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                8. Mobile Application Security &amp; Permissions
              </h2>
              <p>
                The ICX Studios mobile applications (iOS and Android) request only minimal permissions essential for studio operations:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Photo Library &amp; Camera:</strong> Used exclusively to allow you to upload images for retouching or portfolio showcases.</li>
                <li><strong>Push Notifications:</strong> Used solely to alert you to order progress, photographer booking confirmations, and security notices. You may toggle notifications off in device settings.</li>
                <li><strong>No Background Location Tracking:</strong> We do not track your real-time physical GPS coordinates in the background.</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                9. Contacting Our Data Protection Officer
              </h2>
              <p>
                For questions, complaints, or exercise of any of your privacy rights, please contact our Data Protection Team:
              </p>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-2 font-medium text-xs text-zinc-800">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
                  <span>Email: <strong>privacy@icxora.com</strong> / <strong>dpo@icxora.com</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-zinc-500 shrink-0" />
                  <span>Physical Address: LearnArk Technology Limited, Victoria Island &amp; Lekki Phase 1, Lagos, Nigeria</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-zinc-500 shrink-0" />
                  <span>Corporate Registry: Incorporated under the Companies and Allied Matters Act, Nigeria</span>
                </div>
              </div>
            </section>
          </div>

          {/* Navigation CTA */}
          <div className="mt-12 pt-8 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/terms"
              className="inline-flex items-center gap-2 text-xs font-black text-zinc-900 hover:text-zinc-600 transition-colors"
            >
              <span>Read Terms of Service</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/support"
              className="inline-flex items-center gap-2 text-xs font-black text-zinc-900 hover:text-zinc-600 transition-colors"
            >
              <span>Contact Support &amp; Concierge</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
