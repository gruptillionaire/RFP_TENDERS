import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy - RFP Matrix",
  description: "Cookie Policy for RFP Matrix - Learn about the cookies we use.",
};

export default function CookiePolicyPage() {
  const lastUpdated = "January 2026";

  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="text-gray-600">Last updated: {lastUpdated}</p>

      <section>
        <h2>1. What Are Cookies?</h2>
        <p>
          Cookies are small text files stored on your device when you visit a website.
          They help websites remember your preferences and improve your experience.
        </p>
        <p>
          We also use similar technologies like local storage and session storage,
          which function similarly to cookies.
        </p>
      </section>

      <section>
        <h2>2. Types of Cookies We Use</h2>

        <h3>2.1 Essential Cookies (Required)</h3>
        <p>
          These cookies are necessary for the Service to function and cannot be disabled.
        </p>
        <table className="w-full border-collapse border border-gray-300 my-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Cookie</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Purpose</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">next-auth.session-token</td>
              <td className="border border-gray-300 px-4 py-2">Authentication session</td>
              <td className="border border-gray-300 px-4 py-2">30 days</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">next-auth.csrf-token</td>
              <td className="border border-gray-300 px-4 py-2">Security (CSRF protection)</td>
              <td className="border border-gray-300 px-4 py-2">Session</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">next-auth.callback-url</td>
              <td className="border border-gray-300 px-4 py-2">Redirect after login</td>
              <td className="border border-gray-300 px-4 py-2">Session</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">cookie-consent</td>
              <td className="border border-gray-300 px-4 py-2">Remember your cookie preferences</td>
              <td className="border border-gray-300 px-4 py-2">1 year</td>
            </tr>
          </tbody>
        </table>

        <h3>2.2 Preference Cookies (Optional)</h3>
        <p>
          These cookies remember your settings and preferences.
        </p>
        <table className="w-full border-collapse border border-gray-300 my-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Cookie</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Purpose</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">theme</td>
              <td className="border border-gray-300 px-4 py-2">Remember dark/light mode preference</td>
              <td className="border border-gray-300 px-4 py-2">1 year</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">sidebar-collapsed</td>
              <td className="border border-gray-300 px-4 py-2">Remember sidebar state</td>
              <td className="border border-gray-300 px-4 py-2">1 year</td>
            </tr>
          </tbody>
        </table>

        <h3>2.3 Analytics Cookies (Optional)</h3>
        <p>
          These cookies help us understand how you use the Service so we can improve it.
          We only use these with your consent.
        </p>
        <table className="w-full border-collapse border border-gray-300 my-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Cookie</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Purpose</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">_ga</td>
              <td className="border border-gray-300 px-4 py-2">Google Analytics - Distinguish users</td>
              <td className="border border-gray-300 px-4 py-2">2 years</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-4 py-2">_gid</td>
              <td className="border border-gray-300 px-4 py-2">Google Analytics - Distinguish users</td>
              <td className="border border-gray-300 px-4 py-2">24 hours</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm text-gray-600">
          Note: Analytics cookies are only set if you consent to non-essential cookies.
        </p>
      </section>

      <section>
        <h2>3. Local Storage</h2>
        <p>
          We also use local storage (similar to cookies but stored differently) for:
        </p>
        <ul>
          <li>Caching temporary data to improve performance</li>
          <li>Storing draft text while you&apos;re editing</li>
          <li>Remembering UI state within a session</li>
        </ul>
      </section>

      <section>
        <h2>4. Third-Party Cookies</h2>
        <p>
          Some cookies are set by third-party services we use:
        </p>

        <h3>4.1 Stripe (Payment Processing)</h3>
        <p>
          If you make a payment, Stripe may set cookies for fraud prevention and to process
          your payment securely.{" "}
          <a
            href="https://stripe.com/cookie-settings"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe&apos;s Cookie Policy
          </a>
        </p>

        <h3>4.2 Google Analytics (If Enabled)</h3>
        <p>
          If you consent to analytics cookies, Google Analytics will set cookies to help
          us understand site usage.{" "}
          <a
            href="https://policies.google.com/technologies/cookies"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google&apos;s Cookie Policy
          </a>
        </p>
      </section>

      <section>
        <h2>5. Managing Your Cookie Preferences</h2>

        <h3>5.1 Cookie Consent Banner</h3>
        <p>
          When you first visit our site, you&apos;ll see a cookie consent banner where you can:
        </p>
        <ul>
          <li>Accept all cookies</li>
          <li>Reject non-essential cookies</li>
          <li>Customize your preferences</li>
        </ul>

        <h3>5.2 Changing Your Preferences</h3>
        <p>
          You can change your cookie preferences at any time in your{" "}
          <a href="/settings">account settings</a>.
        </p>

        <h3>5.3 Browser Settings</h3>
        <p>
          You can also control cookies through your browser settings. Most browsers allow you to:
        </p>
        <ul>
          <li>See what cookies are stored</li>
          <li>Delete all or specific cookies</li>
          <li>Block cookies from certain sites</li>
          <li>Block all third-party cookies</li>
          <li>Block all cookies</li>
        </ul>
        <p>
          Note: Blocking essential cookies will prevent you from using the Service.
        </p>

        <h4>Browser-Specific Instructions:</h4>
        <ul>
          <li>
            <a
              href="https://support.google.com/chrome/answer/95647"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Chrome
            </a>
          </li>
          <li>
            <a
              href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
              target="_blank"
              rel="noopener noreferrer"
            >
              Mozilla Firefox
            </a>
          </li>
          <li>
            <a
              href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
              target="_blank"
              rel="noopener noreferrer"
            >
              Safari
            </a>
          </li>
          <li>
            <a
              href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
              target="_blank"
              rel="noopener noreferrer"
            >
              Microsoft Edge
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Do Not Track</h2>
        <p>
          Some browsers have a &quot;Do Not Track&quot; (DNT) feature. We currently do not respond
          to DNT signals because there is no industry standard for how to interpret them.
          However, you can opt out of non-essential cookies using our cookie consent tools.
        </p>
      </section>

      <section>
        <h2>7. Updates to This Policy</h2>
        <p>
          We may update this Cookie Policy from time to time. Changes will be posted on this
          page with an updated date. For significant changes, we may also notify you via email
          or through a notice on our Service.
        </p>
      </section>

      <section>
        <h2>8. Contact Us</h2>
        <p>
          If you have questions about our use of cookies, please contact us at:
        </p>
        <ul>
          <li>
            <strong>Email:</strong> privacy@rfpmatrix.com
          </li>
        </ul>
      </section>
    </>
  );
}
