import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rfpmatrix.com'

  // Blog posts with their publish dates
  const blogPosts = [
    { slug: 'scoring-quality-submissions', date: '2025-05-01' },
    { slug: 'faster-rfp-turnaround', date: '2025-04-16' },
    { slug: 'spreadsheets-vs-bid-software', date: '2025-04-02' },
    { slug: 'winning-public-sector-contracts', date: '2025-03-19' },
    { slug: 'health-safety-tender-requirements', date: '2025-03-05' },
    { slug: 'common-rfp-mistakes', date: '2025-02-19' },
    { slug: 'managing-multiple-tenders', date: '2025-02-05' },
    { slug: 'construction-tender-compliance', date: '2025-01-22' },
    { slug: 'rfp-vs-rfq-vs-rfi', date: '2025-01-15' },
    { slug: 'how-to-write-winning-rfp-response', date: '2025-01-14' },
    { slug: 'go-no-go-decision-framework', date: '2025-01-13' },
    { slug: 'best-rfp-software-2025', date: '2025-01-12' },
    { slug: 'true-cost-of-responding-to-rfps', date: '2025-01-11' },
    { slug: 'small-bid-teams-advantage', date: '2025-01-06' },
    { slug: 'pqq-checklist', date: '2024-12-16' },
    { slug: 'what-bid-managers-wish-sales-knew', date: '2024-12-02' },
    { slug: 'compliance-matrix-guide', date: '2024-11-18' },
  ]

  return [
    // Main pages
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },

    // Blog
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...blogPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),

    // Tools
    {
      url: `${baseUrl}/tools/go-no-go`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },

    // Legal pages
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/ccpa`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/dpa`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]
}
