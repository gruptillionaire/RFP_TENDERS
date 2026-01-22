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
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/blog" className="text-[#0d9488] hover:text-[#0f766e] text-sm font-medium">
            &larr; Back to Blog
          </Link>
          <Link href="/" className="font-extrabold text-xl text-slate-800 tracking-tight">
            RFP Matrix
          </Link>
        </div>
      </header>

      {/* Article */}
      <article className="max-w-3xl mx-auto px-4 py-12">
        {/* Meta */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-[#ccfbf1] text-[#0f766e] text-xs font-semibold rounded-lg">
              {category}
            </span>
            <span className="text-slate-500 text-sm">{readTime}</span>
            <span className="text-slate-300">|</span>
            <time className="text-slate-500 text-sm">{formattedDate}</time>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            {title}
          </h1>
          <p className="text-xl text-slate-600">{description}</p>
        </div>

        {/* Content */}
        <div className="prose prose-lg prose-slate max-w-none prose-headings:text-slate-900 prose-a:text-[#0d9488] prose-a:no-underline hover:prose-a:underline">
          {children}
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
            className="inline-block bg-white text-[#0d9488] px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
          >
            Get Started
          </Link>
        </div>

        {/* Share */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <p className="text-slate-500 text-center">
            Found this helpful? Share it with your team.
          </p>
        </div>
      </article>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-3xl mx-auto px-4 text-center text-slate-500">
          <p>&copy; {new Date().getFullYear()} RFP Matrix. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
