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
    <div className="min-h-screen bg-[#f8f7f4]">
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareApplicationSchema} />

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-12">
            <Link href="/" className="font-bold text-xl text-slate-900">RFP Matrix</Link>
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              <Link href="#features" className="text-slate-600 hover:text-slate-900">Features</Link>
              <Link href="#pricing" className="text-slate-600 hover:text-slate-900">Pricing</Link>
              <Link href="/blog" className="text-slate-600 hover:text-slate-900">Resources</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <Link href="/dashboard">
                <Button className="bg-blue-600 hover:bg-blue-700">Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link href="/signup">
                  <Button className="bg-blue-600 hover:bg-blue-700">Start for free</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero - Split layout with product preview */}
      <section className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] min-h-[90vh] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Text content */}
            <div className="text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm mb-8">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span className="text-white/80">AI-Powered RFP Response Software</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold leading-[1.1] mb-6">
                Never miss an RFP requirement again
              </h1>
              <p className="text-xl text-white/70 mb-8 leading-relaxed max-w-lg">
                AI extracts every question, tracks your compliance, and drafts responses.
                Focus on winning, not on spreadsheets.
              </p>
              <div className="flex flex-wrap gap-4 mb-8">
                <Link href={isSignedIn ? "/dashboard" : "/signup"}>
                  <Button size="lg" className="bg-[#ffbe0b] hover:bg-[#ffd60a] text-black font-semibold px-8 h-14 text-lg">
                    {isSignedIn ? "Go to Dashboard" : "Start free trial"}
                  </Button>
                </Link>
                <Link href="#features">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 h-14 px-8 text-lg">
                    See how it works
                  </Button>
                </Link>
              </div>
              <p className="text-white/50 text-sm">No credit card required. Plans from $150/mo.</p>
            </div>

            {/* Right - Product preview mockup */}
            <div className="relative lg:pl-8">
              {/* Main app window */}
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/20">
                {/* Window header */}
                <div className="bg-slate-100 px-4 py-3 flex items-center gap-2 border-b">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 text-center text-xs text-slate-500">RFP Matrix - Project View</div>
                </div>
                {/* App content mockup */}
                <div className="p-6 bg-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold text-slate-700">City of Austin - IT Services RFP</div>
                    <div className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">87% Complete</div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-slate-200 rounded-full mb-6">
                    <div className="h-2 bg-green-500 rounded-full" style={{width: '87%'}}></div>
                  </div>
                  {/* Requirements list mockup */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                      <div className="w-5 h-5 rounded bg-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm text-slate-700 flex-1">Describe your project management methodology</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Procedural</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                      <div className="w-5 h-5 rounded bg-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm text-slate-700 flex-1">Provide three relevant case studies</span>
                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">Evidence</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-amber-200 bg-amber-50">
                      <div className="w-5 h-5 rounded bg-amber-400 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">!</span>
                      </div>
                      <span className="text-sm text-slate-700 flex-1">Submit proof of insurance coverage</span>
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">Mandatory</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating stats card */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl p-4 border">
                <div className="text-2xl font-bold text-slate-900">47</div>
                <div className="text-sm text-slate-500">Requirements found</div>
              </div>

              {/* Floating AI card */}
              <div className="absolute -top-4 -right-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm font-medium">AI Draft Ready</span>
                </div>
                <div className="text-xs text-white/80">Click to generate response</div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="#f8f7f4"/>
          </svg>
        </div>
      </section>

      {/* Features - Bento grid layout */}
      <section id="features" className="py-24 bg-[#f8f7f4]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
              Features
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Everything you need to win more bids
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From extraction to export, we handle the tedious parts so you can focus on strategy.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Large feature - spans 2 columns */}
            <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 text-white relative overflow-hidden min-h-[400px]">
              <div className="relative z-10 max-w-md">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-3">AI-Powered Extraction</h3>
                <p className="text-blue-100 leading-relaxed">
                  Upload any RFP document - PDF, Word, or even scanned images. Our AI reads every page,
                  table, and appendix to find requirements others miss.
                </p>
              </div>
              {/* Decorative mockup */}
              <div className="absolute bottom-0 right-0 w-80 h-64 bg-white/10 rounded-tl-3xl backdrop-blur-sm">
                <div className="p-6">
                  <div className="space-y-2">
                    <div className="h-3 bg-white/30 rounded w-3/4"></div>
                    <div className="h-3 bg-white/20 rounded w-full"></div>
                    <div className="h-3 bg-white/20 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tall feature */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-8 text-white min-h-[400px] flex flex-col">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">Compliance Tracking</h3>
              <p className="text-emerald-100 leading-relaxed mb-6">
                Real-time progress on every requirement. Filter by status, priority, or category.
              </p>
              <div className="mt-auto bg-white/10 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span className="font-semibold">87%</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full">
                  <div className="h-2 bg-white rounded-full" style={{width: '87%'}}></div>
                </div>
              </div>
            </div>

            {/* Small feature */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">AI Draft Generation</h3>
              <p className="text-slate-600 leading-relaxed">
                One click generates compliant responses tailored to each requirement type.
              </p>
            </div>

            {/* Small feature */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Response Library</h3>
              <p className="text-slate-600 leading-relaxed">
                Save winning answers and reuse them across proposals. Build your knowledge base.
              </p>
            </div>

            {/* Small feature */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Export Anywhere</h3>
              <p className="text-slate-600 leading-relaxed">
                Export to Word or PDF, formatted and ready for submission.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works - Horizontal timeline style */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-4">
              How it works
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              From upload to submission in three steps
            </h2>
          </div>

          <div className="relative mt-8">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-6 left-[8%] right-[8%] h-0.5 bg-slate-200"></div>

            <div className="grid lg:grid-cols-3 gap-12">
              {/* Step 1 */}
              <div className="relative">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg mb-8 relative z-10 mx-auto lg:mx-0">1</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Upload your RFP</h3>
                <p className="text-slate-600 mb-6">
                  Drag and drop your PDF or Word document. We support files up to 200 pages.
                </p>
                <div className="bg-slate-100 rounded-2xl p-6 border-2 border-dashed border-slate-300">
                  <div className="text-center">
                    <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-slate-500">Drop RFP here or click to browse</p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-lg mb-8 relative z-10 mx-auto lg:mx-0">2</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Review requirements</h3>
                <p className="text-slate-600 mb-6">
                  Our AI extracts every requirement. Review, categorize, and start responding.
                </p>
                <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-3 p-2 bg-white rounded-lg">
                    <div className="w-4 h-4 rounded bg-emerald-500"></div>
                    <span className="text-sm text-slate-700">Technical requirements</span>
                    <span className="ml-auto text-xs text-slate-500">12 items</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-white rounded-lg">
                    <div className="w-4 h-4 rounded bg-blue-500"></div>
                    <span className="text-sm text-slate-700">Company information</span>
                    <span className="ml-auto text-xs text-slate-500">8 items</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-white rounded-lg">
                    <div className="w-4 h-4 rounded bg-amber-500"></div>
                    <span className="text-sm text-slate-700">Pricing & terms</span>
                    <span className="ml-auto text-xs text-slate-500">5 items</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg mb-8 relative z-10 mx-auto lg:mx-0">3</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Draft and export</h3>
                <p className="text-slate-600 mb-6">
                  Generate AI drafts, refine with your team, and export the final document.
                </p>
                <div className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">RFP_Response_Final.docx</div>
                      <div className="text-xs text-slate-500">Ready to download</div>
                    </div>
                    <Button size="sm" className="ml-auto bg-purple-600 hover:bg-purple-700">Export</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing - Card layout with featured */}
      <section id="pricing" className="py-24 bg-[#f8f7f4]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium mb-4">
              Pricing
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-slate-600">
              No hidden fees. Cancel anytime. Start with a free trial.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900">Starter</h3>
                <p className="text-slate-500 text-sm mt-1">For freelancers and consultants</p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold text-slate-900">$150</span>
                <span className="text-slate-500">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-slate-700">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  2 RFPs per month
                </li>
                <li className="flex items-center gap-3 text-slate-700">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  200 AI draft responses
                </li>
                <li className="flex items-center gap-3 text-slate-700">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  150 page limit per RFP
                </li>
                <li className="flex items-center gap-3 text-slate-700">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Word & PDF export
                </li>
              </ul>
              <CheckoutButton plan="STARTER" isSignedIn={isSignedIn} variant="outline" className="w-full h-12 border-slate-300 hover:bg-slate-50">
                Buy Now | $150/month
              </CheckoutButton>
            </div>

            {/* Pro - Featured */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white relative lg:-mt-4 lg:mb-[-16px] shadow-2xl">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 bg-[#ffbe0b] text-black text-sm font-bold rounded-full">Most popular</span>
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold">Pro</h3>
                <p className="text-slate-400 text-sm mt-1">For growing businesses</p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold">$250</span>
                <span className="text-slate-400">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-[#ffbe0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  10 RFPs per month
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-[#ffbe0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  600 AI draft responses
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-[#ffbe0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  200 page limit per RFP
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-[#ffbe0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Response library
                </li>
              </ul>
              <CheckoutButton plan="PRO" isSignedIn={isSignedIn} className="w-full h-12 bg-[#ffbe0b] hover:bg-[#ffd60a] text-black font-semibold">
                Buy Now | $250/month
              </CheckoutButton>
            </div>

            {/* Business */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900">Business</h3>
                <p className="text-slate-500 text-sm mt-1">For agencies and teams</p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold text-slate-900">$500</span>
                <span className="text-slate-500">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-slate-700">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <strong>Unlimited</strong> RFPs
                </li>
                <li className="flex items-center gap-3 text-slate-700">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  600 AI draft responses
                </li>
                <li className="flex items-center gap-3 text-slate-700">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <strong>No page limit</strong>
                </li>
                <li className="flex items-center gap-3 text-slate-700">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Priority support
                </li>
              </ul>
              <CheckoutButton plan="BUSINESS" isSignedIn={isSignedIn} variant="outline" className="w-full h-12 border-slate-300 hover:bg-slate-50">
                Buy Now | $500/month
              </CheckoutButton>
            </div>
          </div>

          {/* Enterprise and Single RFP options */}
          <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Enterprise */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-bold text-lg">Enterprise</h4>
                  <p className="text-slate-400 text-sm mt-1">For large organizations</p>
                </div>
                <span className="text-2xl font-bold">Custom</span>
              </div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Unlimited everything
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Dedicated account manager
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Custom integrations & SLA
                </li>
              </ul>
              <Link href="mailto:enterprise@rfpmatrix.com">
                <Button variant="outline" className="w-full border-white/30 text-white hover:bg-white/10">
                  Contact Us
                </Button>
              </Link>
            </div>

            {/* Single RFP */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-bold text-lg text-slate-900">Single RFP</h4>
                  <p className="text-slate-600 text-sm mt-1">One-time purchase</p>
                </div>
                <span className="text-2xl font-bold text-slate-900">$100</span>
              </div>
              <ul className="space-y-2 mb-6 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  1 RFP extraction
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  100 AI draft responses
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  No subscription required
                </li>
              </ul>
              <CheckoutButton plan="SINGLE_USE" isSignedIn={isSignedIn} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                Buy Now | $100 One-Time
              </CheckoutButton>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-slate-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to win more bids?
          </h2>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Join hundreds of businesses using RFP Matrix to respond faster and never miss a requirement.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={isSignedIn ? "/dashboard" : "/signup"}>
              <Button size="lg" className="bg-[#ffbe0b] hover:bg-[#ffd60a] text-black font-semibold px-8 h-14 text-lg">
                {isSignedIn ? "Go to Dashboard" : "Start your free trial"}
              </Button>
            </Link>
            <Link href="/blog/go-no-go-decision-framework">
              <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 h-14 px-8 text-lg">
                Read our resources
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="font-bold text-xl text-white mb-4">RFP Matrix</div>
              <p className="text-sm leading-relaxed">
                AI-powered RFP compliance software. Extract requirements, track progress, and draft responses in minutes.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Account</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/login" className="hover:text-white transition-colors">Sign In</Link></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">Create Account</Link></li>
                <li><Link href="/tools/go-no-go" className="hover:text-white transition-colors">Go/No-Go Tool</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link></li>
                <li><Link href="/ccpa" className="hover:text-white transition-colors">CCPA Notice</Link></li>
                <li><Link href="/dpa" className="hover:text-white transition-colors">DPA</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm">
              Questions? <a href="mailto:help@rfpmatrix.com" className="text-blue-400 hover:underline">help@rfpmatrix.com</a>
            </p>
            <p className="text-sm">
              © {new Date().getFullYear()} RFP Matrix. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
