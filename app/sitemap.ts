import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.cantonquests.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '/', priority: 1, changeFrequency: 'daily' },
    { path: '/quests', priority: 0.8, changeFrequency: 'daily' },
    { path: '/leaderboard', priority: 0.8, changeFrequency: 'hourly' },
    { path: '/how-it-works', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/register', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/login', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/watch', priority: 0.6, changeFrequency: 'hourly' },
    { path: '/events', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/events/canton-weekend-1', priority: 0.9, changeFrequency: 'daily' },
    { path: '/events/canton-weekend-1/drawing', priority: 0.6, changeFrequency: 'daily' },
    { path: '/rules', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'monthly' },
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
