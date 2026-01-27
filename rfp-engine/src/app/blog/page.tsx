import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "RFP Matrix Blog - RFP Response Tips & Best Practices",
  description: "Expert insights on RFP response management, bid strategies, and procurement best practices. Learn how to win more contracts.",
  keywords: ["RFP tips", "bid management", "proposal writing", "RFP response", "procurement"],
};

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: string;
}

const blogPosts: BlogPost[] = [
  {
    slug: "scoring-quality-submissions",
    title: "How to Score Higher on Quality Submissions",
    description: "Price gets you shortlisted. Quality scores win the contract. Here is how evaluators grade quality responses and what separates a 3 from a 5.",
    date: "2025-05-01",
    readTime: "10 min read",
    category: "Strategy",
  },
  {
    slug: "faster-rfp-turnaround",
    title: "The Bid Manager's Guide to Faster RFP Turnaround",
    description: "Most RFP responses take two to three weeks. The best teams do it in five days. Here is how they cut the fat without cutting corners.",
    date: "2025-04-16",
    readTime: "9 min read",
    category: "Process",
  },
  {
    slug: "spreadsheets-vs-bid-software",
    title: "Spreadsheets vs Bid Management Software: When to Switch",
    description: "Excel works until it does not. Here are the signs your bid team has outgrown spreadsheets and what to look for in dedicated software.",
    date: "2025-04-02",
    readTime: "8 min read",
    category: "Tools",
  },
  {
    slug: "winning-public-sector-contracts",
    title: "How to Win Public Sector Contracts as an SME",
    description: "Public sector procurement looks intimidating, but it is designed to give SMEs a fair shot. Here is how to find, qualify for, and win government contracts.",
    date: "2025-03-19",
    readTime: "12 min read",
    category: "Strategy",
  },
  {
    slug: "health-safety-tender-requirements",
    title: "Health and Safety Requirements in Tenders: What Evaluators Check",
    description: "Health and safety sections carry heavy weighting in construction and facilities tenders. Here is exactly what evaluators look for and how to present it.",
    date: "2025-03-05",
    readTime: "10 min read",
    category: "Compliance",
  },
  {
    slug: "common-rfp-mistakes",
    title: "7 RFP Mistakes That Cost You the Contract",
    description: "You wrote a solid proposal and still lost. Odds are, one of these seven mistakes buried your score before the evaluator finished reading.",
    date: "2025-02-19",
    readTime: "8 min read",
    category: "Strategy",
  },
  {
    slug: "managing-multiple-tenders",
    title: "How to Manage Multiple Tenders Without Burning Out",
    description: "Running five tenders at once with a two-person team is normal in SMEs. Here is how to stay on top of deadlines without working weekends.",
    date: "2025-02-05",
    readTime: "9 min read",
    category: "Process",
  },
  {
    slug: "construction-tender-compliance",
    title: "Construction Tender Compliance: A Practical Guide",
    description: "Construction tenders have specific compliance demands that generic bid advice ignores. This guide covers what evaluators actually check and how to pass.",
    date: "2025-01-22",
    readTime: "11 min read",
    category: "Industry",
  },
  {
    slug: "rfp-vs-rfq-vs-rfi",
    title: "RFP vs RFQ vs RFI: What's the Difference?",
    description: "Understand the key differences between Requests for Proposals, Quotes, and Information. Learn when each is used and how to respond effectively.",
    date: "2025-01-15",
    readTime: "8 min read",
    category: "Fundamentals",
  },
  {
    slug: "how-to-write-winning-rfp-response",
    title: "How to Write a Winning RFP Response (Step-by-Step)",
    description: "A comprehensive guide to crafting RFP responses that stand out. From requirement analysis to final submission, master every step of the process.",
    date: "2025-01-14",
    readTime: "15 min read",
    category: "Strategy",
  },
  {
    slug: "go-no-go-decision-framework",
    title: "Should You Respond to This RFP? A Go/No-Go Decision Framework",
    description: "Not every RFP is worth pursuing. Learn how to evaluate opportunities and make data-driven decisions about which bids to prioritize.",
    date: "2025-01-13",
    readTime: "10 min read",
    category: "Strategy",
  },
  {
    slug: "best-rfp-software-2025",
    title: "Best RFP Software in 2025: Complete Comparison Guide",
    description: "An honest comparison of the top RFP response management tools. Features, pricing, pros and cons to help you choose the right solution.",
    date: "2025-01-12",
    readTime: "12 min read",
    category: "Tools",
  },
  {
    slug: "true-cost-of-responding-to-rfps",
    title: "The True Cost of Responding to RFPs (And How to Reduce It)",
    description: "Most companies underestimate what RFP responses really cost. Discover the hidden expenses and strategies to improve your ROI.",
    date: "2025-01-11",
    readTime: "9 min read",
    category: "Business",
  },
  {
    slug: "small-bid-teams-advantage",
    title: "Why Small Bid Teams Win More Than You Think",
    description: "A two-person bid team can outperform a department of ten. Here is why smaller teams have a structural advantage in competitive tenders.",
    date: "2025-01-06",
    readTime: "8 min read",
    category: "Strategy",
  },
  {
    slug: "pqq-checklist",
    title: "PQQ Checklist: Pre-Qualification Questions Made Simple",
    description: "Pre-Qualification Questionnaires filter out most bidders before the real evaluation starts. Use this checklist so yours does not end up in the reject pile.",
    date: "2024-12-16",
    readTime: "10 min read",
    category: "Fundamentals",
  },
  {
    slug: "what-bid-managers-wish-sales-knew",
    title: "What Bid Managers Wish Their Sales Teams Understood",
    description: "The tension between sales and bid teams costs companies winnable contracts. Here are the five things bid managers want sales to know.",
    date: "2024-12-02",
    readTime: "7 min read",
    category: "Business",
  },
  {
    slug: "compliance-matrix-guide",
    title: "How to Build a Compliance Matrix That Evaluators Actually Use",
    description: "Most compliance matrices get ignored because they are hard to read. Here is how to structure yours so evaluators can score it in seconds.",
    date: "2024-11-18",
    readTime: "9 min read",
    category: "Compliance",
  },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  const categoryColors: Record<string, string> = {
    Fundamentals: "bg-[#dbeafe] text-[#1e40af]",
    Strategy: "bg-[#f3e8ff] text-[#7c3aed]",
    Tools: "bg-[#dcfce7] text-[#166534]",
    Business: "bg-[#fef9c3] text-[#a16207]",
    Compliance: "bg-[#fce7f3] text-[#9d174d]",
    Process: "bg-[#e0f2fe] text-[#0369a1]",
    Industry: "bg-[#fef3c7] text-[#92400e]",
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-xl text-slate-800 tracking-tight">
            RFP Matrix
          </Link>
          <Link href="/" className="text-sm font-medium text-[#0d9488] hover:text-[#0f766e]">
            &larr; Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0d9488] to-[#0f766e] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-white/90">Resources & Insights</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
            RFP Matrix Blog
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Expert insights on RFP response management, bid strategies, and winning more contracts.
          </p>
        </div>
      </section>

      {/* Blog Posts */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-6">
          {blogPosts.map((post) => (
            <article
              key={post.slug}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 transition-all"
            >
              <Link href={`/blog/${post.slug}`} className="block">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-lg ${categoryColors[post.category] || "bg-slate-100 text-slate-600"}`}>
                    {post.category}
                  </span>
                  <span className="text-slate-400 text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {post.readTime}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2 hover:text-[#0d9488] transition-colors">
                  {post.title}
                </h2>
                <p className="text-slate-600 mb-4 line-clamp-2">{post.description}</p>
                <div className="flex items-center justify-between">
                  <time className="text-sm text-slate-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(post.date)}
                  </time>
                  <span className="text-[#0d9488] font-semibold text-sm flex items-center gap-1">
                    Read more
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 bg-gradient-to-br from-[#0d9488] to-[#0f766e] rounded-2xl p-8 text-center text-white shadow-lg">
          <h2 className="text-2xl font-bold mb-3">
            Ready to respond to RFPs 10x faster?
          </h2>
          <p className="text-white/80 mb-6 max-w-lg mx-auto">
            RFP Matrix uses AI to extract requirements and generate draft responses automatically.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-[#0d9488] px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
          >
            Get Started Free
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-slate-500">
          <p>&copy; {new Date().getFullYear()} RFP Matrix. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
