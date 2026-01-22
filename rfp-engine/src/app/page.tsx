import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/CheckoutButton";
import { JsonLd, organizationSchema, softwareApplicationSchema } from "@/components/JsonLd";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "RFP Matrix | AI-Powered RFP Compliance Software for SMEs",
  description: "RFP Matrix extracts every requirement from your RFP documents using AI. Track compliance, generate draft responses, and never miss a requirement again.",
  alternates: {
    canonical: "/",
  },
};

export default async function Home() {
  const session = await auth();
  const isSignedIn = !!session?.user;

  return (
    <div className="min-h-screen">
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareApplicationSchema} />

      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <div className="font-bold text-xl">RFP Matrix</div>
            <div className="text-xs text-slate-400">Compliance-first RFP response planner</div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="#features" className="text-slate-300 hover:text-white transition-colors">Features</Link>
            <Link href="#pricing" className="text-slate-300 hover:text-white transition-colors">Pricing</Link>
            <Link href="/blog" className="text-slate-300 hover:text-white transition-colors">Blog</Link>
          </nav>
          <div className="flex gap-3">
            {isSignedIn ? (
              <Link href="/dashboard">
                <Button className="bg-teal-500 hover:bg-teal-400 text-white border-0">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" className="text-white hover:bg-slate-800">Sign in</Button>
                </Link>
                <Link href="/signup">
                  <Button className="bg-teal-500 hover:bg-teal-400 text-white border-0">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero - Bold gradient background */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 text-white py-24 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-sm font-medium mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
              Built for Small & Medium Businesses
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
              100% RFP Compliance.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300">
                Zero Missed Requirements.
              </span>
            </h1>
            <p className="text-xl text-slate-300 mb-10 leading-relaxed">
              Stop losing bids to missed requirements. Our AI extracts every question from your RFP,
              tracks your compliance status, and drafts responses - so you can focus on winning.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href={isSignedIn ? "/dashboard" : "/signup"}>
                <Button size="lg" className="text-lg px-8 py-6 bg-teal-500 hover:bg-teal-400 text-white border-0 shadow-lg shadow-teal-500/25 transition-all hover:shadow-xl hover:shadow-teal-500/30 hover:-translate-y-0.5">
                  {isSignedIn ? "Go to Dashboard" : "Get Started Free"}
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-slate-600 text-white hover:bg-slate-800 hover:border-slate-500">
                  See How It Works
                </Button>
              </Link>
            </div>
            <p className="text-sm text-slate-400 mt-6">Plans from $150/month. No credit card required to start.</p>
          </div>
        </div>
      </section>

      {/* Features - Colorful cards on light background */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold mb-4">
              How It Works
            </span>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Three Steps to Complete Compliance</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              No RFP expertise required. Just upload, track, and respond.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 - Blue card */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl transform transition-transform group-hover:scale-[1.02] shadow-xl" />
              <div className="relative p-8 text-white">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-6">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-blue-200 text-sm font-semibold mb-2">Step 1</div>
                <h3 className="text-2xl font-bold mb-3">Upload Your RFP</h3>
                <p className="text-blue-100 leading-relaxed">
                  Drop in a PDF or Word document. Our AI scans every page and extracts all requirements, including those hidden in tables and appendices.
                </p>
              </div>
            </div>

            {/* Step 2 - Green card */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl transform transition-transform group-hover:scale-[1.02] shadow-xl" />
              <div className="relative p-8 text-white">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-6">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="text-emerald-200 text-sm font-semibold mb-2">Step 2</div>
                <h3 className="text-2xl font-bold mb-3">Track Every Requirement</h3>
                <p className="text-emerald-100 leading-relaxed">
                  See your compliance score in real-time. Filter by category, priority, or status. Never wonder "did we answer everything?" again.
                </p>
              </div>
            </div>

            {/* Step 3 - Purple card */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl transform transition-transform group-hover:scale-[1.02] shadow-xl" />
              <div className="relative p-8 text-white">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-6">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="text-purple-200 text-sm font-semibold mb-2">Step 3</div>
                <h3 className="text-2xl font-bold mb-3">Generate Draft Responses</h3>
                <p className="text-purple-100 leading-relaxed">
                  AI drafts compliant responses for each requirement. Reuse winning answers from your library. Export to Word/PDF when you're ready.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof banner */}
      <section className="bg-teal-600 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 text-white">
            <div className="text-center">
              <div className="text-3xl font-bold">500+</div>
              <div className="text-teal-100 text-sm">RFPs Processed</div>
            </div>
            <div className="h-10 w-px bg-teal-500 hidden md:block" />
            <div className="text-center">
              <div className="text-3xl font-bold">98%</div>
              <div className="text-teal-100 text-sm">Extraction Accuracy</div>
            </div>
            <div className="h-10 w-px bg-teal-500 hidden md:block" />
            <div className="text-center">
              <div className="text-3xl font-bold">4.5hrs</div>
              <div className="text-teal-100 text-sm">Avg. Time Saved</div>
            </div>
            <div className="h-10 w-px bg-teal-500 hidden md:block" />
            <div className="text-center">
              <div className="text-3xl font-bold">100%</div>
              <div className="text-teal-100 text-sm">Compliance Tracking</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing - White background with colorful cards */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold mb-4">
              Simple Pricing
            </span>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Choose Your Plan</h2>
            <p className="text-lg text-slate-600">
              No hidden fees. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Starter */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 flex flex-col hover:border-slate-300 hover:shadow-lg transition-all">
              <h3 className="text-lg font-bold text-slate-900">Starter</h3>
              <p className="text-sm text-slate-500 mt-1">For freelancers</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">$150</span>
                <span className="text-slate-500">/mo</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm flex-1">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>2 RFPs/month</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>200 AI drafts</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>150 page limit</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Word & PDF export</span>
                </li>
              </ul>
              <div className="mt-6">
                <CheckoutButton plan="STARTER" isSignedIn={isSignedIn} variant="outline" className="w-full">
                  Get Started
                </CheckoutButton>
              </div>
            </div>

            {/* Pro - Featured */}
            <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 p-6 flex flex-col text-white shadow-xl shadow-teal-500/25 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-amber-900 shadow-lg">
                  Most Popular
                </span>
              </div>
              <h3 className="text-lg font-bold">Pro</h3>
              <p className="text-sm text-teal-100 mt-1">For SMEs</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$250</span>
                <span className="text-teal-200">/mo</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm flex-1">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>10 RFPs/month</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>600 AI drafts</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>200 page limit</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Response library</span>
                </li>
              </ul>
              <div className="mt-6">
                <CheckoutButton plan="PRO" isSignedIn={isSignedIn} className="w-full bg-white text-teal-600 hover:bg-teal-50">
                  Get Started
                </CheckoutButton>
              </div>
            </div>

            {/* Business */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 flex flex-col hover:border-slate-300 hover:shadow-lg transition-all">
              <h3 className="text-lg font-bold text-slate-900">Business</h3>
              <p className="text-sm text-slate-500 mt-1">For agencies</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">$500</span>
                <span className="text-slate-500">/mo</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm flex-1">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="font-semibold">Unlimited RFPs</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>600 AI drafts</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="font-semibold">No page limit</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Priority support</span>
                </li>
              </ul>
              <div className="mt-6">
                <CheckoutButton plan="BUSINESS" isSignedIn={isSignedIn} variant="outline" className="w-full">
                  Get Started
                </CheckoutButton>
              </div>
            </div>

            {/* Enterprise */}
            <div className="rounded-2xl bg-slate-900 p-6 flex flex-col text-white">
              <h3 className="text-lg font-bold">Enterprise</h3>
              <p className="text-sm text-slate-400 mt-1">For large orgs</p>
              <div className="mt-4">
                <span className="text-2xl font-bold">Custom</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm flex-1">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="font-semibold">Unlimited everything</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>SSO & SAML</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Custom integrations</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Dedicated support</span>
                </li>
              </ul>
              <div className="mt-6">
                <a href="mailto:sales@rfpmatrix.com?subject=Enterprise%20Plan%20Inquiry">
                  <Button variant="outline" className="w-full border-slate-600 text-white hover:bg-slate-800">
                    Contact Sales
                  </Button>
                </a>
              </div>
            </div>
          </div>

          {/* Single RFP option */}
          <div className="mt-16">
            <div className="max-w-lg mx-auto">
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-8 text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-lg">
                    One-Time Purchase
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">Just need one RFP?</h3>
                <p className="text-slate-600 mt-2">Pay once, no subscription required</p>
                <div className="mt-4 flex items-baseline gap-1 justify-center">
                  <span className="text-4xl font-bold text-slate-900">$100</span>
                  <span className="text-slate-500">one-time</span>
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-slate-600">
                  <span className="px-3 py-1 bg-white rounded-full">1 RFP</span>
                  <span className="px-3 py-1 bg-white rounded-full">100 AI drafts</span>
                  <span className="px-3 py-1 bg-white rounded-full">30-day access</span>
                </div>
                <div className="mt-6">
                  <CheckoutButton plan="SINGLE_USE" isSignedIn={isSignedIn} className="bg-amber-500 hover:bg-amber-600 text-white">
                    Buy Now - $100
                  </CheckoutButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust signals - Dark section */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center p-6 rounded-xl bg-slate-800/50">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="font-semibold text-lg mb-2">Secure & Private</div>
              <p className="text-sm text-slate-400">Your RFPs are encrypted and never used for AI training</p>
            </div>
            <div className="text-center p-6 rounded-xl bg-slate-800/50">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="font-semibold text-lg mb-2">GDPR Compliant</div>
              <p className="text-sm text-slate-400">Full data protection with EU-compliant practices</p>
            </div>
            <div className="text-center p-6 rounded-xl bg-slate-800/50">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="font-semibold text-lg mb-2">Fast Setup</div>
              <p className="text-sm text-slate-400">Upload your first RFP in under 2 minutes</p>
            </div>
            <div className="text-center p-6 rounded-xl bg-slate-800/50">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="font-semibold text-lg mb-2">Cancel Anytime</div>
              <p className="text-sm text-slate-400">No contracts. No setup fees. No surprises.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Go/No-Go Resource */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-8 md:p-12 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-sm font-medium mb-3">
                  Free Resource
                </span>
                <h3 className="text-2xl md:text-3xl font-bold mb-2">Not sure if you should respond?</h3>
                <p className="text-blue-100 text-lg">
                  Use our Go/No-Go Decision Framework to evaluate opportunities before committing.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <Link href="/blog/go-no-go-decision-framework">
                  <Button variant="outline" className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10">
                    Read the Guide
                  </Button>
                </Link>
                <Link href="/tools/go-no-go">
                  <Button className="w-full sm:w-auto bg-white text-purple-600 hover:bg-purple-50">
                    Use the Tool
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-teal-600 to-teal-700 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to win more bids?</h2>
          <p className="text-xl text-teal-100 mb-10">
            Join SMEs who respond to RFPs faster and never miss a requirement.
          </p>
          <Link href={isSignedIn ? "/dashboard" : "/signup"}>
            <Button size="lg" className="text-lg px-10 py-6 bg-white text-teal-600 hover:bg-teal-50 shadow-xl shadow-teal-800/20">
              {isSignedIn ? "Go to Dashboard" : "Get Started Free"}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="font-bold text-xl text-white mb-2">RFP Matrix</div>
              <p className="text-sm text-slate-400 mb-4">Compliance-first RFP response planner</p>
              <p className="text-sm">
                AI-powered RFP and tender response management software.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Account</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="hover:text-white transition-colors">Sign In</Link></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">Create Account</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link></li>
                <li><Link href="/ccpa" className="hover:text-white transition-colors">CCPA Notice</Link></li>
                <li><Link href="/dpa" className="hover:text-white transition-colors">Data Processing Agreement</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm">
              Need help? <a href="mailto:help@rfpmatrix.com" className="text-teal-400 hover:underline">help@rfpmatrix.com</a>
            </p>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} RFP Matrix. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
