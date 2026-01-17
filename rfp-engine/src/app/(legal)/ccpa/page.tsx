import { Metadata } from "next";

export const metadata: Metadata = {
  title: "California Privacy Rights (CCPA) - RFP Matrix",
  description: "Your California Privacy Rights under the California Consumer Privacy Act.",
};

export default function CCPAPage() {
  const lastUpdated = "January 2026";

  return (
    <>
      <h1>California Privacy Rights</h1>
      <p className="text-gray-600">Last updated: {lastUpdated}</p>

      <section>
        <h2>Your Rights Under the CCPA</h2>
        <p>
          If you are a California resident, the California Consumer Privacy Act (CCPA) gives
          you specific rights regarding your personal information. This page explains those
          rights and how to exercise them.
        </p>
      </section>

      <section>
        <h2>1. Right to Know</h2>
        <p>You have the right to know:</p>
        <ul>
          <li>What categories of personal information we collect</li>
          <li>The sources from which we collect personal information</li>
          <li>Our business purpose for collecting personal information</li>
          <li>The categories of third parties with whom we share personal information</li>
          <li>The specific pieces of personal information we have collected about you</li>
        </ul>
      </section>

      <section>
        <h2>2. Categories of Personal Information We Collect</h2>
        <table className="w-full border-collapse border border-gray-300 my-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Category</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Examples</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Collected</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Identifiers</td>
              <td className="border border-gray-300 px-4 py-2">Name, email address, IP address</td>
              <td className="border border-gray-300 px-4 py-2">Yes</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Commercial Information</td>
              <td className="border border-gray-300 px-4 py-2">Records of products purchased, payment history</td>
              <td className="border border-gray-300 px-4 py-2">Yes</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Internet Activity</td>
              <td className="border border-gray-300 px-4 py-2">Browsing history on our site, interactions</td>
              <td className="border border-gray-300 px-4 py-2">Yes</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Professional Information</td>
              <td className="border border-gray-300 px-4 py-2">Company name (if provided)</td>
              <td className="border border-gray-300 px-4 py-2">Yes</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Sensitive Personal Information</td>
              <td className="border border-gray-300 px-4 py-2">Account login credentials</td>
              <td className="border border-gray-300 px-4 py-2">Yes</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Biometric Information</td>
              <td className="border border-gray-300 px-4 py-2">Fingerprints, facial recognition</td>
              <td className="border border-gray-300 px-4 py-2">No</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Geolocation Data</td>
              <td className="border border-gray-300 px-4 py-2">Precise location</td>
              <td className="border border-gray-300 px-4 py-2">No</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>3. How We Use Your Information</h2>
        <p>We use personal information for the following business purposes:</p>
        <ul>
          <li>Providing and improving our Service</li>
          <li>Processing transactions</li>
          <li>Communicating with you about your account</li>
          <li>Security and fraud prevention</li>
          <li>Legal compliance</li>
        </ul>
      </section>

      <section>
        <h2>4. Right to Delete</h2>
        <p>
          You have the right to request that we delete any personal information we have
          collected from you, subject to certain exceptions. We may retain information:
        </p>
        <ul>
          <li>To complete a transaction you requested</li>
          <li>For security purposes</li>
          <li>To comply with legal obligations</li>
          <li>For internal uses reasonably aligned with your expectations</li>
        </ul>
      </section>

      <section>
        <h2>5. Right to Opt-Out of Sale</h2>
        <p className="font-semibold">We do not sell your personal information.</p>
        <p>
          Under the CCPA, &quot;sale&quot; means sharing personal information with third parties
          for monetary or other valuable consideration. We do not engage in such activities.
        </p>
        <p>
          However, we provide a &quot;Do Not Sell My Personal Information&quot; mechanism to
          comply with CCPA requirements. You can exercise this right in your{" "}
          <a href="/settings">account settings</a>.
        </p>
      </section>

      <section>
        <h2>6. Right to Non-Discrimination</h2>
        <p>
          We will not discriminate against you for exercising any of your CCPA rights.
          We will not:
        </p>
        <ul>
          <li>Deny you goods or services</li>
          <li>Charge you different prices or rates</li>
          <li>Provide a different level or quality of service</li>
          <li>Suggest you may receive different treatment</li>
        </ul>
      </section>

      <section>
        <h2>7. Authorized Agents</h2>
        <p>
          You may designate an authorized agent to make a request on your behalf.
          The agent must provide proof of authorization. We may verify your identity
          directly before fulfilling the request.
        </p>
      </section>

      <section>
        <h2>8. How to Exercise Your Rights</h2>

        <h3>8.1 Online</h3>
        <p>
          Visit your <a href="/settings">account settings</a> to:
        </p>
        <ul>
          <li>Download your data (Right to Know)</li>
          <li>Delete your account (Right to Delete)</li>
          <li>Opt out of data sale (even though we don&apos;t sell)</li>
        </ul>

        <h3>8.2 By Email</h3>
        <p>
          Send your request to: <strong>privacy@rfpmatrix.com</strong>
        </p>
        <p>Please include:</p>
        <ul>
          <li>Your name and email address</li>
          <li>A description of the right you wish to exercise</li>
          <li>Proof of California residency</li>
        </ul>

        <h3>8.3 Verification</h3>
        <p>
          We will verify your identity before fulfilling your request. We may ask you to:
        </p>
        <ul>
          <li>Confirm your email address</li>
          <li>Log into your account</li>
          <li>Provide additional identifying information</li>
        </ul>
      </section>

      <section>
        <h2>9. Response Timing</h2>
        <p>
          We will respond to your request within 45 days. If we need more time (up to
          an additional 45 days), we will notify you of the reason and extension period.
        </p>
      </section>

      <section>
        <h2>10. Information for California Residents Under 16</h2>
        <p>
          We do not knowingly collect personal information from individuals under 16.
          If you are under 16, please do not use our Service. If we learn we have
          collected information from someone under 16, we will delete it.
        </p>
      </section>

      <section>
        <h2>11. Financial Incentives</h2>
        <p>
          We do not offer financial incentives for the collection of personal information.
        </p>
      </section>

      <section>
        <h2>12. Contact for Questions</h2>
        <p>For questions about your California privacy rights:</p>
        <ul>
          <li>
            <strong>Email:</strong> privacy@rfpmatrix.com
          </li>
        </ul>
      </section>

      <section>
        <h2>13. Updates</h2>
        <p>
          We will update this notice as required by law and when our practices change.
          Check this page periodically for updates.
        </p>
      </section>
    </>
  );
}
