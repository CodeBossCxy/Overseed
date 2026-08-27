import type { MetadataRoute } from 'next'

const BASE_URL = 'https://overseed.net'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: '/', priority: 1 },
    { path: '/brand', priority: 0.9 },
    { path: '/creator', priority: 0.9 },
    { path: '/browse', priority: 0.8 },
    { path: '/pricing/brand', priority: 0.7 },
    { path: '/faq', priority: 0.5 },
    { path: '/contact', priority: 0.5 },
    { path: '/terms', priority: 0.3 },
    { path: '/privacy', priority: 0.3 },
    { path: '/guidelines', priority: 0.3 },
  ]

  return routes.map(({ path, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority,
  }))
}
