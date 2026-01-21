import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Processing Agreement - RFP Matrix",
  description: "Data Processing Agreement (DPA) for enterprise customers.",
};

export default function DPAPage() {
  const lastUpdated = "January 2026";
  const dpaVersion = "1.1";

  return (
    <>
      <h1>Data Processing Agreement</h1>
      <p className="text-gray-600">
        Last updated: {lastUpdated} | Version {dpaVersion}
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-6">
        <p className="text-blue-800">
          <strong>For Enterprise Customers:</strong> This Data Processing Agreement (DPA)
          governs the processing of personal data when you use RFP Matrix as a business customer.
          To execute this DPA, please contact us at <strong>enterprise@rfpmatrix.com</strong>.
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
            behalf of the Controller (RFP Matrix).
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
          <li>
            <strong>&quot;SCCs&quot;</strong> means the Standard Contractual Clauses approved by
            European Commission Implementing Decision (EU) 2021/914.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Scope and Purpose</h2>
        <p>
          This DPA applies to the processing of Personal Data by RFP Matrix on behalf of the
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
        <p>RFP Matrix agrees to:</p>
        <ul>
          <li>Process Personal Data only on documented instructions from the Customer</li>
          <li>Ensure personnel are subject to confidentiality obligations</li>
          <li>Implement appropriate technical and organizational security measures</li>
          <li>Not engage Sub-processors without prior authorization</li>
          <li>Assist the Customer in responding to Data Subject requests</li>
          <li>Assist with security, breach notification, and impact assessments</li>
          <li>Delete or return Personal Data upon termination (at Customer&apos;s choice)</li>
          <li>Make available information necessary to demonstrate compliance</li>
        </ul>
      </section>

      <section>
        <h2>5. Security Measures (Annex 1)</h2>
        <p>
          RFP Matrix implements the following technical and organizational measures
          pursuant to GDPR Article 32:
        </p>

        <h3>5.1 Technical Measures</h3>
        <table className="w-full border-collapse border border-gray-300 my-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Measure</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Implementation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Encryption in transit</td>
              <td className="border border-gray-300 px-4 py-2">TLS 1.2+ for all connections; HTTPS enforced</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Encryption at rest</td>
              <td className="border border-gray-300 px-4 py-2">AES-256 encryption for database and file storage</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Password security</td>
              <td className="border border-gray-300 px-4 py-2">bcrypt hashing (cost factor 12); minimum complexity requirements</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Authentication</td>
              <td className="border border-gray-300 px-4 py-2">Email verification; optional 2FA (TOTP); session management</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Rate limiting</td>
              <td className="border border-gray-300 px-4 py-2">Redis-based rate limiting on authentication and API endpoints</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">CSRF protection</td>
              <td className="border border-gray-300 px-4 py-2">Token-based CSRF protection on all state-changing operations</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Input validation</td>
              <td className="border border-gray-300 px-4 py-2">Schema validation (Zod); parameterized database queries</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Logging &amp; monitoring</td>
              <td className="border border-gray-300 px-4 py-2">Comprehensive audit logging; error tracking (Sentry)</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Backup &amp; recovery</td>
              <td className="border border-gray-300 px-4 py-2">Automated daily backups; point-in-time recovery capability</td>
            </tr>
          </tbody>
        </table>

        <h3>5.2 Organizational Measures</h3>
        <table className="w-full border-collapse border border-gray-300 my-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Measure</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Implementation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Access control</td>
              <td className="border border-gray-300 px-4 py-2">Principle of least privilege; role-based access; MFA for admin access</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Confidentiality</td>
              <td className="border border-gray-300 px-4 py-2">NDA requirements for all personnel with data access</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Incident response</td>
              <td className="border border-gray-300 px-4 py-2">Documented incident response plan; 72-hour breach notification</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Vendor management</td>
              <td className="border border-gray-300 px-4 py-2">Security assessments for all sub-processors; DPAs in place</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Data minimization</td>
              <td className="border border-gray-300 px-4 py-2">Collection limited to necessary data; retention policies enforced</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>6. Sub-processors</h2>

        <h3>6.1 Authorized Sub-processors</h3>
        <p>The Customer authorizes the use of the following Sub-processors:</p>
        <table className="w-full border-collapse border border-gray-300 my-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Sub-processor</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Purpose</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Location</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Safeguards</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">OpenAI, LLC</td>
              <td className="border border-gray-300 px-4 py-2">AI processing for document analysis and response generation</td>
              <td className="border border-gray-300 px-4 py-2">United States</td>
              <td className="border border-gray-300 px-4 py-2">SCCs, DPA, API zero-retention</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Stripe, Inc.</td>
              <td className="border border-gray-300 px-4 py-2">Payment processing and subscription management</td>
              <td className="border border-gray-300 px-4 py-2">United States</td>
              <td className="border border-gray-300 px-4 py-2">SCCs, DPA, PCI-DSS Level 1</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Vercel Inc.</td>
              <td className="border border-gray-300 px-4 py-2">Application hosting and edge delivery</td>
              <td className="border border-gray-300 px-4 py-2">United States / Global Edge</td>
              <td className="border border-gray-300 px-4 py-2">SCCs, DPA, SOC 2 Type II</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Neon Inc.</td>
              <td className="border border-gray-300 px-4 py-2">PostgreSQL database hosting</td>
              <td className="border border-gray-300 px-4 py-2">United States (AWS us-east-1)</td>
              <td className="border border-gray-300 px-4 py-2">SCCs, DPA, SOC 2 Type II</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Upstash Inc.</td>
              <td className="border border-gray-300 px-4 py-2">Redis caching and rate limiting</td>
              <td className="border border-gray-300 px-4 py-2">United States / Global</td>
              <td className="border border-gray-300 px-4 py-2">SCCs, DPA, SOC 2 Type II</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Resend Inc.</td>
              <td className="border border-gray-300 px-4 py-2">Transactional email delivery</td>
              <td className="border border-gray-300 px-4 py-2">United States</td>
              <td className="border border-gray-300 px-4 py-2">SCCs, DPA</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">Sentry (Functional Software, Inc.)</td>
              <td className="border border-gray-300 px-4 py-2">Error monitoring and performance tracking</td>
              <td className="border border-gray-300 px-4 py-2">United States</td>
              <td className="border border-gray-300 px-4 py-2">SCCs, DPA, SOC 2 Type II</td>
            </tr>
          </tbody>
        </table>

        <h3>6.2 Sub-processor Changes</h3>
        <p>
          RFP Matrix will notify the Customer of any intended changes to Sub-processors
          at least 30 days in advance. Notifications will be sent to:
        </p>
        <ul>
          <li>The email address associated with your account</li>
          <li>Enterprise customers: your designated DPA contact</li>
        </ul>
        <p>
          To subscribe to sub-processor change notifications, email{" "}
          <a href="mailto:help@rfpmatrix.com">help@rfpmatrix.com</a> with
          subject line &quot;Subscribe to Sub-processor Updates&quot;.
        </p>
        <p>
          The Customer may object to a new Sub-processor within 14 days of notification.
          If a reasonable objection cannot be resolved, the Customer may terminate the
          affected services without penalty.
        </p>
      </section>

      <section>
        <h2>7. International Data Transfers (Annex 2)</h2>
        <p>
          Where Personal Data is transferred outside the EEA to countries without an
          adequacy decision, we ensure appropriate safeguards are in place:
        </p>

        <h3>7.1 Standard Contractual Clauses</h3>
        <p>
          We incorporate the European Commission&apos;s Standard Contractual Clauses
          (Commission Implementing Decision (EU) 2021/914 of 4 June 2021) for transfers
          to all US-based sub-processors. The applicable modules are:
        </p>
        <ul>
          <li><strong>Module Two:</strong> Controller to Processor (Customer to RFP Matrix)</li>
          <li><strong>Module Three:</strong> Processor to Processor (RFP Matrix to Sub-processors)</li>
        </ul>

        <h3>7.2 Transfer Impact Assessments</h3>
        <p>
          We have conducted Transfer Impact Assessments (TIAs) for each US sub-processor,
          evaluating:
        </p>
        <ul>
          <li>The legal framework in the destination country (US surveillance laws)</li>
          <li>The nature and sensitivity of data transferred</li>
          <li>Contractual, technical, and organizational safeguards</li>
          <li>Likelihood of government access requests</li>
        </ul>
        <p>
          TIA summaries are available to enterprise customers upon request by contacting{" "}
          <a href="mailto:dpo@rfpmatrix.com">dpo@rfpmatrix.com</a>.
        </p>

        <h3>7.3 Supplementary Measures</h3>
        <p>
          In addition to SCCs, we implement the following supplementary measures as
          recommended by the EDPB:
        </p>
        <ul>
          <li>End-to-end encryption for data in transit (TLS 1.2+)</li>
          <li>Encryption at rest using AES-256</li>
          <li>Data minimization - only necessary data is transferred</li>
          <li>Pseudonymization where technically feasible</li>
          <li>Strict access controls with audit logging</li>
          <li>Contractual commitments from sub-processors to challenge access requests</li>
        </ul>
      </section>

      <section>
        <h2>8. Data Subject Rights</h2>
        <p>
          RFP Matrix will assist the Customer in responding to Data Subject requests
          including:
        </p>
        <ul>
          <li>Access requests (Article 15)</li>
          <li>Rectification requests (Article 16)</li>
          <li>Erasure requests (Article 17)</li>
          <li>Restriction of processing (Article 18)</li>
          <li>Data portability (Article 20)</li>
          <li>Objection to processing (Article 21)</li>
        </ul>
        <p>
          Self-service tools are available in user account settings for data export
          and account deletion. For complex requests, contact{" "}
          <a href="mailto:privacy@rfpmatrix.com">privacy@rfpmatrix.com</a>.
        </p>
      </section>

      <section>
        <h2>9. Data Breach Notification</h2>
        <p>In the event of a Personal Data breach, RFP Matrix will:</p>
        <ul>
          <li>
            Notify the Customer without undue delay (and in any event within 72 hours)
            after becoming aware of the breach
          </li>
          <li>
            Provide information about:
            <ul>
              <li>Nature of the breach and categories of data affected</li>
              <li>Approximate number of data subjects affected</li>
              <li>Likely consequences of the breach</li>
              <li>Measures taken or proposed to address the breach</li>
            </ul>
          </li>
          <li>
            Assist the Customer in meeting any breach notification obligations to
            supervisory authorities and data subjects
          </li>
          <li>Cooperate with any investigation and remediation efforts</li>
        </ul>
      </section>

      <section>
        <h2>10. Audit Rights</h2>
        <p>Upon reasonable notice (minimum 30 days), RFP Matrix will:</p>
        <ul>
          <li>
            Make available to the Customer information necessary to demonstrate compliance
            with GDPR Article 28 obligations
          </li>
          <li>
            Allow for and contribute to audits conducted by the Customer or an auditor
            mandated by the Customer, subject to confidentiality obligations
          </li>
          <li>
            Provide copies of relevant certifications and audit reports:
            <ul>
              <li>Sub-processor SOC 2 Type II reports (where available)</li>
              <li>Penetration test summaries (annual)</li>
              <li>Internal security assessment reports</li>
            </ul>
          </li>
        </ul>
        <p>
          Audit costs shall be borne by the requesting party unless the audit reveals
          material non-compliance by RFP Matrix.
        </p>
      </section>

      <section>
        <h2>11. Data Retention and Deletion</h2>
        <p>Upon termination of the Service agreement:</p>
        <ul>
          <li>At the Customer&apos;s choice, RFP Matrix will delete or return all Personal Data</li>
          <li>Deletion will be completed within 90 days of request</li>
          <li>Certification of deletion available upon request</li>
          <li>RFP Matrix may retain data where required by law (with notification to Customer)</li>
          <li>
            Backup data will be deleted according to normal backup rotation schedules
            (maximum 30 days after primary deletion)
          </li>
        </ul>
      </section>

      <section>
        <h2>12. Liability</h2>
        <p>
          Each party&apos;s liability under this DPA is subject to the limitations set forth
          in the main Service agreement, except that:
        </p>
        <ul>
          <li>
            Neither party excludes liability for breaches of data protection law caused
            by wilful misconduct or gross negligence
          </li>
          <li>Liability caps do not apply to regulatory fines imposed on either party</li>
        </ul>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>For DPA-related inquiries:</p>
        <ul>
          <li><strong>General inquiries:</strong> enterprise@rfpmatrix.com</li>
          <li><strong>Data Protection Officer:</strong> dpo@rfpmatrix.com</li>
          <li><strong>Sub-processor updates:</strong> help@rfpmatrix.com</li>
          <li><strong>Security incidents:</strong> security@rfpmatrix.com</li>
        </ul>
      </section>

      <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 mt-8">
        <h2 className="mt-0">Request a Signed DPA</h2>
        <p>
          Enterprise customers can request a countersigned copy of this DPA.
          Please contact <strong>enterprise@rfpmatrix.com</strong> with:
        </p>
        <ul>
          <li>Your company name and registered address</li>
          <li>Company registration number (if applicable)</li>
          <li>Contact person for data protection matters</li>
          <li>Any specific requirements or modifications needed</li>
        </ul>
        <p className="text-sm text-gray-600 mt-4">
          Standard DPA execution is included at no additional cost. Custom modifications
          may require legal review.
        </p>
      </div>
    </>
  );
}
