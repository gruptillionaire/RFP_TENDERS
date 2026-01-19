import { Metadata } from "next";
import { BlogPostLayout } from "@/components/BlogPostLayout";
import Link from "next/link";

export const metadata: Metadata = {
  title: "RFP vs RFQ vs RFI: What's the Difference?",
  description: "Understand the key differences between Requests for Proposals, Quotes, and Information. Learn when each is used and how to respond effectively.",
  keywords: ["RFP", "RFQ", "RFI", "request for proposal", "request for quote", "request for information", "procurement"],
  openGraph: {
    title: "RFP vs RFQ vs RFI: What's the Difference?",
    description: "Understand the key differences between Requests for Proposals, Quotes, and Information.",
    type: "article",
    publishedTime: "2025-01-15",
  },
};

export default function RfpVsRfqVsRfiPost() {
  return (
    <BlogPostLayout
      title="RFP vs RFQ vs RFI: What's the Difference?"
      description="Understand the key differences between Requests for Proposals, Quotes, and Information. Learn when each is used and how to respond effectively."
      date="2025-01-15"
      readTime="8 min read"
      category="Fundamentals"
    >
      <p>
        If you work in sales, BD, or procurement, you&apos;ve seen the alphabet soup: RFP, RFQ, RFI. People use these terms interchangeably, but they&apos;re not the same thing. Each serves a different purpose in the buying process, and responding to them requires different approaches.
      </p>

      <p>
        Here&apos;s the breakdown.
      </p>

      {/* Quick Reference Table */}
      <div className="my-8 overflow-hidden rounded-lg border border-gray-200">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold m-0">Quick Reference</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 m-0">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">What It Is</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">When It&apos;s Used</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">What They Want</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">RFI</td>
                <td className="px-4 py-3 text-sm text-gray-600">Request for Information</td>
                <td className="px-4 py-3 text-sm text-gray-600">Early exploration</td>
                <td className="px-4 py-3 text-sm text-gray-600">Capabilities, background</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">RFQ</td>
                <td className="px-4 py-3 text-sm text-gray-600">Request for Quote</td>
                <td className="px-4 py-3 text-sm text-gray-600">Clear requirements</td>
                <td className="px-4 py-3 text-sm text-gray-600">Price for specific specs</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">RFP</td>
                <td className="px-4 py-3 text-sm text-gray-600">Request for Proposal</td>
                <td className="px-4 py-3 text-sm text-gray-600">Complex projects</td>
                <td className="px-4 py-3 text-sm text-gray-600">Full solution + pricing</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* RFI Section */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Request for Information (RFI)</h2>

        <p>
          An RFI is the buyer saying: &quot;We&apos;re not sure what we need yet. Tell us what&apos;s out there.&quot;
        </p>

        <p>
          Organizations send RFIs when they&apos;re early in the buying process. They might know they have a problem, but they haven&apos;t figured out the solution. They&apos;re gathering information to shape their eventual requirements.
        </p>

        <div className="bg-slate-50 rounded-lg p-5 my-6">
          <h3 className="text-base font-semibold text-slate-800 mb-3">What makes an RFI different:</h3>
          <ul className="space-y-2 text-slate-700">
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Non-binding for both parties</span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Usually doesn&apos;t ask for pricing</span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Focuses on &quot;what can you do?&quot; not &quot;how much?&quot;</span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Often precedes an RFP</span>
            </li>
          </ul>
        </div>

        <h3 className="text-lg font-semibold mt-6 mb-3">Typical RFI questions look like:</h3>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200 my-4">
          <div className="px-4 py-3 text-gray-700">&quot;Describe your company&apos;s experience in healthcare IT.&quot;</div>
          <div className="px-4 py-3 text-gray-700">&quot;What security certifications does your platform hold?&quot;</div>
          <div className="px-4 py-3 text-gray-700">&quot;How many similar implementations have you completed?&quot;</div>
        </div>

        <h3 className="text-lg font-semibold mt-6 mb-3">How to respond</h3>
        <p>
          Focus on demonstrating expertise. Use case studies, certifications, client logos. Keep it concise - the goal is to get invited to the next stage, not to win the deal right now.
        </p>
      </div>

      {/* RFQ Section */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Request for Quote (RFQ)</h2>

        <p>
          An RFQ is straightforward: &quot;We know exactly what we need. What&apos;s your price?&quot;
        </p>

        <p>
          The buyer has already defined their requirements. They&apos;re shopping for the best deal. Think of it like getting quotes for a well-specified construction job - everyone&apos;s bidding on the same scope.
        </p>

        <div className="bg-slate-50 rounded-lg p-5 my-6">
          <h3 className="text-base font-semibold text-slate-800 mb-3">What makes an RFQ different:</h3>
          <ul className="space-y-2 text-slate-700">
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Price is the main evaluation factor</span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Specifications are locked down</span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Easy to compare vendors side-by-side</span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Shorter response windows</span>
            </li>
          </ul>
        </div>

        <h3 className="text-lg font-semibold mt-6 mb-3">Example RFQ</h3>
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 my-4">
          <p className="text-amber-900 m-0">
            &quot;We need 500 Dell Latitude 5540 laptops with 16GB RAM, 512GB SSD, Windows 11 Pro, delivered by March 1st. Please provide your best price including shipping and 3-year warranty.&quot;
          </p>
        </div>

        <h3 className="text-lg font-semibold mt-6 mb-3">How to respond</h3>
        <p>
          Be precise. Meet the exact specifications. If you can&apos;t match on price alone, highlight value-adds: faster delivery, extended support, volume discounts, local service. But don&apos;t try to change the requirements - that&apos;s not what an RFQ is for.
        </p>
      </div>

      {/* RFP Section */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Request for Proposal (RFP)</h2>

        <p>
          An RFP is the most complex of the three: &quot;Here&apos;s our problem. Tell us how you&apos;d solve it, and what it would cost.&quot;
        </p>

        <p>
          RFPs are used for projects where the buyer needs to evaluate more than just price. They&apos;re looking at your approach, your team, your methodology, your risk mitigation - and yes, your pricing. It&apos;s a holistic evaluation.
        </p>

        <div className="bg-slate-50 rounded-lg p-5 my-6">
          <h3 className="text-base font-semibold text-slate-800 mb-3">What makes an RFP different:</h3>
          <ul className="space-y-2 text-slate-700">
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Detailed responses covering multiple areas</span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Price is one factor among many</span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Vendors propose their own solutions</span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">→</span>
              <span>Often includes presentations and negotiations</span>
            </li>
          </ul>
        </div>

        <h3 className="text-lg font-semibold mt-6 mb-3">Typical RFP sections</h3>
        <div className="grid grid-cols-2 gap-2 my-4">
          <div className="bg-white border border-gray-200 rounded px-3 py-2 text-sm">Executive Summary</div>
          <div className="bg-white border border-gray-200 rounded px-3 py-2 text-sm">Company Background</div>
          <div className="bg-white border border-gray-200 rounded px-3 py-2 text-sm">Technical Approach</div>
          <div className="bg-white border border-gray-200 rounded px-3 py-2 text-sm">Project Team</div>
          <div className="bg-white border border-gray-200 rounded px-3 py-2 text-sm">Implementation Timeline</div>
          <div className="bg-white border border-gray-200 rounded px-3 py-2 text-sm">Pricing</div>
          <div className="bg-white border border-gray-200 rounded px-3 py-2 text-sm">References</div>
          <div className="bg-white border border-gray-200 rounded px-3 py-2 text-sm">Case Studies</div>
        </div>

        <h3 className="text-lg font-semibold mt-6 mb-3">How to respond</h3>
        <p>
          This is where tools like <Link href="/" className="text-blue-600 hover:underline">RFP Matrix</Link> earn their keep. RFPs often contain hundreds of requirements buried across dozens of pages. Missing one &quot;shall&quot; requirement can disqualify you.
        </p>

        <p className="mt-4">
          Success requires reading every requirement, mapping your capabilities to their needs, and telling a story about your solution - not just checking boxes. It&apos;s also a coordination challenge: you&apos;ll need input from multiple people, and someone has to keep it all on track.
        </p>
      </div>

      {/* Procurement Flow */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">How They Fit Together</h2>

        <p>
          These documents often appear in sequence during major procurements:
        </p>

        <div className="my-6 space-y-3">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-sm mr-3">1</div>
            <div className="flex-1 bg-blue-50 rounded-lg px-4 py-3">
              <span className="font-medium text-blue-900">RFI Phase</span>
              <span className="text-blue-700 ml-2">: Buyer explores market, identifies potential vendors</span>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-sm mr-3">2</div>
            <div className="flex-1 bg-blue-50 rounded-lg px-4 py-3">
              <span className="font-medium text-blue-900">RFP Phase</span>
              <span className="text-blue-700 ml-2">: Shortlisted vendors submit detailed proposals</span>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-sm mr-3">3</div>
            <div className="flex-1 bg-blue-50 rounded-lg px-4 py-3">
              <span className="font-medium text-blue-900">Evaluation</span>
              <span className="text-blue-700 ml-2">: Buyer scores and compares proposals</span>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center font-semibold text-sm mr-3">4</div>
            <div className="flex-1 bg-gray-50 rounded-lg px-4 py-3">
              <span className="font-medium text-gray-700">RFQ Phase</span>
              <span className="text-gray-600 ml-2">: (Sometimes) Final pricing negotiations with finalists</span>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-semibold text-sm mr-3">5</div>
            <div className="flex-1 bg-green-50 rounded-lg px-4 py-3">
              <span className="font-medium text-green-900">Award</span>
              <span className="text-green-700 ml-2">: Contract awarded</span>
            </div>
          </div>
        </div>
      </div>

      {/* Common Mistakes */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Mistakes That Cost You Deals</h2>

        <div className="space-y-4">
          <div className="border-l-4 border-red-400 pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">Treating all three the same</h3>
            <p className="text-gray-600 text-sm m-0">
              An RFP-style response to an RFQ wastes everyone&apos;s time. An RFQ-style response to an RFP looks lazy. Match your response to the document type.
            </p>
          </div>

          <div className="border-l-4 border-red-400 pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">Ignoring evaluation criteria</h3>
            <p className="text-gray-600 text-sm m-0">
              Most RFPs tell you exactly how they&apos;ll score responses. If &quot;Technical Approach&quot; is 40% of the score, that section should get 40% of your attention.
            </p>
          </div>

          <div className="border-l-4 border-red-400 pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">Missing mandatory requirements</h3>
            <p className="text-gray-600 text-sm m-0">
              One missed &quot;shall&quot; requirement can disqualify your entire response. Track every requirement in a compliance matrix.
            </p>
          </div>

          <div className="border-l-4 border-red-400 pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">Copy-paste boilerplate</h3>
            <p className="text-gray-600 text-sm m-0">
              Evaluators read dozens of responses. They can spot recycled content immediately. Tailor your response to their specific situation.
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">The Bottom Line</h2>

        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <div className="flex items-start">
            <span className="font-semibold text-gray-900 w-12">RFI:</span>
            <span className="text-gray-700">Early-stage exploration. Focus on capabilities and experience.</span>
          </div>
          <div className="flex items-start">
            <span className="font-semibold text-gray-900 w-12">RFQ:</span>
            <span className="text-gray-700">Price comparison for defined specs. Be precise and competitive.</span>
          </div>
          <div className="flex items-start">
            <span className="font-semibold text-gray-900 w-12">RFP:</span>
            <span className="text-gray-700">Full evaluation. Tell a story about your solution.</span>
          </div>
        </div>

        <p className="mt-6">
          Knowing which type of document you&apos;re dealing with is the first step to responding well. It determines how much time to invest, what to emphasize, and how to structure your response.
        </p>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mt-10">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Need help with RFP responses?</h3>
        <p className="text-gray-700 mb-4">
          RFP Matrix extracts requirements from RFP documents automatically and generates draft responses. Less time on grunt work, more time on winning.
        </p>
        <Link href="/signup" className="inline-flex items-center text-blue-600 font-medium hover:text-blue-700">
          Get started
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </BlogPostLayout>
  );
}
