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
  "name": "RFP Engine",
  "url": "https://rfpengine.com",
  "logo": "https://rfpengine.com/logo.png",
  "description": "AI-powered RFP and tender response management software",
  "sameAs": [],
};

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "RFP Engine",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "GBP",
    "description": "Free tier with 2 RFP extractions per month",
  },
  "description": "AI-powered RFP management software that helps teams respond to RFPs and tenders 10x faster with automated requirement extraction and draft generation.",
  "featureList": [
    "AI-powered requirement extraction",
    "Draft response generation",
    "Compliance matrix tracking",
    "Response library management",
    "Team collaboration",
    "Document export (Word, PDF)",
  ],
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "RFP Engine",
  "url": "https://rfpengine.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://rfpengine.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
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
