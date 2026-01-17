interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "RFP Matrix",
  "url": "https://rfpmatrix.com",
  "logo": "https://rfpmatrix.com/logo.png",
  "description": "AI-powered RFP and tender response management software",
  "sameAs": [],
};

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "RFP Matrix",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "150",
    "highPrice": "500",
    "priceCurrency": "USD",
    "offerCount": "4",
  },
  "description": "AI-powered RFP management software that helps teams respond to RFPs and tenders 10x faster with automated requirement extraction and draft generation.",
  "featureList": [
    "AI-powered requirement extraction",
    "Draft response generation",
    "Response library management",
    "Export to Word and PDF",
    "Compliance matrix export",
  ],
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "RFP Matrix",
  "url": "https://rfpmatrix.com",
};

export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };
}
