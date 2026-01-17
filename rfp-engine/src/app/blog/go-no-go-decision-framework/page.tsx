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
        A new RFP lands in your inbox. It&apos;s a big contract - exactly the kind of opportunity you&apos;ve been looking for. But before you mobilize your team for a 3-week sprint, ask yourself: should you even respond?
      </p>

      <p>
        The most successful proposal teams aren&apos;t the ones who respond to everything. They&apos;re the ones who are ruthlessly selective, investing deeply in opportunities they can win while passing on the rest.
      </p>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-6">
        <p className="font-semibold">Try Our Free Tool:</p>
        <p>
          Want to quickly assess an RFP opportunity? Use our <Link href="/tools/go-no-go" className="text-blue-600 hover:underline">Go/No-Go Decision Tool</Link> to get a data-driven recommendation in minutes.
        </p>
      </div>

      <h2>The True Cost of Chasing Every RFP</h2>

      <p>
        Many organizations default to &quot;yes&quot; without calculating the real cost:
      </p>

      <ul>
        <li><strong>Direct labor:</strong> A complex RFP response can consume 200+ person-hours</li>
        <li><strong>Opportunity cost:</strong> Time spent on low-probability bids steals from winnable ones</li>
        <li><strong>Team burnout:</strong> Constant RFP pressure leads to turnover and quality decline</li>
        <li><strong>Reputation risk:</strong> Weak responses can damage your brand with that buyer</li>
      </ul>

      <p>
        The math is simple: if your win rate is 20% and each response costs $15,000 in labor, you&apos;re spending $75,000 to win each contract. Improving your selectivity can dramatically improve this ratio.
      </p>

      <h2>The Go/No-Go Framework</h2>

      <p>
        This framework evaluates opportunities across five dimensions. Score each honestly, then make a data-driven decision.
      </p>

      <h3>1. Strategic Fit (0-20 points)</h3>

      <p>Does this opportunity align with where you want to go as a company?</p>

      <div className="overflow-x-auto my-6">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Criteria</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">20</td>
              <td className="border border-gray-300 px-4 py-2">Perfect fit with strategic goals, target market, and growth plans</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">15</td>
              <td className="border border-gray-300 px-4 py-2">Good alignment, opens doors to desired market segment</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">10</td>
              <td className="border border-gray-300 px-4 py-2">Neutral - not strategic, but not a distraction either</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">5</td>
              <td className="border border-gray-300 px-4 py-2">Marginal fit, would take resources from strategic priorities</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">0</td>
              <td className="border border-gray-300 px-4 py-2">Misaligned with strategy, wrong market or capability area</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p><strong>Questions to ask:</strong></p>
      <ul>
        <li>Is this client in a market we want to grow in?</li>
        <li>Will this work strengthen capabilities we&apos;re building?</li>
        <li>Could this become a reference account for future sales?</li>
      </ul>

      <h3>2. Capability Match (0-25 points)</h3>

      <p>Can you actually deliver what they&apos;re asking for?</p>

      <div className="overflow-x-auto my-6">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Criteria</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">25</td>
              <td className="border border-gray-300 px-4 py-2">We&apos;ve done this exact thing multiple times successfully</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">20</td>
              <td className="border border-gray-300 px-4 py-2">Strong experience with minor gaps easily filled</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">15</td>
              <td className="border border-gray-300 px-4 py-2">Solid foundation, some areas require new hires or partners</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">10</td>
              <td className="border border-gray-300 px-4 py-2">Moderate gaps, would stretch current capabilities</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">5</td>
              <td className="border border-gray-300 px-4 py-2">Significant gaps, risky to deliver successfully</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">0</td>
              <td className="border border-gray-300 px-4 py-2">We don&apos;t have the capabilities and can&apos;t reasonably acquire them</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p><strong>Questions to ask:</strong></p>
      <ul>
        <li>Do we meet all mandatory (&quot;shall&quot;) requirements?</li>
        <li>Have we delivered similar projects before?</li>
        <li>Do we have the right team available?</li>
        <li>Are there certifications or clearances we lack?</li>
      </ul>

      <h3>3. Competitive Position (0-20 points)</h3>

      <p>How do you stack up against likely competitors?</p>

      <div className="overflow-x-auto my-6">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Criteria</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">20</td>
              <td className="border border-gray-300 px-4 py-2">We have a significant advantage (incumbent, relationship, unique capability)</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">15</td>
              <td className="border border-gray-300 px-4 py-2">Competitive but we have clear differentiators</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">10</td>
              <td className="border border-gray-300 px-4 py-2">Level playing field, outcome uncertain</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">5</td>
              <td className="border border-gray-300 px-4 py-2">Competitors have advantages we&apos;ll struggle to overcome</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">0</td>
              <td className="border border-gray-300 px-4 py-2">Wired for a competitor, we&apos;re column fodder</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p><strong>Questions to ask:</strong></p>
      <ul>
        <li>Who else is likely bidding?</li>
        <li>Is there an incumbent with an advantage?</li>
        <li>Does the RFP seem written for a specific vendor?</li>
        <li>What&apos;s our unique value proposition here?</li>
      </ul>

      <h3>4. Relationship and Intelligence (0-20 points)</h3>

      <p>How well do you know this buyer and opportunity?</p>

      <div className="overflow-x-auto my-6">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Criteria</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">20</td>
              <td className="border border-gray-300 px-4 py-2">Existing client, strong relationships with decision-makers</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">15</td>
              <td className="border border-gray-300 px-4 py-2">Have met key stakeholders, understand their needs</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">10</td>
              <td className="border border-gray-300 px-4 py-2">Some contacts, limited insight into priorities</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">5</td>
              <td className="border border-gray-300 px-4 py-2">No relationship, responding to public RFP cold</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">0</td>
              <td className="border border-gray-300 px-4 py-2">Unknown organization, no way to gather intelligence</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p><strong>Questions to ask:</strong></p>
      <ul>
        <li>Have we worked with this organization before?</li>
        <li>Do we know the real decision-makers?</li>
        <li>Did we help shape this requirement?</li>
        <li>Do we understand their hot buttons and concerns?</li>
      </ul>

      <h3>5. Commercial Viability (0-15 points)</h3>

      <p>Does the business case make sense?</p>

      <div className="overflow-x-auto my-6">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Criteria</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">15</td>
              <td className="border border-gray-300 px-4 py-2">Strong margins, reasonable terms, funded project</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">10</td>
              <td className="border border-gray-300 px-4 py-2">Acceptable margins, standard terms</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">5</td>
              <td className="border border-gray-300 px-4 py-2">Tight margins but strategic value justifies it</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">0</td>
              <td className="border border-gray-300 px-4 py-2">Unfavorable terms, budget unclear, or margin unsustainable</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p><strong>Questions to ask:</strong></p>
      <ul>
        <li>Can we deliver at a healthy margin?</li>
        <li>Are the contract terms acceptable?</li>
        <li>Is the project actually funded?</li>
        <li>What&apos;s the revenue vs. cost of pursuing?</li>
      </ul>

      <h2>Calculating Your Score</h2>

      <p>Add up your scores across all five dimensions:</p>

      <div className="bg-gray-100 p-6 rounded-lg my-6">
        <p className="font-mono">
          Total = Strategic Fit + Capability Match + Competitive Position + Relationship + Commercial
        </p>
        <p className="font-mono mt-2">
          Maximum possible: 100 points
        </p>
      </div>

      <h3>Score Interpretation</h3>

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
              <td className="border border-gray-300 px-4 py-2 font-semibold text-green-700">75-100</td>
              <td className="border border-gray-300 px-4 py-2">Strong GO</td>
              <td className="border border-gray-300 px-4 py-2">Pursue aggressively, allocate top resources</td>
            </tr>
            <tr className="bg-yellow-50">
              <td className="border border-gray-300 px-4 py-2 font-semibold text-yellow-700">50-74</td>
              <td className="border border-gray-300 px-4 py-2">Conditional GO</td>
              <td className="border border-gray-300 px-4 py-2">Proceed with caution, address weak areas</td>
            </tr>
            <tr className="bg-orange-50">
              <td className="border border-gray-300 px-4 py-2 font-semibold text-orange-700">25-49</td>
              <td className="border border-gray-300 px-4 py-2">Likely NO-GO</td>
              <td className="border border-gray-300 px-4 py-2">Only pursue if strategic value overrides score</td>
            </tr>
            <tr className="bg-red-50">
              <td className="border border-gray-300 px-4 py-2 font-semibold text-red-700">0-24</td>
              <td className="border border-gray-300 px-4 py-2">Definite NO-GO</td>
              <td className="border border-gray-300 px-4 py-2">Do not pursue, focus resources elsewhere</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Red Flags: Automatic No-Go Triggers</h2>

      <p>Some factors should trigger an automatic no-go regardless of overall score:</p>

      <ul>
        <li><strong>Mandatory requirements not met:</strong> If you can&apos;t comply with &quot;shall&quot; requirements, don&apos;t waste time</li>
        <li><strong>Ethical concerns:</strong> Work that conflicts with company values</li>
        <li><strong>Resource conflict:</strong> Would jeopardize delivery on existing commitments</li>
        <li><strong>Impossible timeline:</strong> Can&apos;t produce quality response in time available</li>
        <li><strong>Unfavorable terms:</strong> Contract terms you can&apos;t accept (unlimited liability, IP transfer, etc.)</li>
      </ul>

      <h2>Green Flags: When to Stretch</h2>

      <p>Sometimes it&apos;s worth pursuing an opportunity even with a lower score:</p>

      <ul>
        <li><strong>Gateway client:</strong> Win opens doors to many similar opportunities</li>
        <li><strong>Capability building:</strong> Project develops skills you need for strategy</li>
        <li><strong>Relationship repair:</strong> Chance to win back a lapsed client</li>
        <li><strong>Low competition:</strong> Few qualified bidders means higher odds</li>
      </ul>

      <h2>Making the Decision</h2>

      <p>
        Don&apos;t make go/no-go decisions alone. Involve:
      </p>

      <ul>
        <li><strong>Sales/BD lead:</strong> Relationship and competitive intelligence</li>
        <li><strong>Delivery lead:</strong> Capability and resource assessment</li>
        <li><strong>Finance:</strong> Commercial viability check</li>
        <li><strong>Executive sponsor:</strong> Strategic alignment decision</li>
      </ul>

      <p>
        Document the decision and reasoning. If you decide no-go, that&apos;s valuable too - you&apos;ve freed up resources for better opportunities.
      </p>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-6">
        <p className="font-semibold">Quick Assessment:</p>
        <p>
          Use our free <Link href="/tools/go-no-go" className="text-blue-600 hover:underline">Go/No-Go Decision Tool</Link> to run through this framework interactively and get a recommendation based on your inputs.
        </p>
      </div>

      <h2>Tracking and Improving</h2>

      <p>
        Over time, track your go/no-go decisions against outcomes:
      </p>

      <ul>
        <li>What scores correlated with wins?</li>
        <li>Did you pursue any no-go decisions that succeeded?</li>
        <li>Are there patterns in your losses?</li>
      </ul>

      <p>
        This data helps refine your framework and improve future decision-making.
      </p>

      <div className="bg-gray-100 p-6 rounded-lg mt-8">
        <h3 className="text-lg font-semibold mb-2">Already decided to GO?</h3>
        <p className="text-gray-700">
          RFP Matrix helps you respond faster with AI-powered requirement extraction and draft generation. <Link href="/signup" className="text-blue-600 hover:underline">Start free</Link> and see how much time you save on your next response.
        </p>
      </div>
    </BlogPostLayout>
  );
}
