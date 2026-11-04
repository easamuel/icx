import type { Metadata, Viewport } from 'next';
import './globals.css';
import { WhatsAppSupportButton } from '@/components/layout/WhatsAppSupportButton';

export const metadata: Metadata = {
  title: 'ICX Studios — Commercial Retouching, Master Photographers & Cinema Gear Rental',
  description:
    'The premier creative production house in Lagos & Abuja. Bespoke editorial photo retouching, vetted master photographers, and insured RED/Sony/Profoto cinema equipment rentals.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFFFFF',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-950 antialiased selection:bg-zinc-950 selection:text-white">
        {children}
        <WhatsAppSupportButton />
      </body>
    </html>
  );
}
