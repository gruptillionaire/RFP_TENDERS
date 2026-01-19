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
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            &larr; Back to RFP Matrix
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            RFP Matrix Blog
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            Expert insights on RFP response management, bid strategies, and winning more contracts.
          </p>
        </div>
      </section>

      {/* Blog Posts */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-8">
          {blogPosts.map((post) => (
            <article
              key={post.slug}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <Link href={`/blog/${post.slug}`} className="block">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {post.category}
                  </span>
                  <span className="text-gray-500 text-sm">{post.readTime}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                  {post.title}
                </h2>
                <p className="text-gray-600 mb-4">{post.description}</p>
                <div className="flex items-center justify-between">
                  <time className="text-sm text-gray-500">
                    {formatDate(post.date)}
                  </time>
                  <span className="text-blue-600 font-medium text-sm">
                    Read more &rarr;
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">
            Ready to respond to RFPs 10x faster?
          </h2>
          <p className="text-blue-100 mb-6 max-w-lg mx-auto">
            RFP Matrix uses AI to extract requirements and generate draft responses automatically.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} RFP Matrix. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
