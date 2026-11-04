import { NextResponse } from 'next/server';

export async function GET() {
  const data = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: ['*.com.icxstudios.app', '*.com.icxora.app'],
          components: [
            {
              '/': '/dashboard/*',
              comment: 'User order and booking dashboard',
            },
            {
              '/': '/portal/photographer/*',
              comment: 'Photographer operations portal',
            },
            {
              '/': '/bookings/*',
              comment: 'Direct shoot booking confirmations',
            },
            {
              '/': '/editing/*',
              comment: 'Photo retouching packages',
            },
            {
              '/': '/rentals/*',
              comment: 'Cinema vault equipment rentals',
            },
            {
              '/': '/verify-email*',
              comment: 'Account email confirmation links',
            },
          ],
        },
      ],
    },
    webcredentials: {
      apps: ['*.com.icxstudios.app', '*.com.icxora.app'],
    },
  };

  return NextResponse.json(data, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
