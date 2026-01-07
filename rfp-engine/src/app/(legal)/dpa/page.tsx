import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Processing Agreement - RFP Engine",
  description: "Data Processing Agreement (DPA) for enterprise customers.",
};

export default function DPAPage() {
  const lastUpdated = "January 2026";
  const dpaVersion = "1.0";

  return (
    <>
      <h1>Data Processing Agreement</h1>
      <p className="text-gray-600">
        Last updated: {lastUpdated} | Version {dpaVersion}
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-6">
        <p className="text-blue-800">
          <strong>For Enterprise Customers:</strong> This Data Processing Agreement (DPA)
          governs the processing of personal data when you use RFP Engine as a business customer.
          To execute this DPA, please contact us at <strong>enterprise@rfpengine.com</strong>.
        </p>
      </div>

      <section>
        <h2>1. Definitions</h2>
        <ul>
          <li>
            <strong>&quot;Controller&quot;</strong> means the entity that determines the purposes and
            means of processing Personal Data (typically you, the customer).
          </li>
          <li>
            <strong>&quot;Processor&quot;</strong> means the entity that processes Personal Data on
            behalf of the Controller (RFP Engine).
          </li>
          <li>
            <strong>&quot;Personal Data&quot;</strong> means any information relating to an identified
            or identifiable natural person.
          </li>
          <li>
            <strong>&quot;Sub-processor&quot;</strong> means any third party engaged by the Processor
            to process Personal Data.
          </li>
          <li>
            <strong>&quot;Data Subject&quot;</strong> means the individual whose Personal Data is
            being processed.
          </li>
          <li>
            <strong>&quot;GDPR&quot;</strong> means the General Data Protection Regulation (EU) 2016/679.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Scope and Purpose</h2>
        <p>
          This DPA applies to the processing of Personal Data by RFP Engine on behalf of the
          Customer in connection with the provision of the Service.
        </p>
        <h3>2.1 Subject Matter</h3>
        <p>
          The subject matter of processing is the provision of RFP management services,
          including document parsing, AI-powered requirement extraction, and response generation.
        </p>
        <h3>2.2 Duration</h3>
        <p>
          Processing will continue for the duration of the Service agreement plus any
          legally required retention period.
        </p>
        <h3>2.3 Nature and Purpose</h3>
        <p>Processing activities include:</p>
        <ul>
          <li>Storage of uploaded RFP documents</li>
          <li>Text extraction and analysis</li>
          <li>AI-powered processing via third-party services</li>
          <li>Storage of user responses and notes</li>
        </ul>
        <h3>2.4 Types of Personal Data</h3>
        <ul>
          <li>Contact information (names, email addresses)</li>
          <li>Document content (may contain personal data from RFPs)</li>
          <li>User-generated content (responses, notes)</li>
          <li>Usage data (IP addresses, activity logs)</li>
        </ul>
        <h3>2.5 Categories of Data Subjects</h3>
        <ul>
          <li>Customer employees and authorized users</li>
          <li>Individuals mentioned in RFP documents</li>
        </ul>
      </section>

      <section>
        <h2>3. Customer Obligations</h2>
        <p>The Customer agrees to:</p>
        <ul>
          <li>Ensure lawful basis for processing Personal Data</li>
          <li>Provide any required notices to Data Subjects</li>
          <li>Ensure accuracy of Personal Data provided</li>
          <li>Respond to Data Subject requests where applicable</li>
          <li>Comply with applicable data protection laws</li>
        </ul>
      </section>

      <section>
        <h2>4. Processor Obligations</h2>
        <p>RFP Engine agrees to:</p>
        <ul>
          <li>
            Process Personal Data only on documented instructions from the Customer
          </li>
          <li>
            Ensure personnel are subject to confidentiality obligations
          </li>
          <li>
            Implement appropriate technical and organizational security measures
          </li>
          <li>
            Not engage Sub-processors without prior authorization
          </li>
          <li>
            Assist the Customer in responding to Data Subject requests
          </li>
          <li>
            Assist with security, breach notification, and impact assessments
          </li>
          <li>
            Delete or return Personal Data upon termination (at Customer&apos;s choice)
          </li>
          <li>
            Make available information necessary to demonstrate compliance
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Security Measures</h2>
        <p>
          RFP Engine implements the following technical and organizational measures:
        </p>
        <h3>5.1 Technical Measures</h3>
        <ul>
          <li>Encryption in transit (TLS 1.2+)</li>
          <li>Encryption at rest for sensitive data</li>
          <li>Secure password hashing (bcrypt)</li>
          <li>Regular security updates and patches</li>
          <li>Intrusion detection systems</li>
          <li>Regular security assessments</li>
        </ul>
        <h3>5.2 Organizational Measures</h3>
        <ul>
          <li>Access control policies (principle of least privilege)</li>
          <li>Employee security training</li>
          <li>Incident response procedures</li>
          <li>Regular security audits</li>
          <li>Vendor security assessments</li>
        </ul>
      </section>

      <section>
        <h2>6. Sub-processors</h2>
        <h3>6.1 Authorized Sub-processors</h3>
        <p>
          The Customer authorizes the use of the following Sub-processors:
        </p>
        <table className="w-full border-collapse border border-gray-300 my-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Sub-processor</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Purpose</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">OpenAI</td>
              <td className="border border-gray-300 px-4 py-2">AI processing for document analysis</td>
              <td className="border border-gray-300 px-4 py-2">United States</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Stripe</td>
              <td className="border border-gray-300 px-4 py-2">Payment processing</td>
              <td className="border border-gray-300 px-4 py-2">United States</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Vercel</td>
              <td className="border border-gray-300 px-4 py-2">Hosting infrastructure</td>
              <td className="border border-gray-300 px-4 py-2">United States / Global</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Database Provider</td>
              <td className="border border-gray-300 px-4 py-2">Data storage</td>
              <td className="border border-gray-300 px-4 py-2">To be specified</td>
            </tr>
          </tbody>
        </table>
        <h3>6.2 Sub-processor Changes</h3>
        <p>
          RFP Engine will notify the Customer of any intended changes to Sub-processors
          at least 30 days in advance. The Customer may object to such changes.
        </p>
      </section>

      <section>
        <h2>7. Data Transfers</h2>
        <p>
          Where Personal Data is transferred outside the EEA, we ensure appropriate
          safeguards are in place:
        </p>
        <ul>
          <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
          <li>Transfer Impact Assessments where required</li>
          <li>Supplementary measures as needed</li>
        </ul>
      </section>

      <section>
        <h2>8. Data Subject Rights</h2>
        <p>
          RFP Engine will assist the Customer in responding to Data Subject requests
          including:
        </p>
        <ul>
          <li>Access requests</li>
          <li>Rectification requests</li>
          <li>Erasure requests</li>
          <li>Portability requests</li>
          <li>Objection to processing</li>
          <li>Restriction of processing</li>
        </ul>
      </section>

      <section>
        <h2>9. Data Breach Notification</h2>
        <p>
          In the event of a Personal Data breach, RFP Engine will:
        </p>
        <ul>
          <li>
            Notify the Customer without undue delay (and in any event within 72 hours)
            after becoming aware of the breach
          </li>
          <li>
            Provide information about the nature of the breach, categories of data affected,
            and measures taken or proposed
          </li>
          <li>
            Assist the Customer in meeting any breach notification obligations
          </li>
        </ul>
      </section>

      <section>
        <h2>10. Audit Rights</h2>
        <p>
          Upon reasonable notice, RFP Engine will:
        </p>
        <ul>
          <li>
            Make available to the Customer information necessary to demonstrate compliance
          </li>
          <li>
            Allow for and contribute to audits conducted by the Customer or an auditor
            mandated by the Customer
          </li>
          <li>
            Provide audit reports or certifications upon request (e.g., SOC 2)
          </li>
        </ul>
      </section>

      <section>
        <h2>11. Termination</h2>
        <p>
          Upon termination of the Service agreement:
        </p>
        <ul>
          <li>
            At the Customer&apos;s choice, RFP Engine will delete or return all Personal Data
          </li>
          <li>
            Deletion will be completed within 90 days
          </li>
          <li>
            RFP Engine may retain data where required by law (with notification)
          </li>
        </ul>
      </section>

      <section>
        <h2>12. Liability</h2>
        <p>
          Each party&apos;s liability under this DPA is subject to the limitations set forth
          in the main Service agreement.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>For DPA-related inquiries:</p>
        <ul>
          <li>
            <strong>Email:</strong> enterprise@rfpengine.com
          </li>
          <li>
            <strong>Data Protection Officer:</strong> dpo@rfpengine.com
          </li>
        </ul>
      </section>

      <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 mt-8">
        <h2 className="mt-0">Request a Signed DPA</h2>
        <p>
          Enterprise customers can request a countersigned copy of this DPA.
          Please contact <strong>enterprise@rfpengine.com</strong> with:
        </p>
        <ul>
          <li>Your company name and address</li>
          <li>Contact person for data protection matters</li>
          <li>Any specific requirements or modifications needed</li>
        </ul>
      </div>
    </>
  );
}
