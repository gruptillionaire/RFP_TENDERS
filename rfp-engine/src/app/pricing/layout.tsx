import { Metadata } from "next";
import { JsonLd, faqSchema } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Pricing Plans",
  description: "Choose from Solo, Pro, or Team plans. AI-powered RFP extraction and drafting to help you respond faster and win more contracts.",
  alternates: {
    canonical: "/pricing",
  },
};

const faqs = [
  {
    question: "Can I change plans later?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.",
  },
  {
    question: "What happens if I exceed my limits?",
    answer: "You'll be prompted to upgrade or wait until your limits reset at the start of your next billing period.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Absolutely. Cancel anytime from your account settings. You'll retain access until the end of your current billing period.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. All data is encrypted at rest and in transit. We're GDPR and CCPA compliant. Your RFP documents are never shared or used for training.",
  },
];

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={faqSchema(faqs)} />
      {children}
    </>
  );
}
