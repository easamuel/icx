import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import { FileText, Shield, CheckCircle2, AlertCircle, ArrowRight, Mail, Scale } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service | ICX Studios Africa',
  description:
    'Terms of Service and User Agreement for ICX Studios (LearnArk Technology Limited). Covering professional photo editing, photographer booking escrow, cinema equipment rentals, and creative asset licensing.',
};

export default function TermsOfServicePage() {
  const lastUpdated = 'November 4, 2026';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="border-b border-zinc-200 pb-8 sm:pb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1 text-xs font-bold text-zinc-800 shadow-xs">
              <Scale className="h-3.5 w-3.5 text-zinc-900" />
              <span>Standard Enterprise Terms of Service</span>
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-zinc-950">
              Terms of Service
            </h1>
            <p className="mt-3 text-sm sm:text-base text-zinc-600 leading-relaxed">
              These Terms of Service constitute a legally binding agreement between you (&ldquo;User&rdquo;, &ldquo;Client&rdquo;, or &ldquo;Partner&rdquo;) and <strong>LearnArk Technology Limited</strong> (&ldquo;ICX Studios&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By accessing our web platform, mobile applications, or studio services, you agree to these Terms.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-500">
              <span>Effective Date: January 1, 2026</span>
              <span>•</span>
              <span>Last Revised: {lastUpdated}</span>
              <span>•</span>
              <span>Governing Law: Federal Republic of Nigeria</span>
            </div>
          </div>

          {/* Quick Summary Highlights */}
          <div className="my-8 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
            <h2 className="text-base font-black text-zinc-950 flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-900" />
              <span>Key Operating Principles</span>
            </h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs leading-relaxed text-zinc-600">
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <span className="font-bold text-zinc-950 block mb-1">Escrow Safety Protocol</span>
                Client funds for retouching and shoot bookings are held in secure escrow and released only upon verified milestone completion or client approval.
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <span className="font-bold text-zinc-950 block mb-1">Full Copyright Retention</span>
                Clients retain full copyright ownership of all submitted original photos, raw footage, and approved retouched master outputs.
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <span className="font-bold text-zinc-950 block mb-1">Cinema Gear Inspection</span>
                All rental cameras and lighting packages are formally verified before dispatch and upon return to protect both renter and vault fleet.
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <span className="font-bold text-zinc-950 block mb-1">Fair Cancellation Windows</span>
                Transparent, balanced cancellation rules protecting client flexibility while fairly compensating photographers holding their production calendars.
              </div>
            </div>
          </div>

          {/* Detailed Terms Content */}
          <div className="prose prose-zinc max-w-none space-y-10 text-xs sm:text-sm text-zinc-700 leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                1. Acceptance of Terms &amp; Eligibility
              </h2>
              <p>
                By creating an account, placing an order, booking a photographer, or renting equipment through <Link href="/" className="font-bold text-zinc-950 underline">icxora.com</Link> or the ICX Studios mobile applications, you affirm that:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>You are at least 18 years of age and possess full legal capacity to enter into binding commercial contracts.</li>
                <li>All registration information you provide (name, email, phone number, physical address) is accurate, current, and verifiable.</li>
                <li>You will maintain the security of your account credentials and immediately notify us of any unauthorized account activity.</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                2. Platform Scope and Operational Roles
              </h2>
              <p>
                ICX Studios operates a multi-disciplinary visual production ecosystem encompassing three core operational pillars:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>High-Resolution Photo Retouching &amp; Color Grading:</strong> Clients upload RAW or high-resolution imagery via our resilient TUS pipeline. Work is routed to certified in-house senior editors or verified studio partners. Deliverables are previewed via digital watermarked viewports and finalized upon balance clearance.
                </li>
                <li>
                  <strong>Vetted Photographer Marketplace &amp; Shoot Bookings:</strong> We connect clients with certified, peer-reviewed commercial, portrait, wedding, and event photographers in Lagos, Abuja, and surrounding regions. We facilitate calendar hold reservations, escrow payments, and delivery tracking.
                </li>
                <li>
                  <strong>Cinema Fleet &amp; Studio Equipment Rentals:</strong> We manage verified equipment vaults containing cinema cameras (ARRI, RED, Sony Cinema), prime and zoom cine lenses, gimbals, drones, and lighting setups available for daily production rentals.
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                3. Financial Terms, Escrow &amp; Pricing
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Currency:</strong> All fees are stated and charged in Nigerian Naira (₦ NGN).</li>
                <li>
                  <strong>Retouching Deposit &amp; Balance:</strong> Orders require an upfront deposit (standard 70%) to commence editing. The remaining balance (30%) is paid after the client reviews and approves the watermarked previews, triggering instantaneous delivery of the clean, uncompressed master deliverables.
                </li>
                <li>
                  <strong>Photographer Escrow:</strong> For photographer bookings, the full session fee is deposited into ICX Studios Escrow. The photographer is guaranteed payment upon verified completion of the session and raw asset handover.
                </li>
                <li>
                  <strong>Payment Processors:</strong> We partner with licensed, CBN-regulated payment gateways (Paystack and Flutterwave) supporting debit/credit cards, NIBSS Instant Payments, USSD, and Apple Pay.
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                4. Intellectual Property &amp; Licensing
              </h2>
              <p>
                We adhere to strict international standards regarding creative property:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Client Content:</strong> You retain complete, unencumbered ownership of all imagery, videos, and materials submitted. By uploading, you grant ICX Studios and assigned retouchers a limited, non-exclusive, revocable license strictly necessary to execute the requested post-production services.
                </li>
                <li>
                  <strong>Deliverable Copyright:</strong> Upon full payment settlement, all intellectual property in the final edited deliverables vests entirely in the client, unless otherwise agreed in writing for custom commercial buyout agreements.
                </li>
                <li>
                  <strong>Watermarked Previews:</strong> Preview images containing the ICX Studios digital watermark are for review purposes only. Removing, cropping, altering, or commercially deploying watermarked previews prior to balance payment constitutes copyright infringement and a material breach of these Terms.
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                5. Photographer Booking &amp; Cancellation Policy
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Cancellations &gt; 48 Hours Before Shoot:</strong> Full refund of the session fee, less standard payment gateway processing fees.
                </li>
                <li>
                  <strong>Cancellations Between 24–48 Hours:</strong> 50% refund to client; 50% released to the photographer to compensate for the blocked calendar slot.
                </li>
                <li>
                  <strong>Cancellations &lt; 24 Hours or No-Shows:</strong> Forfeiture of deposit to compensate photographer dispatch and preparations.
                </li>
                <li>
                  <strong>Photographer Default:</strong> In the rare event a photographer cannot fulfill a shoot due to verifiable emergencies, ICX Studios guarantees an immediate replacement of equal or higher tier, or a 100% full refund at the client&rsquo;s discretion.
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                6. Cinema Equipment Rental Obligations
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Physical Inspection:</strong> All rented equipment must be inspected and co-signed at the ICX Vault pickup center (Lagos or Abuja) prior to dispatch.
                </li>
                <li>
                  <strong>Security Deposit &amp; Verification:</strong> Renters must provide valid government-issued ID (NIN, International Passport) and verifiable residential or business references. Security deposits are released within 24 hours of undamaged return.
                </li>
                <li>
                  <strong>Damage, Loss &amp; Theft:</strong> The renter bears full financial responsibility for equipment damage, loss, or theft during the rental window. Renters must maintain adequate production insurance for heavy cinema packages.
                </li>
                <li>
                  <strong>Strict Prohibition on Sub-Leasing:</strong> Rented equipment may not be loaned, transferred, or sub-leased to third parties without prior written consent from ICX Studios Vault Management.
                </li>
              </ul>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                7. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by Nigerian law, LearnArk Technology Limited shall not be liable for indirect, incidental, punitive, or consequential damages arising out of your use of the platform, including lost production days, weather delays, or lost commercial opportunities. Our aggregate liability for direct claims shall not exceed the total fees paid by you to ICX Studios in the three (3) months preceding the event giving rise to liability.
              </p>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                8. Dispute Resolution &amp; Governing Law
              </h2>
              <p>
                These Terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria. In the event of any dispute, the parties shall first attempt to resolve the matter amicably through the ICX Support Dispute Resolution process. If unresolved within twenty-one (21) days, disputes shall be submitted to the exclusive jurisdiction of the competent courts of Lagos State, Nigeria.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-black text-zinc-950">
                9. Legal Contact Information
              </h2>
              <p>
                For official legal notices or contractual inquiries, contact:
              </p>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-2 font-medium text-xs text-zinc-800">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
                  <span>Legal Department: <strong>legal@icxora.com</strong> / <strong>support@icxora.com</strong></span>
                </div>
                <div>
                  LearnArk Technology Limited (RC Registered) • Victoria Island &amp; Lekki Phase 1, Lagos, Nigeria
                </div>
              </div>
            </section>
          </div>

          {/* Navigation CTA */}
          <div className="mt-12 pt-8 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/privacy"
              className="inline-flex items-center gap-2 text-xs font-black text-zinc-900 hover:text-zinc-600 transition-colors"
            >
              <span>Read Privacy Policy</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/support"
              className="inline-flex items-center gap-2 text-xs font-black text-zinc-900 hover:text-zinc-600 transition-colors"
            >
              <span>Contact Support Desk</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
