import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            RFP Engine
          </Link>
          <nav className="flex gap-6 text-sm">
            <Link href="/privacy" className="text-gray-600 hover:text-gray-900">
              Privacy
            </Link>
            <Link href="/terms" className="text-gray-600 hover:text-gray-900">
              Terms
            </Link>
            <Link href="/cookies" className="text-gray-600 hover:text-gray-900">
              Cookies
            </Link>
            <Link href="/ccpa" className="text-gray-600 hover:text-gray-900">
              CCPA
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <article className="prose prose-gray max-w-none">
          {children}
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-wrap gap-6 text-sm text-gray-600">
            <Link href="/privacy" className="hover:text-gray-900">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-gray-900">
              Terms of Service
            </Link>
            <Link href="/cookies" className="hover:text-gray-900">
              Cookie Policy
            </Link>
            <Link href="/ccpa" className="hover:text-gray-900">
              California Privacy Rights
            </Link>
            <Link href="/dpa" className="hover:text-gray-900">
              Data Processing Agreement
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            &copy; {new Date().getFullYear()} RFP Engine. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
