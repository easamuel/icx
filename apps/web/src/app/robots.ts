import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || 'https://icxora.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/editing',
          '/photographers',
          '/rentals',
          '/privacy',
          '/terms',
          '/support',
          '/icon.svg',
          '/apple-icon.svg',
        ],
        disallow: [
          '/admin',
          '/admin/*',
          '/l/*',
          '/workspace',
          '/workspace/*',
          '/portal',
          '/portal/*',
          '/dashboard',
          '/dashboard/*',
          '/account',
          '/account/*',
          '/api/*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
