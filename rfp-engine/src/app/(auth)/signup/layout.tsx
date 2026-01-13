import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your RFP Matrix account. Start responding to RFPs faster with AI-powered extraction and drafting tools.",
  alternates: {
    canonical: "/signup",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
