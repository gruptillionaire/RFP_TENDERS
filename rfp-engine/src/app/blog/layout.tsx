import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | RFP Matrix",
    default: "RFP Matrix Blog - RFP Response Tips & Best Practices",
  },
  description: "Expert insights on RFP response management, bid strategies, and procurement best practices. Learn how to win more contracts with AI-powered RFP tools.",
  openGraph: {
    type: "website",
    siteName: "RFP Matrix",
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
