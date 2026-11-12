'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { AppFooter } from '@/components/layout/AppFooter';
import {
  HelpCircle,
  Mail,
  Phone,
  MessageSquare,
  Clock,
  MapPin,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  Send,
  Camera,
  Sliders,
  Package,
} from 'lucide-react';

export default function SupportPage() {
  const envPhone = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '2348000000000').replace(/\D/g, '');
  const displayPhone = envPhone.startsWith('234')
    ? `+234 (0) ${envPhone.slice(3, 6)} ${envPhone.slice(6, 9)} ${envPhone.slice(9)}`
    : `+${envPhone}`;
  const whatsappHref = `https://wa.me/${envPhone}?text=${encodeURIComponent(
    'Hello ICX Studios Support, I need assistance with my project.'
  )}`;

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'retouching',
    orderNumber: '',
    message: '',
  });

  const faqs = [
    {
      category: 'Photo Retouching',
      question: 'What is the standard turnaround time for photo retouching orders?',
      answer:
        'Standard retouching orders are delivered within 24 to 48 hours for standard portrait and fashion sets. Rush production (under 12 hours) is available upon request through the Studio Support. High-volume commercial lookbooks and campaign rolls are scheduled according to frame count.',
    },
    {
      category: 'Photo Retouching',
      question: 'How do watermarked previews and final deliverables work?',
      answer:
        'Once our editors complete your retouching, high-resolution previews with the ICX Studios digital watermark are uploaded to your Client Dashboard. You can review the frames and request revisions. Upon your sign-off and balance clearance (30%), the clean, uncompressed master deliverables are instantly unlocked for full download.',
    },
    {
      category: 'Photographers',
      question: 'How does ICX Studios guarantee booking safety and photographer quality?',
      answer:
        'Every photographer on our roster undergoes strict manual vetting, portfolio verification, and identity checks. Your booking fee is held securely in ICX Escrow and is only released to the photographer after your shoot is completed and original files are transferred.',
    },
    {
      category: 'Photographers',
      question: 'What happens if I need to reschedule or cancel my shoot?',
      answer:
        'You can reschedule or cancel directly through your Dashboard. Cancellations made more than 48 hours before the shoot receive a 100% refund (less standard payment gateway processing fees). Between 24–48 hours, a 50% refund is issued. Cancellations within 24 hours forfeit the deposit to compensate the photographer.',
    },
    {
      category: 'Cinema Equipment',
      question: 'Where do I collect rented cinema cameras and lighting packages?',
      answer:
        'Rented equipment is dispatched from our verified studio vaults in Victoria Island/Lekki Phase 1 (Lagos) and Maitama (Abuja). A formal physical inspection and equipment check-in is conducted with your producer or camera team before dispatch.',
    },
    {
      category: 'Cinema Equipment',
      question: 'What documentation is required to rent high-end camera packages?',
      answer:
        'First-time renters must present a valid government-issued ID (National Identity Card / International Passport / Driver’s License) and verifiable production office or residential details. Security deposits are released within 24 hours of clean return.',
    },
    {
      category: 'Account & Billing',
      question: 'How do I request account deletion or export my personal data?',
      answer:
        'Under our Nigeria Data Protection Act (NDPA) and Apple privacy compliance policies, you can request full account deletion and media asset purging directly by emailing privacy@icxora.com or support@icxora.com. Your request is processed within 30 days.',
    },
  ];

  function handleSubmitInquiry(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitted(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <AppNavbar />

      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1 text-xs font-bold text-zinc-800 shadow-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Dedicated Studio Support &amp; Help Desk</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-zinc-950">
              How Can We Help You?
            </h1>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
              Fast, authoritative assistance for client retouching orders, photographer shoot bookings, cinema vault rentals, and account inquiries.
            </p>
          </div>

          {/* Quick Contact Cards */}
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {/* Card 1: WhatsApp Support */}
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm hover:border-zinc-950 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h3 className="text-base font-black text-zinc-950 group-hover:text-emerald-700 transition-colors">
                  WhatsApp Support
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Real-time direct chat with our production desk for booking adjustments, rush edits, or vault pickup coordinations.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                <span>Chat Instantly</span>
                <span>{displayPhone} →</span>
              </div>
            </a>

            {/* Card 2: Email Support Desk */}
            <a
              href="mailto:support@icxora.com"
              className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm hover:border-zinc-950 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-zinc-100 text-zinc-900 flex items-center justify-center font-bold">
                  <Mail className="h-6 w-6" />
                </div>
                <h3 className="text-base font-black text-zinc-950 group-hover:text-zinc-700 transition-colors">
                  Email Support Desk
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Formal inquiries, enterprise invoicing, privacy requests, and high-volume studio contracts.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-bold text-zinc-950">
                <span>support@icxora.com</span>
                <span>Send Email →</span>
              </div>
            </a>

            {/* Card 3: Studio Hubs & Operating Hours */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-zinc-100 text-zinc-900 flex items-center justify-center font-bold">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="text-base font-black text-zinc-950">
                  Hours &amp; Physical Hubs
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Monday – Saturday: <strong>8:00 AM – 8:00 PM WAT</strong><br />
                  Sunday: On-call for active cinema rental returns &amp; shoot dispatches.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-100 text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
                <span>Victoria Island &amp; Lekki, Lagos • Maitama, Abuja</span>
              </div>
            </div>
          </div>

          {/* Form and FAQ Section */}
          <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-start">
            {/* Contact Inquiry Form */}
            <div className="lg:col-span-5 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h2 className="text-xl font-black text-zinc-950">
                  Send a Support Inquiry
                </h2>
                <p className="mt-1 text-xs text-zinc-600">
                  Our operations team typically responds within 30 minutes during studio hours.
                </p>
              </div>

              {formSubmitted ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-black text-emerald-950">
                    Message Received
                  </h3>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Thank you, <strong>{formData.name || 'Client'}</strong>. Our support desk has received your request and will reach out to <strong>{formData.email}</strong> shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormSubmitted(false);
                      setFormData({ name: '', email: '', category: 'retouching', orderNumber: '', message: '' });
                    }}
                    className="mt-2 text-xs font-bold text-emerald-950 underline cursor-pointer"
                  >
                    Submit another inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitInquiry} className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-zinc-900">
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Femi Adeyemi"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-zinc-900">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-extrabold text-zinc-900">
                        Topic / Category
                      </label>
                      <select
                        aria-label="Inquiry Category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                      >
                        <option value="retouching">Photo Retouching</option>
                        <option value="photographer">Photographer Booking</option>
                        <option value="rentals">Cinema Vault Rental</option>
                        <option value="billing">Billing &amp; Escrow</option>
                        <option value="account">Account &amp; Security</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-zinc-900">
                        Order # (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. #ORD-8492"
                        value={formData.orderNumber}
                        onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-zinc-900">
                      How Can We Help You?
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Provide details about your project, booking request, or question..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-3 text-xs font-black text-white hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Message to Support</span>
                  </button>
                </form>
              )}
            </div>

            {/* Interactive FAQs Accordion */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <h2 className="text-xl font-black text-zinc-950">
                  Frequently Asked Questions
                </h2>
                <p className="mt-1 text-xs text-zinc-600">
                  Everything you need to know about our photo editing, shoot booking, and equipment rental workflows.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {faqs.map((faq, index) => {
                  const isOpen = openFaq === index;
                  return (
                    <div
                      key={index}
                      className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/70 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                            {faq.category}
                          </span>
                          <h3 className="text-xs sm:text-sm font-bold text-zinc-950">
                            {faq.question}
                          </h3>
                        </div>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-600 leading-relaxed border-t border-zinc-100 bg-zinc-50/50">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legal Cross-links */}
              <div className="pt-6 border-t border-zinc-200 flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-500">
                <span>Looking for policies?</span>
                <Link href="/privacy" className="font-bold text-zinc-950 hover:underline">
                  Privacy Policy
                </Link>
                <span>•</span>
                <Link href="/terms" className="font-bold text-zinc-950 hover:underline">
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
