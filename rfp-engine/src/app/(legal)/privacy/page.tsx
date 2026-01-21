import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - RFP Matrix",
  description: "Privacy Policy for RFP Matrix - Learn how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "January 2026";
  const policyVersion = "1.0";

  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-gray-600">
        Last updated: {lastUpdated} | Version {policyVersion}
      </p>

      <section>
        <h2>1. Introduction</h2>
        <p>
          RFP Matrix (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, disclose, and safeguard your information
          when you use our RFP (Request for Proposal) management platform.
        </p>
        <p>
          We comply with the General Data Protection Regulation (GDPR), the California Consumer
          Privacy Act (CCPA), and other applicable data protection laws.
        </p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>

        <h3>2.1 Account Information</h3>
        <ul>
          <li>Email address</li>
          <li>Name (optional)</li>
          <li>Password (stored as a secure hash)</li>
          <li>Account creation date</li>
        </ul>

        <h3>2.2 RFP Documents</h3>
        <p>When you upload RFP documents, we collect and process:</p>
        <ul>
          <li>Document content (PDF or Word files)</li>
          <li>Extracted text from documents</li>
          <li>AI-extracted requirements</li>
          <li>Your draft responses and internal notes</li>
          <li>Project names and company names you specify</li>
        </ul>

        <h3>2.3 Usage Data</h3>
        <ul>
          <li>IP addresses</li>
          <li>Browser type and version</li>
          <li>Pages visited and features used</li>
          <li>Date and time of access</li>
          <li>Actions taken within the platform</li>
        </ul>

        <h3>2.4 Payment Information</h3>
        <p>
          If you subscribe to a paid plan, payment processing is handled by Stripe.
          We do not store your full credit card number. We receive only:
        </p>
        <ul>
          <li>Last four digits of your card</li>
          <li>Card brand (Visa, Mastercard, etc.)</li>
          <li>Billing address</li>
          <li>Stripe customer ID</li>
        </ul>
      </section>

      <section>
        <h2>3. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide and maintain the RFP Matrix service</li>
          <li>Process your RFP documents and extract requirements</li>
          <li>Generate AI-powered draft responses</li>
          <li>Process payments and manage subscriptions</li>
          <li>Send service-related communications</li>
          <li>Improve and optimize our service</li>
          <li>Detect and prevent fraud or abuse</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section>
        <h2>4. AI Processing</h2>
        <p>
          We use OpenAI&apos;s API to analyze your RFP documents and generate draft responses.
          When you upload a document:
        </p>
        <ul>
          <li>Document text is sent to OpenAI for processing</li>
          <li>OpenAI may retain data for up to 30 days for abuse monitoring</li>
          <li>OpenAI does not train their models on data sent via their API</li>
          <li>We do not share your personal account information with OpenAI</li>
        </ul>
        <p>
          For more information, see{" "}
          <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer">
            OpenAI&apos;s Privacy Policy
          </a>.
        </p>
      </section>

      <section>
        <h2>5. Data Sharing and Third Parties</h2>
        <p>We share your data with the following service providers:</p>

        <h3>5.1 OpenAI</h3>
        <p>Purpose: AI-powered document analysis and response generation</p>

        <h3>5.2 Stripe</h3>
        <p>Purpose: Payment processing</p>

        <h3>5.3 Hosting Provider</h3>
        <p>Purpose: Infrastructure and data storage</p>

        <p className="mt-4">
          We do not sell your personal information to third parties.
          We do not share your data with advertisers.
        </p>
      </section>

      <section>
        <h2>6. Data Retention</h2>
        <ul>
          <li>
            <strong>Account data:</strong> Retained until you delete your account
          </li>
          <li>
            <strong>Projects and requirements:</strong> Retained until you delete them or your account
          </li>
          <li>
            <strong>Audit logs:</strong> Retained for 2 years for compliance purposes
          </li>
          <li>
            <strong>Consent records:</strong> Retained for 7 years to demonstrate compliance
          </li>
        </ul>
        <p>
          After account deletion, we may retain anonymized data for analytics purposes.
        </p>
      </section>

      <section>
        <h2>7. Your Rights Under GDPR</h2>
        <p>If you are in the European Economic Area (EEA) or UK, you have the right to:</p>
        <ul>
          <li>
            <strong>Access:</strong> Request a copy of your personal data (Article 15)
          </li>
          <li>
            <strong>Rectification:</strong> Correct inaccurate data (Article 16)
          </li>
          <li>
            <strong>Erasure:</strong> Request deletion of your data (&quot;right to be forgotten&quot;) (Article 17)
          </li>
          <li>
            <strong>Portability:</strong> Receive your data in a machine-readable format (Article 20)
          </li>
          <li>
            <strong>Object:</strong> Object to processing of your data (Article 21)
          </li>
          <li>
            <strong>Restrict processing:</strong> Request limitation of processing (Article 18)
          </li>
          <li>
            <strong>Withdraw consent:</strong> Withdraw consent at any time (Article 7)
          </li>
        </ul>
        <p>
          To exercise these rights, visit your{" "}
          <a href="/settings">account settings</a> or contact us at the address below.
        </p>
      </section>

      <section>
        <h2>8. Your Rights Under CCPA</h2>
        <p>If you are a California resident, you have the right to:</p>
        <ul>
          <li>Know what personal information we collect</li>
          <li>Know whether your personal information is sold or disclosed</li>
          <li>Say no to the sale of personal information</li>
          <li>Request deletion of your personal information</li>
          <li>Not be discriminated against for exercising your rights</li>
        </ul>
        <p>
          See our <a href="/ccpa">California Privacy Rights</a> page for more details.
        </p>
      </section>

      <section>
        <h2>9. Cookies and Tracking</h2>
        <p>We use cookies and similar technologies for:</p>
        <ul>
          <li>
            <strong>Essential cookies:</strong> Required for authentication and security
          </li>
          <li>
            <strong>Preference cookies:</strong> Remember your settings
          </li>
          <li>
            <strong>Analytics cookies:</strong> Understand how you use our service (with consent)
          </li>
        </ul>
        <p>
          See our <a href="/cookies">Cookie Policy</a> for details and to manage your preferences.
        </p>
      </section>

      <section>
        <h2>10. Data Security</h2>
        <p>We implement industry-standard security measures including:</p>
        <ul>
          <li>Encryption in transit (TLS/HTTPS)</li>
          <li>Encryption at rest for sensitive data</li>
          <li>Secure password hashing (bcrypt)</li>
          <li>Rate limiting and abuse prevention</li>
          <li>Regular security audits</li>
          <li>Access controls and authentication</li>
        </ul>
      </section>

      <section>
        <h2>11. International Transfers</h2>
        <p>
          Your data may be transferred to and processed in countries outside your residence,
          particularly the United States where our primary sub-processors are located.
          We ensure appropriate safeguards are in place as required by GDPR Chapter V.
        </p>

        <h3>11.1 Transfer Mechanisms</h3>
        <ul>
          <li>
            <strong>Standard Contractual Clauses (SCCs):</strong> We use the European
            Commission&apos;s 2021 SCCs (Commission Implementing Decision (EU) 2021/914)
            with all US-based sub-processors
          </li>
          <li>
            <strong>Data Processing Agreements:</strong> Binding contracts ensuring
            GDPR-equivalent protections
          </li>
        </ul>

        <h3>11.2 Sub-processor Locations</h3>
        <table className="w-full border-collapse border border-gray-300 my-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Sub-processor</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Location</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Safeguards</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">OpenAI</td>
              <td className="border border-gray-300 px-4 py-2">United States</td>
              <td className="border border-gray-300 px-4 py-2">SCCs + DPA + Encryption</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Stripe</td>
              <td className="border border-gray-300 px-4 py-2">United States</td>
              <td className="border border-gray-300 px-4 py-2">SCCs + DPA + PCI-DSS</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Vercel</td>
              <td className="border border-gray-300 px-4 py-2">United States / Global</td>
              <td className="border border-gray-300 px-4 py-2">SCCs + DPA + Edge encryption</td>
            </tr>
          </tbody>
        </table>

        <h3>11.3 Supplementary Measures</h3>
        <p>
          Following the Schrems II decision, we implement additional technical and
          organisational measures:
        </p>
        <ul>
          <li>End-to-end encryption for data in transit (TLS 1.2+)</li>
          <li>Encryption at rest for all stored data</li>
          <li>Data minimisation - we only transfer data necessary for each service</li>
          <li>Pseudonymisation where technically feasible</li>
          <li>Regular review of sub-processor security certifications</li>
        </ul>

        <h3>11.4 Transfer Impact Assessments</h3>
        <p>
          We conduct Transfer Impact Assessments (TIAs) for each US sub-processor to
          evaluate the legal framework in the destination country and the effectiveness
          of our supplementary measures. These assessments are reviewed annually and
          are available to enterprise customers upon request.
        </p>

        <p className="mt-4">
          For questions about international transfers or to request TIA summaries,
          contact our DPO at <a href="mailto:dpo@rfpmatrix.com">dpo@rfpmatrix.com</a>.
        </p>
      </section>

      <section>
        <h2>12. Children&apos;s Privacy</h2>
        <p>
          RFP Matrix is not intended for use by individuals under 16 years of age.
          We do not knowingly collect personal information from children.
        </p>
      </section>

      <section>
        <h2>13. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by:
        </p>
        <ul>
          <li>Posting the new policy on this page</li>
          <li>Updating the &quot;Last updated&quot; date</li>
          <li>Sending an email notification for material changes</li>
        </ul>
      </section>

      <section>
        <h2>14. Contact Us</h2>
        <p>
          For privacy-related questions or to exercise your rights, contact us at:
        </p>
        <ul>
          <li>
            <strong>Email:</strong> privacy@rfpmatrix.com
          </li>
          <li>
            <strong>Data Protection Officer:</strong> dpo@rfpmatrix.com
          </li>
        </ul>
        <p>
          If you are in the EU and are not satisfied with our response, you have the right to
          lodge a complaint with your local supervisory authority.
        </p>
      </section>

      <section>
        <h2>15. Legal Basis for Processing (GDPR)</h2>
        <p>We process your data under the following legal bases:</p>
        <ul>
          <li>
            <strong>Contract:</strong> To provide our service to you
          </li>
          <li>
            <strong>Consent:</strong> For marketing communications and analytics cookies
          </li>
          <li>
            <strong>Legitimate interest:</strong> For fraud prevention and service improvement
          </li>
          <li>
            <strong>Legal obligation:</strong> To comply with laws and regulations
          </li>
        </ul>
      </section>
    </>
  );
}
