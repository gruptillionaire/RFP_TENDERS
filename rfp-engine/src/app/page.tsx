import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/CheckoutButton";
import { JsonLd, organizationSchema, softwareApplicationSchema } from "@/components/JsonLd";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "RFP Compliance Software for SMEs | Never Miss a Requirement",
  description: "AI-powered RFP response software built for small and medium businesses. Extract every requirement, ensure 100% compliance, and generate draft responses in minutes.",
  alternates: {
    canonical: "/",
  },
};

export default async function Home() {
  const session = await auth();
  const isSignedIn = !!session?.user;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareApplicationSchema} />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <div className="font-bold text-xl">RFP Matrix</div>
            <div className="text-xs text-gray-500">Compliance-first RFP response planner</div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="#features" className="text-gray-600 hover:text-gray-900">Features</Link>
            <Link href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
          </nav>
          <div className="flex gap-4">
            {isSignedIn ? (
              <Link href="/dashboard">
                <Button>Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link href="/signup">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-6">
            Built for Small & Medium Businesses
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
            100% RFP Compliance.
            <span className="text-blue-600"> Zero Missed Requirements.</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Stop losing bids to missed requirements. Our AI extracts every question from your RFP,
            tracks your compliance status, and drafts responses—so you can focus on winning.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href={isSignedIn ? "/dashboard" : "/signup"}>
              <Button size="lg" className="text-lg px-8">
                {isSignedIn ? "Go to Dashboard" : "Get Started"}
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8">
                See How It Works
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">Plans from £49/month.</p>
        </div>

        {/* Features */}
        <section id="features" className="mt-32">
          <h2 className="text-3xl font-bold text-center mb-4">How RFP Matrix Works</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Three steps to complete compliance. No RFP expertise required.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl border bg-white">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-sm font-medium text-blue-600 mb-1">Step 1</div>
              <h3 className="text-lg font-semibold mb-2">Upload Your RFP</h3>
              <p className="text-gray-600">
                Drop in a PDF or Word document. Our AI scans every page and extracts all requirements—including those hidden in tables and appendices.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-white">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="text-sm font-medium text-green-600 mb-1">Step 2</div>
              <h3 className="text-lg font-semibold mb-2">Track Every Requirement</h3>
              <p className="text-gray-600">
                See your compliance score in real-time. Filter by category, priority, or status. Never wonder "did we answer everything?" again.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-white">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="text-sm font-medium text-purple-600 mb-1">Step 3</div>
              <h3 className="text-lg font-semibold mb-2">Generate Draft Responses</h3>
              <p className="text-gray-600">
                AI drafts compliant responses for each requirement. Reuse winning answers from your library. Export to Word/PDF when you're ready.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mt-32">
          <h2 className="text-3xl font-bold text-center mb-12">Pricing</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Starter */}
            <div className="p-6 rounded-2xl border-2 border-gray-200 bg-white flex flex-col">
              <h3 className="text-lg font-semibold text-gray-900">Starter</h3>
              <p className="text-sm text-gray-500 mt-1">For freelancers</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">£49</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>5 RFP extractions/month</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>250 AI drafts</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Export to PDF</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-gray-400">No Word export</span>
                </li>
              </ul>
              <div className="mt-auto pt-6">
                <CheckoutButton plan="STARTER" isSignedIn={isSignedIn} variant="outline" className="w-full">
                  Buy Now - £49/mo
                </CheckoutButton>
              </div>
            </div>

            {/* Pro - Most Popular */}
            <div className="p-6 rounded-2xl border-2 border-blue-500 bg-white relative flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium bg-blue-500 text-white">
                  Popular
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Pro</h3>
              <p className="text-sm text-gray-500 mt-1">For SMEs</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">£99</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>10 RFP extractions/month</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>500 AI drafts</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Response library</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Export to Word & PDF</span>
                </li>
              </ul>
              <div className="mt-auto pt-6">
                <CheckoutButton plan="PRO" isSignedIn={isSignedIn} className="w-full bg-blue-600 hover:bg-blue-700">
                  Buy Now - £99/mo
                </CheckoutButton>
              </div>
            </div>

            {/* Team */}
            <div className="p-6 rounded-2xl border-2 border-gray-200 bg-white flex flex-col">
              <h3 className="text-lg font-semibold text-gray-900">Team</h3>
              <p className="text-sm text-gray-500 mt-1">For growing teams</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">£179</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>25 RFP extractions/month</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>1,000 AI drafts</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Response library</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Priority support</span>
                </li>
              </ul>
              <div className="mt-auto pt-6">
                <CheckoutButton plan="TEAM" isSignedIn={isSignedIn} variant="outline" className="w-full">
                  Buy Now - £179/mo
                </CheckoutButton>
              </div>
            </div>

            {/* Business */}
            <div className="p-6 rounded-2xl border-2 border-gray-200 bg-white flex flex-col">
              <h3 className="text-lg font-semibold text-gray-900">Business</h3>
              <p className="text-sm text-gray-500 mt-1">For agencies</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">£249</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Unlimited extractions</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Unlimited AI drafts</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Response library</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Priority support</span>
                </li>
              </ul>
              <div className="mt-auto pt-6">
                <CheckoutButton plan="BUSINESS" isSignedIn={isSignedIn} variant="outline" className="w-full">
                  Buy Now - £249/mo
                </CheckoutButton>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="relative my-12">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gradient-to-b from-gray-50 to-white px-4 text-gray-500">
                Or pay once for a single project
              </span>
            </div>
          </div>

          {/* Single RFP */}
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-gray-900">Just need one RFP?</h3>
            <p className="mt-2 text-gray-600">Pay once, no subscription required</p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="relative p-6 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium bg-orange-500 text-white">
                  One-Time Purchase
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center">Single RFP</h3>
              <p className="text-sm text-gray-500 mt-1 text-center">Perfect for a single project</p>
              <div className="mt-4 flex items-baseline gap-1 justify-center">
                <span className="text-3xl font-bold text-gray-900">£40</span>
                <span className="text-gray-500">one-time</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>1 RFP extraction</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>60 AI draft responses</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Export to Word & PDF</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>30-day project access</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-gray-400">No response library</span>
                </li>
              </ul>
              <div className="mt-6">
                <CheckoutButton plan="SINGLE_USE" isSignedIn={isSignedIn} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                  Buy Now - £40
                </CheckoutButton>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Signals */}
        <section className="mt-32">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="font-medium text-gray-900">Secure & Private</div>
              <p className="text-sm text-gray-500 mt-1">Your RFPs are encrypted and never used for AI training</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="font-medium text-gray-900">GDPR Compliant</div>
              <p className="text-sm text-gray-500 mt-1">Full data protection with EU-compliant practices</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="font-medium text-gray-900">Fast Setup</div>
              <p className="text-sm text-gray-500 mt-1">Upload your first RFP in under 2 minutes</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="font-medium text-gray-900">Cancel Anytime</div>
              <p className="text-sm text-gray-500 mt-1">No contracts. No setup fees. No surprises.</p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-32 text-center p-12 bg-blue-50 rounded-2xl">
          <p className="text-xl text-gray-700 max-w-xl mx-auto">
            Join SMEs who are responding to RFPs faster and never missing a requirement.
          </p>
          <div className="mt-8">
            <Link href={isSignedIn ? "/dashboard" : "/signup"}>
              <Button size="lg" className="px-8">
                {isSignedIn ? "Go to Dashboard" : "Get Started"}
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-32 py-12 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="font-bold text-lg mb-2">RFP Matrix</div>
              <p className="text-xs text-gray-500 mb-2">Compliance-first RFP response planner</p>
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
          <div className="border-t pt-8 mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-gray-600 text-sm">
              Need help? <a href="mailto:help@rfpmatrix.com" className="text-blue-600 hover:underline">help@rfpmatrix.com</a>
            </p>
          </div>
          <div className="border-t pt-8 text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} RFP Matrix. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
