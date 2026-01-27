import { Metadata } from "next";
import { BlogPostLayout } from "@/components/BlogPostLayout";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PQQ Checklist: Pre-Qualification Questions Made Simple",
  description:
    "Pre-Qualification Questionnaires filter out most bidders before the real evaluation starts. Use this checklist so yours does not end up in the reject pile.",
  keywords: [
    "PQQ",
    "pre-qualification questionnaire",
    "tender pre-qualification",
    "PQQ checklist",
    "bid qualification",
  ],
  openGraph: {
    title: "PQQ Checklist: Pre-Qualification Questions Made Simple",
    description:
      "Pre-Qualification Questionnaires filter out most bidders before the real evaluation starts. Use this checklist so yours does not end up in the reject pile.",
    type: "article",
    publishedTime: "2024-12-16",
  },
};

export default function PqqChecklistPost() {
  return (
    <BlogPostLayout
      title="PQQ Checklist: Pre-Qualification Questions Made Simple"
      description="Pre-Qualification Questionnaires filter out most bidders before the real evaluation starts. Use this checklist so yours does not end up in the reject pile."
      date="2024-12-16"
      readTime="10 min read"
      category="Fundamentals"
    >
      {/* Opening */}
      <p>
        PQQs are the gatekeepers. Fail here and your proposal never gets read.
        The buyer never sees your pricing, your methodology, or your case
        studies. You are out before the race even starts.
      </p>

      <p>
        Yet most teams treat the Pre-Qualification Questionnaire as a
        box-ticking exercise, and it shows. They recycle old answers, skip
        optional fields, attach expired certificates, and then wonder why they
        never make the shortlist.
      </p>

      <p>
        This guide breaks down what a PQQ actually is, walks through the
        standard sections, and gives you a practical checklist to run through
        before you hit submit.
      </p>

      {/* What is a PQQ? */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          What Is a PQQ?
        </h2>

        <p>
          A Pre-Qualification Questionnaire is a screening document. Buyers use
          it to whittle down a large pool of interested suppliers to a shortlist
          of qualified ones. Only those who pass the PQQ stage get invited to
          submit a full tender response (the ITT, or Invitation to Tender).
        </p>

        <p>
          PQQs are standard in UK public sector procurement and common across
          the EU. They also appear in large private sector contracts, especially
          in construction, IT, facilities management, and professional services.
          If you are targeting government work, our guide on{" "}
          <Link href="/blog/winning-public-sector-contracts" className="text-blue-600 hover:underline">
            winning public sector contracts as an SME
          </Link>{" "}
          covers the broader strategy. The format varies, but the intent is
          always the same: prove you are capable, stable, and compliant before
          we invest time evaluating your proposal.
        </p>

        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 my-6">
          <p className="text-amber-900 m-0">
            <span className="font-semibold">Worth knowing:</span> In UK public
            procurement, many contracting authorities now use the standard
            Selection Questionnaire (SQ) published by the Cabinet Office. The
            structure is very similar to a traditional PQQ, and the advice in
            this article applies to both.
          </p>
        </div>
      </div>

      {/* Standard PQQ Sections */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Standard PQQ Sections
        </h2>

        <p>
          Most PQQs follow a predictable structure. Here is what you will
          typically find, along with what evaluators are actually looking for in
          each section.
        </p>

        <div className="space-y-4 my-6">
          <div className="border-l-4 border-[#0d9488] pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              1. Company Information
            </h3>
            <p className="text-gray-600 text-sm m-0">
              Legal name, registered address, company number, VAT registration,
              key contacts. This is admin, but get it wrong and you look
              careless. Make sure details match what appears on Companies House
              or your equivalent register.
            </p>
          </div>

          <div className="border-l-4 border-[#0d9488] pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              2. Financial Standing
            </h3>
            <p className="text-gray-600 text-sm m-0">
              Usually two to three years of audited accounts, turnover figures,
              and sometimes a credit reference. Evaluators want to see that your
              business is financially stable enough to deliver the contract
              without folding halfway through. If your turnover is significantly
              below the contract value, expect questions.
            </p>
          </div>

          <div className="border-l-4 border-[#0d9488] pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">3. Insurance</h3>
            <p className="text-gray-600 text-sm m-0">
              Employers&apos; liability, public liability, professional
              indemnity, and sometimes product liability. They will specify
              minimum cover levels. Your certificates must be current on the
              submission date, not &quot;due for renewal next week.&quot;
            </p>
          </div>

          <div className="border-l-4 border-[#0d9488] pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              4. Health and Safety
            </h3>
            <p className="text-gray-600 text-sm m-0">
              Your H&amp;S policy, accident records, RIDDOR reports, and any
              relevant accreditations (CHAS, SafeContractor, SMAS). Evaluators
              want evidence of a functioning safety management system, not just a
              dusty policy document on a shelf. For construction bids, see our{" "}
              <Link href="/blog/construction-tender-compliance" className="text-blue-600 hover:underline">
                construction tender compliance guide
              </Link>{" "}
              for what you need to have ready.
            </p>
          </div>

          <div className="border-l-4 border-[#0d9488] pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              5. Quality Management
            </h3>
            <p className="text-gray-600 text-sm m-0">
              ISO 9001 certification or equivalent quality procedures. If you
              do not hold formal accreditation, describe your quality management
              processes clearly. Some PQQs will accept &quot;equivalent
              measures&quot; if you explain them well enough.
            </p>
          </div>

          <div className="border-l-4 border-[#0d9488] pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              6. Environmental Policy
            </h3>
            <p className="text-gray-600 text-sm m-0">
              ISO 14001 or your environmental management approach. Increasingly
              scored rather than pass/fail, especially in public sector
              contracts. Carbon reduction targets and sustainability initiatives
              carry weight here.
            </p>
          </div>

          <div className="border-l-4 border-[#0d9488] pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              7. Equal Opportunities and Modern Slavery
            </h3>
            <p className="text-gray-600 text-sm m-0">
              Your equality and diversity policy, plus a Modern Slavery Act
              statement if your turnover exceeds the threshold. These are
              typically pass/fail. Have the policies, make sure they are dated
              and signed, and you will be fine.
            </p>
          </div>

          <div className="border-l-4 border-[#0d9488] pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              8. Technical Capability
            </h3>
            <p className="text-gray-600 text-sm m-0">
              This is where the scoring usually happens. You will be asked to
              demonstrate relevant experience, specialist skills, staff
              qualifications, and capacity to deliver. Be specific. Generic
              statements like &quot;we have extensive experience&quot; score
              poorly compared to &quot;we delivered a similar 12-month contract
              for [client] in 2023 valued at [amount].&quot;
            </p>
          </div>

          <div className="border-l-4 border-[#0d9488] pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              9. References and Case Studies
            </h3>
            <p className="text-gray-600 text-sm m-0">
              Usually two to three references from contracts similar in scope and
              value. Evaluators may actually contact your referees, so pick
              people who will respond promptly and speak positively. Case studies
              should match the contract type as closely as possible.
            </p>
          </div>
        </div>
      </div>

      {/* The Checklist */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          The Pre-Submission Checklist
        </h2>

        <p>
          Run through this list before every PQQ submission. For a more detailed
          approach to tracking every requirement, see our{" "}
          <Link href="/blog/compliance-matrix-guide" className="text-blue-600 hover:underline">
            compliance matrix guide
          </Link>. Print it out, tape it to your monitor, whatever works. It
          takes ten minutes and saves you from the kind of rejection that stings
          because it was entirely avoidable.
        </p>

        <div className="my-8 overflow-hidden rounded-lg border border-gray-200">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold m-0">
              PQQ Submission Checklist
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 m-0">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 w-12">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                    Why It Matters
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    1
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    Every field completed (including optional ones)
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    Blank fields signal laziness. Optional fields are scoring
                    opportunities.
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    2
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    Financial documents are current and cover the required period
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    Out-of-date accounts can be an automatic fail.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    3
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    All insurance certificates are in date on submission day
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    Expired certificates = instant disqualification on many PQQs.
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    4
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    Insurance cover meets minimum levels specified
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    Having insurance is not enough. The amounts must match or
                    exceed what they asked for.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    5
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    Case studies match the contract type, value, and sector
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    A case study about office cleaning will not help you win a
                    construction PQQ.
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    6
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    Word counts and page limits respected
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    Evaluators may stop reading at the word limit. Everything
                    after that is wasted effort.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    7
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    All required attachments uploaded
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    Missing attachments are the most common reason for failed
                    submissions.
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    8
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    Declarations signed by an authorised person
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    Unsigned declarations are treated as incomplete submissions.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    9
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    Named referees contacted in advance and willing to respond
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    A referee who does not reply makes you look bad. Worse, some
                    buyers treat non-response as a failed reference.
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    10
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    File formats match the requirements (PDF, Word, Excel)
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    Submitting a PDF when they asked for Word can prevent the
                    portal from accepting your file.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    11
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    Company details match your official registration exactly
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    Mismatched company names between your PQQ and Companies
                    House raise red flags.
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    12
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    Accreditation certificates are valid and relevant
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    An expired ISO certificate is worse than no certificate. It
                    suggests your system lapsed.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    13
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    Submission deadline confirmed (time zone, portal cutoff)
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    Portals lock at the deadline. There is no grace period and no
                    appeal.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Common Failures */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Common Failures (and How to Avoid Them)
        </h2>

        <p>
          Having reviewed hundreds of PQQ submissions over the years, the same
          mistakes come up again and again. Most of them are preventable with
          five minutes of proofreading.
        </p>

        <div className="space-y-4 my-6">
          <div className="border-l-4 border-red-400 pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              Wrong file format
            </h3>
            <p className="text-gray-600 text-sm m-0">
              The PQQ says submit in Word. You submit a PDF. The procurement
              portal rejects the upload, or the evaluator cannot open it in
              their system. Always check the required format for each attachment.
            </p>
          </div>

          <div className="border-l-4 border-red-400 pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              Missing or unsigned declarations
            </h3>
            <p className="text-gray-600 text-sm m-0">
              The declaration page at the back of the PQQ is not decoration. If
              it needs a wet signature or an electronic signature from a
              director, make sure that person is available before deadline day.
              Do not leave this until the last hour.
            </p>
          </div>

          <div className="border-l-4 border-red-400 pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              Expired insurance certificates
            </h3>
            <p className="text-gray-600 text-sm m-0">
              Your public liability expired two weeks ago and you have not
              chased the renewal. For many buyers, this is an automatic fail
              regardless of how good the rest of your submission looks. Set
              calendar reminders for renewal dates.
            </p>
          </div>

          <div className="border-l-4 border-red-400 pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              Generic case studies
            </h3>
            <p className="text-gray-600 text-sm m-0">
              You are bidding for a hospital cleaning contract but your case
              study describes an office block. Evaluators score relevance. Pick
              case studies that match the sector, scale, and type of work as
              closely as possible. If you do not have an exact match, explain
              how your experience transfers.
            </p>
          </div>

          <div className="border-l-4 border-red-400 pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              Referees who do not respond
            </h3>
            <p className="text-gray-600 text-sm m-0">
              You named a referee. The buyer contacts them. Silence. Now the
              buyer wonders what that says about your working relationships.
              Always phone your referees before submitting. Confirm they are
              happy to be contacted, give them a heads-up on timing, and make
              sure their contact details are correct.
            </p>
          </div>

          <div className="border-l-4 border-red-400 pl-4 py-2">
            <h3 className="font-semibold text-gray-900 mb-1">
              Submitting at the last minute
            </h3>
            <p className="text-gray-600 text-sm m-0">
              Procurement portals crash. Internet connections drop. Files fail
              to upload. Aim to submit at least 24 hours before the deadline.
              If something goes wrong, you still have time to fix it.
            </p>
          </div>
        </div>
      </div>

      {/* Keeping a PQQ Library */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Keeping a PQQ Library
        </h2>

        <p>
          If you bid regularly, you will answer the same questions over and
          over. Company history, financial standing, H&amp;S policy, quality
          accreditations. Writing these from scratch every time is a waste of
          everyone&apos;s time.
        </p>

        <p>
          Build a master PQQ library: a single document (or folder) containing
          pre-written, approved answers for every standard PQQ section. Here is
          how to set one up.
        </p>

        <div className="bg-slate-50 rounded-lg p-5 my-6">
          <h3 className="text-base font-semibold text-slate-800 mb-3">
            What to include in your PQQ library:
          </h3>
          <ul className="space-y-2 text-slate-700">
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">&rarr;</span>
              <span>
                Company boilerplate (registered name, address, company number,
                VAT, SIC codes)
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">&rarr;</span>
              <span>
                Financial summary with latest turnover and profit figures,
                updated after each year-end
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">&rarr;</span>
              <span>
                Insurance schedule showing policy types, cover levels, insurers,
                and expiry dates
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">&rarr;</span>
              <span>
                H&amp;S policy summary with accident statistics for the last
                three years
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">&rarr;</span>
              <span>
                Quality and environmental policy summaries, including
                accreditation numbers and expiry dates
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">&rarr;</span>
              <span>
                A bank of six to ten case studies across different sectors and
                contract types, each in a 300-word and 500-word version
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">&rarr;</span>
              <span>
                A list of approved referees with current contact details, last
                confirmed date, and the contracts they relate to
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-slate-400 mr-2">&rarr;</span>
              <span>
                Scanned copies of all certificates (ISO, CHAS, Constructionline,
                etc.) with renewal dates flagged
              </span>
            </li>
          </ul>
        </div>

        <p>
          Review the library quarterly. Update financial figures after year-end.
          Refresh case studies when you complete new contracts. Check certificate
          expiry dates. A stale library is almost as bad as no library at all.
        </p>

        <p>
          With a well-maintained library, a standard PQQ that used to take two
          days can be completed in half a day. That frees your team to focus on
          tailoring the scored sections rather than retyping your company
          address for the hundredth time.
        </p>
      </div>

      {/* Closing CTA */}
      <div className="my-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          From PQQ to ITT
        </h2>

        <p>
          Passing the PQQ is just the first hurdle. Once you make the shortlist,
          the real work begins with the ITT response. That means tracking
          dozens (sometimes hundreds) of requirements, coordinating input from
          subject matter experts, and making sure nothing falls through the
          cracks.
        </p>

        <p>
          This is where a lot of teams lose control. Requirements get missed.
          Version control breaks down. Deadlines get tight.
        </p>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Track requirements from PQQ through ITT
          </h3>
          <p className="text-gray-700 mb-4">
            <Link
              href="/"
              className="text-[#0d9488] font-medium hover:underline"
            >
              RFP Matrix
            </Link>{" "}
            extracts requirements from tender documents automatically and
            organises them into a structured tracker. You can see at a glance
            what has been answered, what is outstanding, and who is responsible
            for each section.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center text-[#0d9488] font-medium hover:text-[#0f766e]"
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
      </div>
    </BlogPostLayout>
  );
}
