'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

interface WhatsAppSupportButtonProps {
  contextMessage?: string;
}

/**
 * Requirement AC-09: Persistent floating WhatsApp click-to-chat support button on every page.
 */
export function WhatsAppSupportButton({
  contextMessage = 'Hello ICX Studios Support, I need assistance with my account.',
}: WhatsAppSupportButtonProps) {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '2348000000000';
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(contextMessage)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with ICX Studios Support on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full bg-icx-sand px-4 py-3 text-sm font-semibold text-icx-slate shadow-xl ring-1 ring-icx-slate/20 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-icx-success"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-icx-success text-white">
        <MessageCircle className="h-4 w-4" />
      </span>
      <span className="hidden xs:inline">WhatsApp Support</span>
    </a>
  );
}

