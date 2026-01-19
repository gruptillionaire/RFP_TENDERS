import { Metadata } from "next";
import { BlogPostLayout } from "@/components/BlogPostLayout";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Should You Respond to This RFP? A Go/No-Go Decision Framework",
  description: "Not every RFP is worth pursuing. Learn how to evaluate opportunities and make data-driven decisions about which bids to prioritize.",
  keywords: ["go no-go decision", "RFP bid decision", "RFP qualification", "bid no-bid", "RFP evaluation"],
  openGraph: {
    title: "Should You Respond to This RFP? A Go/No-Go Decision Framework",
    description: "A structured framework for deciding which RFPs are worth your time and resources.",
    type: "article",
    publishedTime: "2025-01-13",
  },
};

export default function GoNoGoFrameworkPost() {
  return (
    <BlogPostLayout
      title="Should You Respond to This RFP? A Go/No-Go Decision Framework"
      description="Not every RFP is worth pursuing. Learn how to evaluate opportunities and make data-driven decisions about which bids to prioritize."
      date="2025-01-13"
      readTime="10 min read"
      category="Strategy"
    >
      <p>
        A new RFP lands in your inbox. The contract value looks attractive, and the scope matches your capabilities. Before you rally your team for a three-week sprint, there&apos;s a question worth answering first: should you respond at all?
      </p>

      <p>
        High-performing proposal teams aren&apos;t the ones who respond to everything. They&apos;re selective. They invest heavily in opportunities they can win and decline the rest.
      </p>

      <div className="bg-slate-100 border border-slate-200 rounded-lg p-5 my-6">
        <p className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-2">Free Tool</p>
        <p className="text-slate-800">
          Want to quickly assess an RFP opportunity? Use our <Link href="/tools/go-no-go" className="text-blue-600 hover:underline font-medium">Go/No-Go Decision Tool</Link> to get a recommendation in minutes.
        </p>
      </div>

      <h2>Why Selectivity Matters</h2>

      <p>
        Responding to every RFP that crosses your desk has costs that aren&apos;t always obvious:
      </p>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200 my-6">
        <div className="p-4">
          <p className="text-gray-900">A complex RFP response can consume 200+ person-hours in direct labor costs.</p>
        </div>
        <div className="p-4">
          <p className="text-gray-900">Time spent on low-probability bids takes resources away from winnable opportunities.</p>
        </div>
        <div className="p-4">
          <p className="text-gray-900">Constant RFP pressure contributes to team burnout and quality decline.</p>
        </div>
        <div className="p-4">
          <p className="text-gray-900">Submitting weak responses can damage your reputation with that buyer for future opportunities.</p>
        </div>
      </div>

      <p>
        Consider the math: if your win rate is 20% and each response costs $15,000 in labor, you&apos;re effectively spending $75,000 to win each contract. Better selectivity improves this ratio.
      </p>

      <h2>The Framework</h2>

      <p>
        This framework evaluates opportunities across five dimensions. Score each honestly, then add them up. The total guides your decision.
      </p>

      {/* Dimension 1 */}
      <div className="border-l-4 border-blue-500 pl-4 my-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">1. Strategic Fit</h3>
        <p className="text-gray-600 text-sm mb-4">0–20 points · Does this opportunity align with your company&apos;s direction?</p>
      </div>

      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left w-20">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Criteria</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">20</td>
              <td className="border border-gray-300 px-4 py-2">Perfect fit with strategic goals, target market, and growth plans</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 font-medium">15</td>
              <td className="border border-gray-300 px-4 py-2">Good alignment, opens doors to desired market segment</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">10</td>
              <td className="border border-gray-300 px-4 py-2">Neutral—not strategic, but not a distraction either</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 font-medium">5</td>
              <td className="border border-gray-300 px-4 py-2">Marginal fit, would take resources from strategic priorities</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">0</td>
              <td className="border border-gray-300 px-4 py-2">Misaligned with strategy, wrong market or capability area</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 rounded p-4 my-4">
        <p className="font-medium text-gray-700 mb-2">Questions to consider:</p>
        <ul className="text-gray-600 space-y-1 ml-4 list-disc">
          <li>Is this client in a market you want to grow in?</li>
          <li>Will this work strengthen capabilities you&apos;re building?</li>
          <li>Could this become a reference account for future sales?</li>
        </ul>
      </div>

      {/* Dimension 2 */}
      <div className="border-l-4 border-green-500 pl-4 my-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">2. Capability Match</h3>
        <p className="text-gray-600 text-sm mb-4">0–25 points · Can you deliver what they&apos;re asking for?</p>
      </div>

      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left w-20">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Criteria</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">25</td>
              <td className="border border-gray-300 px-4 py-2">You&apos;ve done this exact thing multiple times successfully</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 font-medium">20</td>
              <td className="border border-gray-300 px-4 py-2">Strong experience with minor gaps easily filled</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">15</td>
              <td className="border border-gray-300 px-4 py-2">Solid foundation; some areas require new hires or partners</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 font-medium">10</td>
              <td className="border border-gray-300 px-4 py-2">Moderate gaps that would stretch current capabilities</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">5</td>
              <td className="border border-gray-300 px-4 py-2">Significant gaps; delivery would be risky</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 font-medium">0</td>
              <td className="border border-gray-300 px-4 py-2">You lack the capabilities and can&apos;t reasonably acquire them</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 rounded p-4 my-4">
        <p className="font-medium text-gray-700 mb-2">Questions to consider:</p>
        <ul className="text-gray-600 space-y-1 ml-4 list-disc">
          <li>Do you meet all mandatory (&quot;shall&quot;) requirements?</li>
          <li>Have you delivered similar projects before?</li>
          <li>Is the right team available?</li>
          <li>Are there certifications or clearances you lack?</li>
        </ul>
      </div>

      {/* Dimension 3 */}
      <div className="border-l-4 border-yellow-500 pl-4 my-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">3. Competitive Position</h3>
        <p className="text-gray-600 text-sm mb-4">0–20 points · How do you stack up against likely competitors?</p>
      </div>

      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left w-20">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Criteria</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">20</td>
              <td className="border border-gray-300 px-4 py-2">You have a significant advantage (incumbent, relationship, unique capability)</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 font-medium">15</td>
              <td className="border border-gray-300 px-4 py-2">Competitive, but you have clear differentiators</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">10</td>
              <td className="border border-gray-300 px-4 py-2">Level playing field; outcome uncertain</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 font-medium">5</td>
              <td className="border border-gray-300 px-4 py-2">Competitors have advantages you&apos;ll struggle to overcome</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">0</td>
              <td className="border border-gray-300 px-4 py-2">Wired for a competitor; you&apos;re column fodder</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 rounded p-4 my-4">
        <p className="font-medium text-gray-700 mb-2">Questions to consider:</p>
        <ul className="text-gray-600 space-y-1 ml-4 list-disc">
          <li>Who else is likely bidding?</li>
          <li>Is there an incumbent with an advantage?</li>
          <li>Does the RFP seem written for a specific vendor?</li>
          <li>What&apos;s your unique value proposition here?</li>
        </ul>
      </div>

      {/* Dimension 4 */}
      <div className="border-l-4 border-purple-500 pl-4 my-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">4. Relationship and Intelligence</h3>
        <p className="text-gray-600 text-sm mb-4">0–20 points · How well do you know this buyer and opportunity?</p>
      </div>

      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left w-20">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Criteria</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">20</td>
              <td className="border border-gray-300 px-4 py-2">Existing client with strong relationships to decision-makers</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 font-medium">15</td>
              <td className="border border-gray-300 px-4 py-2">Have met key stakeholders and understand their needs</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">10</td>
              <td className="border border-gray-300 px-4 py-2">Some contacts, limited insight into priorities</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 font-medium">5</td>
              <td className="border border-gray-300 px-4 py-2">No relationship; responding to public RFP cold</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">0</td>
              <td className="border border-gray-300 px-4 py-2">Unknown organization with no way to gather intelligence</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 rounded p-4 my-4">
        <p className="font-medium text-gray-700 mb-2">Questions to consider:</p>
        <ul className="text-gray-600 space-y-1 ml-4 list-disc">
          <li>Have you worked with this organization before?</li>
          <li>Do you know the actual decision-makers?</li>
          <li>Did you help shape this requirement?</li>
          <li>Do you understand their concerns and priorities?</li>
        </ul>
      </div>

      {/* Dimension 5 */}
      <div className="border-l-4 border-red-500 pl-4 my-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">5. Commercial Viability</h3>
        <p className="text-gray-600 text-sm mb-4">0–15 points · Does the business case make sense?</p>
      </div>

      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left w-20">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Criteria</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">15</td>
              <td className="border border-gray-300 px-4 py-2">Strong margins, reasonable terms, funded project</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 font-medium">10</td>
              <td className="border border-gray-300 px-4 py-2">Acceptable margins, standard terms</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2 font-medium">5</td>
              <td className="border border-gray-300 px-4 py-2">Tight margins, but strategic value justifies it</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 font-medium">0</td>
              <td className="border border-gray-300 px-4 py-2">Unfavorable terms, unclear budget, or unsustainable margins</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 rounded p-4 my-4">
        <p className="font-medium text-gray-700 mb-2">Questions to consider:</p>
        <ul className="text-gray-600 space-y-1 ml-4 list-disc">
          <li>Can you deliver at a healthy margin?</li>
          <li>Are the contract terms acceptable?</li>
          <li>Is the project actually funded?</li>
          <li>What&apos;s the revenue relative to pursuit costs?</li>
        </ul>
      </div>

      <h2>Interpreting Your Score</h2>

      <p>Add up scores across all five dimensions. The maximum is 100 points.</p>

      <div className="bg-slate-800 text-white p-5 rounded-lg my-6 font-mono text-sm">
        <p>Total = Strategic Fit + Capability Match + Competitive Position + Relationship + Commercial</p>
      </div>

      <div className="overflow-x-auto my-6">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Recommendation</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-green-50">
              <td className="border border-gray-300 px-4 py-2 font-semibold text-green-700">75–100</td>
              <td className="border border-gray-300 px-4 py-2">Strong GO</td>
              <td className="border border-gray-300 px-4 py-2">Pursue aggressively; allocate top resources</td>
            </tr>
            <tr className="bg-yellow-50">
              <td className="border border-gray-300 px-4 py-2 font-semibold text-yellow-700">50–74</td>
              <td className="border border-gray-300 px-4 py-2">Conditional GO</td>
              <td className="border border-gray-300 px-4 py-2">Proceed with caution; address weak areas</td>
            </tr>
            <tr className="bg-orange-50">
              <td className="border border-gray-300 px-4 py-2 font-semibold text-orange-700">25–49</td>
              <td className="border border-gray-300 px-4 py-2">Likely NO-GO</td>
              <td className="border border-gray-300 px-4 py-2">Only pursue if strategic value overrides score</td>
            </tr>
            <tr className="bg-red-50">
              <td className="border border-gray-300 px-4 py-2 font-semibold text-red-700">0–24</td>
              <td className="border border-gray-300 px-4 py-2">Definite NO-GO</td>
              <td className="border border-gray-300 px-4 py-2">Do not pursue; focus resources elsewhere</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Automatic Disqualifiers</h2>

      <p>
        Some factors should trigger a no-go regardless of overall score:
      </p>

      <div className="grid gap-3 my-6">
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
          <span className="text-red-600 text-lg">✕</span>
          <div>
            <p className="font-medium text-gray-900">Mandatory requirements not met</p>
            <p className="text-sm text-gray-600">If you can&apos;t comply with &quot;shall&quot; requirements, don&apos;t submit.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
          <span className="text-red-600 text-lg">✕</span>
          <div>
            <p className="font-medium text-gray-900">Ethical concerns</p>
            <p className="text-sm text-gray-600">Work that conflicts with company values.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
          <span className="text-red-600 text-lg">✕</span>
          <div>
            <p className="font-medium text-gray-900">Resource conflict</p>
            <p className="text-sm text-gray-600">Would jeopardize delivery on existing commitments.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
          <span className="text-red-600 text-lg">✕</span>
          <div>
            <p className="font-medium text-gray-900">Impossible timeline</p>
            <p className="text-sm text-gray-600">Can&apos;t produce a quality response in the time available.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
          <span className="text-red-600 text-lg">✕</span>
          <div>
            <p className="font-medium text-gray-900">Unacceptable terms</p>
            <p className="text-sm text-gray-600">Contract requires unlimited liability, IP transfer, or similar deal-breakers.</p>
          </div>
        </div>
      </div>

      <h2>When to Stretch</h2>

      <p>
        Sometimes it&apos;s worth pursuing an opportunity even with a lower score:
      </p>

      <div className="grid gap-3 my-6">
        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded">
          <span className="text-green-600 text-lg">✓</span>
          <div>
            <p className="font-medium text-gray-900">Gateway client</p>
            <p className="text-sm text-gray-600">A win opens doors to many similar opportunities.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded">
          <span className="text-green-600 text-lg">✓</span>
          <div>
            <p className="font-medium text-gray-900">Capability building</p>
            <p className="text-sm text-gray-600">The project develops skills you need for your strategy.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded">
          <span className="text-green-600 text-lg">✓</span>
          <div>
            <p className="font-medium text-gray-900">Relationship repair</p>
            <p className="text-sm text-gray-600">A chance to win back a lapsed client.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded">
          <span className="text-green-600 text-lg">✓</span>
          <div>
            <p className="font-medium text-gray-900">Low competition</p>
            <p className="text-sm text-gray-600">Few qualified bidders means higher odds of winning.</p>
          </div>
        </div>
      </div>

      <h2>Who Should Make the Decision</h2>

      <p>
        Go/no-go decisions shouldn&apos;t be made in isolation. Involve the people who can provide different perspectives:
      </p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden my-6">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          <div className="p-4">
            <p className="font-medium text-gray-900">Sales / BD Lead</p>
            <p className="text-sm text-gray-600">Relationship and competitive intelligence</p>
          </div>
          <div className="p-4">
            <p className="font-medium text-gray-900">Delivery Lead</p>
            <p className="text-sm text-gray-600">Capability and resource assessment</p>
          </div>
          <div className="p-4">
            <p className="font-medium text-gray-900">Finance</p>
            <p className="text-sm text-gray-600">Commercial viability check</p>
          </div>
          <div className="p-4">
            <p className="font-medium text-gray-900">Executive Sponsor</p>
            <p className="text-sm text-gray-600">Strategic alignment decision</p>
          </div>
        </div>
      </div>

      <p>
        Document the decision and reasoning. A no-go decision has value too—you&apos;ve freed up resources for better opportunities.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 my-6">
        <p className="font-medium text-blue-900 mb-2">Quick Assessment</p>
        <p className="text-blue-800">
          Use our free <Link href="/tools/go-no-go" className="text-blue-600 hover:underline font-medium">Go/No-Go Decision Tool</Link> to run through this framework interactively and get a recommendation based on your inputs.
        </p>
      </div>

      <h2>Track and Refine</h2>

      <p>
        Over time, compare your go/no-go decisions against outcomes. This data helps refine your framework:
      </p>

      <ul className="list-disc ml-6 my-4 space-y-2">
        <li>What scores correlated with wins?</li>
        <li>Did any no-go decisions turn out to be mistakes?</li>
        <li>Are there patterns in your losses?</li>
      </ul>

      <p>
        Patterns in this data reveal where your scoring needs adjustment and where your organization underestimates or overestimates its capabilities.
      </p>

      <div className="bg-slate-100 border border-slate-200 rounded-lg p-5 mt-8">
        <p className="font-medium text-slate-900 mb-2">Already decided to GO?</p>
        <p className="text-slate-700">
          RFP Matrix helps you respond faster with AI-powered requirement extraction and draft generation. <Link href="/signup" className="text-blue-600 hover:underline font-medium">Start free</Link> and see how much time you save on your next response.
        </p>
      </div>
    </BlogPostLayout>
  );
}
