import Link from "next/link";
import { ReactNode } from "react";

interface BlogPostLayoutProps {
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: string;
  children: ReactNode;
}

export function BlogPostLayout({
  title,
  description,
  date,
  readTime,
  category,
  children,
}: BlogPostLayoutProps) {
  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/blog" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            &larr; Back to Blog
          </Link>
          <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm">
            RFP Matrix
          </Link>
        </div>
      </header>

      {/* Article */}
      <article className="max-w-3xl mx-auto px-4 py-12">
        {/* Meta */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              {category}
            </span>
            <span className="text-gray-500 text-sm">{readTime}</span>
            <span className="text-gray-400">|</span>
            <time className="text-gray-500 text-sm">{formattedDate}</time>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {title}
          </h1>
          <p className="text-xl text-gray-600">{description}</p>
        </div>

        {/* Content */}
        <div className="prose prose-lg prose-blue max-w-none">
          {children}
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
            Start Free Trial
          </Link>
        </div>

        {/* Share */}
        <div className="mt-12 pt-8 border-t">
          <p className="text-gray-600 text-center">
            Found this helpful? Share it with your team.
          </p>
        </div>
      </article>

      {/* Footer */}
      <footer className="bg-white border-t py-8">
        <div className="max-w-3xl mx-auto px-4 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} RFP Matrix. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
