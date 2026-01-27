import { Metadata } from "next";
import { BlogPostLayout } from "@/components/BlogPostLayout";
import Link from "next/link";

export const metadata: Metadata = {
  title: "7 RFP Mistakes That Cost You the Contract",
  description:
    "You wrote a solid proposal and still lost. Odds are, one of these seven mistakes buried your score before the evaluator finished reading.",
  keywords: [
    "RFP mistakes",
    "bid submission errors",
    "proposal mistakes",
    "why bids fail",
    "tender submission tips",
  ],
  openGraph: {
    title: "7 RFP Mistakes That Cost You the Contract",
    description:
      "You wrote a solid proposal and still lost. Odds are, one of these seven mistakes buried your score before the evaluator finished reading.",
    type: "article",
    publishedTime: "2025-02-19",
  },
};

export default function CommonRfpMistakesPost() {
  return (
    <BlogPostLayout
      title="7 RFP Mistakes That Cost You the Contract"
      description="You wrote a solid proposal and still lost. Odds are, one of these seven mistakes buried your score before the evaluator finished reading."
      date="2025-02-19"
      readTime="8 min read"
      category="Strategy"
    >
      {/* Opening */}
      <p>
        Nobody calls to tell you why you lost. The rejection email says
        &quot;another bidder more closely met our requirements&quot; and
        that&apos;s it. No feedback. No score breakdown. No hint about what
        went wrong.
      </p>

      <p>
        But after reviewing hundreds of post-award debriefs, the same
        mistakes keep showing up. Not bad pricing. Not weak technical
        skills. Preventable errors that quietly tank your score before the
        evaluator finishes reading.
      </p>

      <p>
        Here are the seven that come up the most, and what to do about each
        one.
      </p>

      {/* Mistake 1 */}
      <div className="border-l-4 border-red-500 pl-4 my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          1. Not Answering the Question Asked
        </h2>
        <p className="text-gray-500 text-sm mb-0">
          The most common mistake, and the most damaging.
        </p>
      </div>

      <p>
        Evaluators score what you wrote against specific criteria. They
        have a rubric. They are looking for particular words, evidence, and
        structure. If the RFP asked for your approach to quality management
        and you wrote three paragraphs about your ISO 9001 certification,
        you missed the point.
      </p>

      <p>
        They wanted your <em>process</em>. How do you catch defects? What
        happens when something fails inspection? Who reviews deliverables
        before they ship? Your certificate tells them you passed an audit
        once. It says nothing about how you actually run quality on their
        project.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-5 my-6">
        <p className="font-medium text-gray-900 mb-2">How to fix this</p>
        <p className="text-gray-700 mb-0">
          Read each question twice. Underline exactly what they&apos;re
          asking. Write your response so that a stranger could read it and
          point to the specific part that answers the question. If your
          response could apply to any RFP without changes, it&apos;s too
          generic.
        </p>
      </div>

      {/* Mistake 2 */}
      <div className="border-l-4 border-red-500 pl-4 my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          2. Copy-Pasting from Your Last Bid
        </h2>
        <p className="text-gray-500 text-sm mb-0">
          Evaluators can always tell.
        </p>
      </div>

      <p>
        Reusing content is fine. Copy-pasting without tailoring is not.
        The client name is wrong. The project description doesn&apos;t
        match. The scope references services you aren&apos;t even bidding
        for. One paragraph talks about a 12-month delivery when this
        contract is for 6 months.
      </p>

      <p>
        Evaluators read dozens of proposals for each RFP. They develop a
        sharp eye for boilerplate. When they spot recycled text, it signals
        that you didn&apos;t care enough to write a real response. That
        impression colors how they score everything else.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-5 my-6">
        <p className="font-medium text-gray-900 mb-2">How to fix this</p>
        <p className="text-gray-700 mb-0">
          Build a content library, not a copy-paste document. Store strong
          paragraphs by topic, then rewrite them for each bid. Do a
          final search for the previous client&apos;s name, project
          references, and dates. Better yet, have someone who did not write
          the proposal do that search.
        </p>
      </div>

      {/* Mistake 3 */}
      <div className="border-l-4 border-red-500 pl-4 my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          3. Missing Mandatory Requirements
        </h2>
        <p className="text-gray-500 text-sm mb-0">
          One missed &quot;shall&quot; and you&apos;re non-compliant.
        </p>
      </div>

      <p>
        A 200-page RFP can contain hundreds of requirements scattered
        across multiple sections, appendices, and amendment documents. Miss
        a single mandatory &quot;shall&quot; statement and your entire
        submission can be flagged as non-compliant. In public sector
        procurement, that often means automatic disqualification. No
        second chances.
      </p>

      <p>
        The problem is volume. Requirements hide in footnotes, in
        appendix tables, in amendment documents posted a week before the
        deadline. Manual extraction is slow and error-prone, especially
        when your team is already stretched thin.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 my-6">
        <p className="font-medium text-blue-900 mb-2">
          This is where requirement extraction tools pay for themselves
        </p>
        <p className="text-blue-800 mb-0">
          <Link href="/" className="text-blue-600 hover:underline font-medium">
            RFP Matrix
          </Link>{" "}
          pulls every requirement out of RFP documents automatically,
          categorized by type and obligation level. What takes a person
          8 hours of careful reading takes the tool a few minutes. One
          caught requirement can be the difference between compliant and
          disqualified.
        </p>
      </div>

      {/* Mistake 4 */}
      <div className="border-l-4 border-red-500 pl-4 my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          4. Vague Commitments
        </h2>
        <p className="text-gray-500 text-sm mb-0">
          Soft language gets soft scores.
        </p>
      </div>

      <p>
        Compare these two statements:
      </p>

      <div className="space-y-3 my-6">
        <div className="bg-red-50 rounded-lg p-4">
          <span className="text-sm font-medium text-red-800">Weak:</span>
          <p className="text-sm text-red-700 m-0 mt-1">
            &quot;We will endeavour to deliver on time and will aim to
            provide regular project updates.&quot;
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <span className="text-sm font-medium text-green-800">
            Strong:
          </span>
          <p className="text-sm text-green-700 m-0 mt-1">
            &quot;We will complete Phase 1 by Week 6. The project manager
            will issue weekly progress reports every Friday by 5 PM,
            covering milestones completed, risks identified, and next
            week&apos;s priorities.&quot;
          </p>
        </div>
      </div>

      <p>
        Evaluators are trained to notice hedging. Words like
        &quot;endeavour,&quot; &quot;aim to,&quot; &quot;where possible,&quot;
        and &quot;as appropriate&quot; are red flags. They tell the evaluator
        you are not actually committing to anything. The bidder who makes
        concrete promises with dates, frequencies, and deliverables will
        score higher every time.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-5 my-6">
        <p className="font-medium text-gray-900 mb-2">How to fix this</p>
        <p className="text-gray-700 mb-0">
          Search your draft for weasel words: &quot;endeavour,&quot;
          &quot;aim,&quot; &quot;strive,&quot; &quot;where feasible,&quot;
          &quot;as needed.&quot; Replace each one with a specific commitment.
          If you genuinely cannot commit, explain why and offer a
          conditional commitment with a clear trigger.
        </p>
      </div>

      {/* Mistake 5 */}
      <div className="border-l-4 border-red-500 pl-4 my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          5. Ignoring the Evaluation Criteria Weighting
        </h2>
        <p className="text-gray-500 text-sm mb-0">
          You spent your effort in the wrong place.
        </p>
      </div>

      <p>
        Most RFPs publish their evaluation criteria. Some even publish the
        weightings. If quality is weighted at 70% and price at 30%,
        spending 80% of your effort sharpening the price is backwards.
        You are optimizing for the smaller part of the score while
        underinvesting in the part that matters most.
      </p>

      <p>
        This mistake is more common than you would think. Teams default to
        what they know. If your BD lead is a numbers person, the pricing
        section will be polished while the technical response gets a
        first-draft treatment. That&apos;s a structural disadvantage.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-5 my-6">
        <p className="font-medium text-gray-900 mb-2">How to fix this</p>
        <p className="text-gray-700 mb-0">
          Before you write a single word, map your effort to the
          evaluation weightings. If quality is 70%, then 70% of your team&apos;s
          time and your strongest writers should be on the quality sections.
          Allocate page counts proportionally too. A 2-page quality section
          and a 10-page pricing breakdown sends the wrong signal.
        </p>
      </div>

      {/* Mistake 6 */}
      <div className="border-l-4 border-red-500 pl-4 my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          6. Submitting at the Last Minute
        </h2>
        <p className="text-gray-500 text-sm mb-0">
          You are gambling with the contract.
        </p>
      </div>

      <p>
        Submission portals crash. File size limits reject your upload.
        The system requires a format you didn&apos;t test. Your PDF has a
        corrupted font. The portal clock is in a different timezone.
        Your internet connection drops during the upload.
      </p>

      <p>
        Teams that submit within the final hour are betting that nothing
        will go wrong. That bet loses more often than people admit. And
        when it does lose, the outcome is binary: you are either on time
        or you are disqualified. There is no partial credit.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-5 my-6">
        <p className="font-medium text-gray-900 mb-2">How to fix this</p>
        <p className="text-gray-700 mb-0">
          Set an internal deadline 24 hours before the real one. Do a test
          upload to the portal at least 48 hours early to check file sizes,
          formats, and portal behavior. If you are submitting via email,
          send a test to confirm the mailbox accepts attachments of your
          file size. Keep the final day for last-minute reviews, not for
          first-time portal fights.
        </p>
      </div>

      {/* Mistake 7 */}
      <div className="border-l-4 border-red-500 pl-4 my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          7. No Executive Summary (or a Bad One)
        </h2>
        <p className="text-gray-500 text-sm mb-0">
          The first thing they read sets the tone for everything after.
        </p>
      </div>

      <p>
        The executive summary is the single most-read section of any
        proposal. Senior evaluators and decision-makers often read only
        this section before the shortlisting discussion. If it does not
        tell them why you are the right choice within about 500 words,
        they start the detailed evaluation with a neutral or negative
        impression. That impression is hard to reverse.
      </p>

      <p>
        A bad executive summary reads like a company brochure. It talks
        about your history, your values, your headquarters. None of that
        answers the buyer&apos;s real question: &quot;Why should we pick
        you for this specific project?&quot;
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-5 my-6">
        <p className="font-medium text-gray-900 mb-2">How to fix this</p>
        <p className="text-gray-700 mb-3">
          Write the executive summary last, after the entire proposal is
          done. Structure it around three things:
        </p>
        <div className="space-y-2">
          <div className="flex items-start">
            <span className="bg-gray-200 text-gray-800 text-sm font-medium px-2 py-1 rounded mr-3 flex-shrink-0">
              1
            </span>
            <span className="text-gray-700">
              You understand their problem (reflect their language back to
              them).
            </span>
          </div>
          <div className="flex items-start">
            <span className="bg-gray-200 text-gray-800 text-sm font-medium px-2 py-1 rounded mr-3 flex-shrink-0">
              2
            </span>
            <span className="text-gray-700">
              Here is how you will solve it (your approach, in plain
              language).
            </span>
          </div>
          <div className="flex items-start">
            <span className="bg-gray-200 text-gray-800 text-sm font-medium px-2 py-1 rounded mr-3 flex-shrink-0">
              3
            </span>
            <span className="text-gray-700">
              Here is why you are the right team (proof, not claims).
            </span>
          </div>
        </div>
      </div>

      {/* Self-audit checklist */}
      <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">
        Pre-Submission Self-Audit Checklist
      </h2>

      <p>
        Before you hit submit on your next bid, run through this list.
        Every &quot;no&quot; is a score leak.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200 my-6">
        <div className="p-4 flex items-start gap-3">
          <span className="text-gray-400 text-lg flex-shrink-0">&#9744;</span>
          <p className="text-gray-900 m-0">
            Every response directly answers the specific question asked,
            not a related question.
          </p>
        </div>
        <div className="p-4 flex items-start gap-3">
          <span className="text-gray-400 text-lg flex-shrink-0">&#9744;</span>
          <p className="text-gray-900 m-0">
            The correct client name appears everywhere. No leftover
            references to previous bids.
          </p>
        </div>
        <div className="p-4 flex items-start gap-3">
          <span className="text-gray-400 text-lg flex-shrink-0">&#9744;</span>
          <p className="text-gray-900 m-0">
            Every mandatory (&quot;shall&quot;) requirement has a clear,
            traceable response.
          </p>
        </div>
        <div className="p-4 flex items-start gap-3">
          <span className="text-gray-400 text-lg flex-shrink-0">&#9744;</span>
          <p className="text-gray-900 m-0">
            No weasel words. Commitments include dates, frequencies, or
            measurable targets.
          </p>
        </div>
        <div className="p-4 flex items-start gap-3">
          <span className="text-gray-400 text-lg flex-shrink-0">&#9744;</span>
          <p className="text-gray-900 m-0">
            Effort allocation matches the evaluation criteria weighting.
          </p>
        </div>
        <div className="p-4 flex items-start gap-3">
          <span className="text-gray-400 text-lg flex-shrink-0">&#9744;</span>
          <p className="text-gray-900 m-0">
            Submission is planned at least 24 hours before the deadline,
            with a test upload already completed.
          </p>
        </div>
        <div className="p-4 flex items-start gap-3">
          <span className="text-gray-400 text-lg flex-shrink-0">&#9744;</span>
          <p className="text-gray-900 m-0">
            The executive summary makes the case for your selection in
            500 words or fewer, focused on this project.
          </p>
        </div>
      </div>

      {/* Closing */}
      <p>
        None of these mistakes require more talent to fix. They require
        more discipline. The teams that win consistently are not always the
        most qualified bidders. They are the ones who eliminate unforced
        errors and make it easy for evaluators to give them high scores.
      </p>

      <p>
        If you want to go deeper on compliance tracking, read our guide on{" "}
        <Link
          href="/blog/how-to-write-winning-rfp-response"
          className="text-blue-600 hover:underline font-medium"
        >
          how to write a winning RFP response
        </Link>
        , which covers building a compliance matrix and structuring each
        section for maximum score.
      </p>

      {/* Final CTA */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mt-10">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Stop losing bids to preventable errors
        </h3>
        <p className="text-gray-700 mb-4">
          RFP Matrix extracts every requirement from your RFP documents
          automatically, so nothing gets missed. Your team focuses on
          writing strong answers instead of hunting through 200-page
          documents.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center text-blue-600 font-medium hover:text-blue-700"
        >
          Get started
          <svg
            className="w-4 h-4 ml-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
    </BlogPostLayout>
  );
}
