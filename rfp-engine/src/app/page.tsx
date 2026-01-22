import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckoutButton } from "@/components/CheckoutButton";
import { JsonLd, organizationSchema, softwareApplicationSchema } from "@/components/JsonLd";
import { auth } from "@/lib/auth";
import { IllustrationPlaceholder } from "@/components/IllustrationPlaceholder";

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
    <div className="min-h-screen bg-background">
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareApplicationSchema} />

      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <div className="font-bold text-xl gradient-text">RFP Matrix</div>
            <div className="text-xs text-muted-foreground">Compliance-first RFP response planner</div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link>
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
          <Badge variant="teal" className="mb-6">
            Built for Small & Medium Businesses
          </Badge>
          <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6">
            100% RFP Compliance.
            <span className="gradient-text"> Zero Missed Requirements.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Stop losing bids to missed requirements. Our AI extracts every question from your RFP,
            tracks your compliance status, and drafts responses so you can focus on winning.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href={isSignedIn ? "/dashboard" : "/signup"}>
              <Button variant="gradient" size="lg" className="text-lg px-8">
                {isSignedIn ? "Go to Dashboard" : "Get Started"}
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8">
                See How It Works
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">Plans from $150/month.</p>
        </div>

        {/* Features */}
        <section id="features" className="mt-32">
          <h2 className="text-3xl font-bold text-center mb-4">How RFP Matrix Works</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Three steps to complete compliance. No RFP expertise required.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl border bg-card hover:shadow-lg hover:border-primary/20 transition-all">
              <div className="w-12 h-12 bg-pill-teal rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-pill-teal-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <Badge variant="teal" className="mb-2">Step 1</Badge>
              <h3 className="text-lg font-semibold mb-2">Upload Your RFP</h3>
              <p className="text-muted-foreground">
                Drop in a PDF or Word document. Our AI scans every page and extracts all requirements, including those hidden in tables and appendices.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-card hover:shadow-lg hover:border-primary/20 transition-all">
              <div className="w-12 h-12 bg-pill-green rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-pill-green-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <Badge variant="green" className="mb-2">Step 2</Badge>
              <h3 className="text-lg font-semibold mb-2">Track Every Requirement</h3>
              <p className="text-muted-foreground">
                See your compliance score in real-time. Filter by category, priority, or status. Never wonder &quot;did we answer everything?&quot; again.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-card hover:shadow-lg hover:border-primary/20 transition-all">
              <div className="w-12 h-12 bg-pill-purple rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-pill-purple-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <Badge variant="purple" className="mb-2">Step 3</Badge>
              <h3 className="text-lg font-semibold mb-2">Generate Draft Responses</h3>
              <p className="text-muted-foreground">
                AI drafts compliant responses for each requirement. Reuse winning answers from your library. Export to Word/PDF when you&apos;re ready.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mt-32">
          <h2 className="text-3xl font-bold text-center mb-12">Pricing</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Starter */}
            <div className="p-6 rounded-2xl border-2 border-border bg-card flex flex-col hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-foreground">Starter</h3>
              <p className="text-sm text-muted-foreground mt-1">For freelancers</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">$150</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>2 RFPs/month</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>200 AI drafts</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>150 page limit/upload</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Export to Word & PDF</span>
                </li>
              </ul>
              <div className="mt-auto pt-6">
                <CheckoutButton plan="STARTER" isSignedIn={isSignedIn} variant="outline" className="w-full">
                  Buy Now - $150/mo
                </CheckoutButton>
              </div>
            </div>

            {/* Pro - Most Popular */}
            <div className="p-6 rounded-2xl border-2 border-primary bg-card relative flex flex-col gradient-border hover:shadow-lg transition-shadow">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="default">Popular</Badge>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Pro</h3>
              <p className="text-sm text-muted-foreground mt-1">For SMEs</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">$250</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>10 RFPs/month</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>600 AI drafts</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>200 page limit/upload</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Response library</span>
                </li>
              </ul>
              <div className="mt-auto pt-6">
                <CheckoutButton plan="PRO" isSignedIn={isSignedIn} variant="gradient" className="w-full">
                  Buy Now - $250/mo
                </CheckoutButton>
              </div>
            </div>

            {/* Business */}
            <div className="p-6 rounded-2xl border-2 border-border bg-card flex flex-col hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-foreground">Business</h3>
              <p className="text-sm text-muted-foreground mt-1">For agencies</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">$500</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Unlimited RFPs</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>600 AI drafts</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">No page limit</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Priority support</span>
                </li>
              </ul>
              <div className="mt-auto pt-6">
                <CheckoutButton plan="BUSINESS" isSignedIn={isSignedIn} variant="outline" className="w-full">
                  Buy Now - $500/mo
                </CheckoutButton>
              </div>
            </div>

            {/* Enterprise */}
            <div className="p-6 rounded-2xl border-2 border-border bg-card flex flex-col hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-foreground">Enterprise</h3>
              <p className="text-sm text-muted-foreground mt-1">For large organizations</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">Contact Sales</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Unlimited RFPs</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Unlimited AI drafts</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">No page limit</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Dedicated account manager</span>
                </li>
              </ul>
              <div className="mt-auto pt-6">
                <a href="mailto:sales@rfpmatrix.com?subject=Enterprise%20Plan%20Inquiry">
                  <Button variant="secondary" className="w-full">
                    Contact Sales
                  </Button>
                </a>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="relative my-12">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-4 text-muted-foreground">
                Or pay once for a single project
              </span>
            </div>
          </div>

          {/* Single RFP */}
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-foreground">Just need one RFP?</h3>
            <p className="mt-2 text-muted-foreground">Pay once, no subscription required</p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="relative p-6 rounded-2xl bg-pill-orange/30 border-2 border-pill-orange">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="orange">One-Time Purchase</Badge>
              </div>
              <h3 className="text-lg font-semibold text-foreground text-center">Single RFP</h3>
              <p className="text-sm text-muted-foreground mt-1 text-center">Perfect for a single project</p>
              <div className="mt-4 flex items-baseline gap-1 justify-center">
                <span className="text-3xl font-bold text-foreground">$100</span>
                <span className="text-muted-foreground">one-time</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>1 RFP extraction</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>100 AI draft responses</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>150 page limit per upload</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Export to Word & PDF</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>30-day project access</span>
                </li>
              </ul>
              <div className="mt-6">
                <CheckoutButton plan="SINGLE_USE" isSignedIn={isSignedIn} variant="gradient" className="w-full">
                  Buy Now - $100
                </CheckoutButton>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Signals */}
        <section className="mt-32">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-pill-teal flex items-center justify-center">
                <svg className="w-6 h-6 text-pill-teal-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="font-medium text-foreground">Secure & Private</div>
              <p className="text-sm text-muted-foreground mt-1">Your RFPs are encrypted and never used for AI training</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-pill-blue flex items-center justify-center">
                <svg className="w-6 h-6 text-pill-blue-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="font-medium text-foreground">GDPR Compliant</div>
              <p className="text-sm text-muted-foreground mt-1">Full data protection with EU-compliant practices</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-pill-purple flex items-center justify-center">
                <svg className="w-6 h-6 text-pill-purple-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="font-medium text-foreground">Fast Setup</div>
              <p className="text-sm text-muted-foreground mt-1">Upload your first RFP in under 2 minutes</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-pill-green flex items-center justify-center">
                <svg className="w-6 h-6 text-pill-green-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="font-medium text-foreground">Cancel Anytime</div>
              <p className="text-sm text-muted-foreground mt-1">No contracts. No setup fees. No surprises.</p>
            </div>
          </div>
        </section>

        {/* Go/No-Go Resource */}
        <section className="mt-20">
          <div className="gradient-hero-subtle border border-primary/20 rounded-2xl p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <Badge variant="blue" className="mb-2">Decision Framework</Badge>
                <h3 className="text-xl font-semibold text-foreground mb-2">Not sure if you should respond to an RFP?</h3>
                <p className="text-muted-foreground">
                  Use our Go/No-Go Decision Framework to evaluate opportunities before committing resources.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <Link href="/blog/go-no-go-decision-framework">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Read the Guide
                  </Button>
                </Link>
                <Link href="/tools/go-no-go">
                  <Button className="w-full sm:w-auto">
                    Use the Tool
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-32 text-center p-12 gradient-hero-subtle rounded-2xl border border-primary/20">
          <p className="text-xl text-foreground max-w-xl mx-auto">
            Join SMEs who are responding to RFPs faster and never missing a requirement.
          </p>
          <div className="mt-8">
            <Link href={isSignedIn ? "/dashboard" : "/signup"}>
              <Button variant="gradient" size="lg" className="px-8">
                {isSignedIn ? "Go to Dashboard" : "Get Started"}
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-32 py-12 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="font-bold text-lg mb-2 gradient-text">RFP Matrix</div>
              <p className="text-xs text-muted-foreground mb-2">Compliance-first RFP response planner</p>
              <p className="text-muted-foreground text-sm">
                AI-powered RFP and tender response management software.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Account</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">Sign In</Link></li>
                <li><Link href="/signup" className="text-muted-foreground hover:text-foreground transition-colors">Create Account</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">Cookie Policy</Link></li>
                <li><Link href="/ccpa" className="text-muted-foreground hover:text-foreground transition-colors">CCPA Notice</Link></li>
                <li><Link href="/dpa" className="text-muted-foreground hover:text-foreground transition-colors">Data Processing Agreement</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-sm">
              Need help? <a href="mailto:help@rfpmatrix.com" className="text-primary hover:underline">help@rfpmatrix.com</a>
            </p>
          </div>
          <div className="border-t pt-8 text-center text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} RFP Matrix. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
