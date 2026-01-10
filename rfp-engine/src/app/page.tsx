import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { JsonLd, organizationSchema, softwareApplicationSchema } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "AI-Powered RFP & Tender Response Software",
  description: "Upload RFP documents and get a structured compliance matrix with AI-generated draft responses in minutes. Track requirements, manage deadlines, and win more bids.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareApplicationSchema} />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="font-bold text-xl">RFP Engine</div>
          <div className="flex gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
            Respond to RFPs and Tenders
            <span className="text-blue-600"> 10x Faster</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Upload an RFP and get a structured compliance matrix with draft responses in minutes.
            Never miss a requirement again.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8">
                Start Free Trial
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8">
                See How It Works
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <section id="features" className="mt-32">
          <h2 className="text-3xl font-bold text-center mb-12">How RFP Engine Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-xl border bg-white">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Extract Requirements</h3>
            <p className="text-gray-600">
              Upload PDF or Word documents. Our AI extracts every question and requirement automatically.
            </p>
          </div>

          <div className="p-6 rounded-xl border bg-white">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Track Compliance</h3>
            <p className="text-gray-600">
              Visual compliance matrix shows your progress. Mark items as answered, partial, or pending.
            </p>
          </div>

          <div className="p-6 rounded-xl border bg-white">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Draft Responses</h3>
            <p className="text-gray-600">
              AI generates first-draft responses for each requirement. Edit and refine to perfection.
            </p>
          </div>
          </div>
        </section>

        {/* Pricing */}
        <div className="mt-32 text-center">
          <h2 className="text-3xl font-bold mb-4">Simple Pricing</h2>
          <p className="text-gray-600 mb-12">Start free, upgrade when you need more</p>

          <div className="max-w-sm mx-auto p-8 rounded-2xl border-2 border-blue-600 bg-white">
            <div className="text-sm font-medium text-blue-600 mb-2">PRO PLAN</div>
            <div className="text-4xl font-bold mb-2">
              £99<span className="text-lg font-normal text-gray-500">/month</span>
            </div>
            <ul className="text-left space-y-3 my-8">
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Up to 10 active tenders
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Compliance matrix
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                AI draft responses
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Past response reuse
              </li>
            </ul>
            <Link href="/signup">
              <Button className="w-full" size="lg">Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-32 py-12 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="font-bold text-lg mb-4">RFP Engine</div>
              <p className="text-gray-600 text-sm">
                AI-powered RFP and tender response management software.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/#features" className="text-gray-600 hover:text-gray-900">Features</Link></li>
                <li><Link href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Account</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="text-gray-600 hover:text-gray-900">Sign In</Link></li>
                <li><Link href="/signup" className="text-gray-600 hover:text-gray-900">Create Account</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="text-gray-600 hover:text-gray-900">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-gray-600 hover:text-gray-900">Terms of Service</Link></li>
                <li><Link href="/cookies" className="text-gray-600 hover:text-gray-900">Cookie Policy</Link></li>
                <li><Link href="/ccpa" className="text-gray-600 hover:text-gray-900">CCPA Notice</Link></li>
                <li><Link href="/dpa" className="text-gray-600 hover:text-gray-900">Data Processing Agreement</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} RFP Engine. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
