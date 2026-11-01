import type { Metadata, Viewport } from 'next';
import './globals.css';
import { WhatsAppSupportButton } from '@/components/layout/WhatsAppSupportButton';

export const metadata: Metadata = {
  title: 'ICX Studios | Pro Photo Retouching, Photographer Booking & Equipment Rental',
  description:
    'Enterprise creative production platform by LearnArk Technology Limited. Order high-end photo editing, book verified photographers, and rent studio equipment.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2A3439',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-icx-slate text-icx-sand antialiased selection:bg-icx-sand selection:text-icx-slate">
        {children}
        <WhatsAppSupportButton />
      </body>
    </html>
  );
}

