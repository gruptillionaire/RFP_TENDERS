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
        <article className="legal-content max-w-none [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_p]:text-gray-700 [&_p]:leading-relaxed [&_section]:mb-8 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-2 [&_li]:text-gray-700 [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800 [&_strong]:font-semibold">
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
