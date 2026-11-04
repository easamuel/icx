'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

interface WhatsAppSupportButtonProps {
  contextMessage?: string;
}

export function WhatsAppSupportButton({
  contextMessage = 'Hello ICX Studios Support, I would like assistance with a project.',
}: WhatsAppSupportButtonProps) {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '2348000000000';
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(contextMessage)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with ICX Studios Support on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs font-bold text-white shadow-2xl transition-transform hover:scale-105 focus:outline-none"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
        <MessageCircle className="h-3.5 w-3.5" />
      </span>
      <span className="hidden xs:inline tracking-tight">Studio Support</span>
    </a>
  );
}
