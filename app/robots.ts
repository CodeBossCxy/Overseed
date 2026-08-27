import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/admin/', '/settings/', '/api/', '/auth/'],
      },
    ],
    sitemap: 'https://overseed.net/sitemap.xml',
  }
}
