import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-xl text-slate-800 tracking-tight">
            RFP Matrix
          </Link>
          <nav className="flex gap-1 text-sm">
            <Link href="/privacy" className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-[#0d9488] hover:bg-[#f0fdfa] transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-[#0d9488] hover:bg-[#f0fdfa] transition-colors">
              Terms
            </Link>
            <Link href="/cookies" className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-[#0d9488] hover:bg-[#f0fdfa] transition-colors">
              Cookies
            </Link>
            <Link href="/ccpa" className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-[#0d9488] hover:bg-[#f0fdfa] transition-colors">
              CCPA
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-12 legal-content max-w-none [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:text-slate-800 [&_h1]:mb-4 [&_h1]:tracking-tight [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-800 [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_p]:text-slate-600 [&_p]:leading-relaxed [&_section]:mb-8 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-2 [&_li]:text-slate-600 [&_a]:text-[#0d9488] [&_a]:underline [&_a]:decoration-[#0d9488]/30 [&_a:hover]:text-[#0f766e] [&_a:hover]:decoration-[#0f766e] [&_strong]:font-semibold [&_strong]:text-slate-700">
          {children}
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/privacy" className="text-slate-500 hover:text-[#0d9488] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-slate-500 hover:text-[#0d9488] transition-colors">
              Terms of Service
            </Link>
            <Link href="/cookies" className="text-slate-500 hover:text-[#0d9488] transition-colors">
              Cookie Policy
            </Link>
            <Link href="/ccpa" className="text-slate-500 hover:text-[#0d9488] transition-colors">
              California Privacy Rights
            </Link>
            <Link href="/dpa" className="text-slate-500 hover:text-[#0d9488] transition-colors">
              Data Processing Agreement
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            &copy; {new Date().getFullYear()} RFP Matrix. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
