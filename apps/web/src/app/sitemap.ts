import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || 'https://icxora.com';
  const now = new Date();

  return [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/editing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/photographers`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/rentals`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/support`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}

