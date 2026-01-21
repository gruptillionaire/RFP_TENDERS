import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CookieConsent } from "@/components/CookieConsent";
import { Providers } from "@/components/Providers";
import { ConditionalAnalytics } from "@/components/ConditionalAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://rfpmatrix.com'),
  title: {
    default: "RFP Matrix | AI-Powered RFP Compliance Software",
    template: "%s | RFP Matrix"
  },
  description: "RFP Matrix extracts every requirement from your RFP documents using AI. Track compliance, generate draft responses, and never miss a requirement again.",
  keywords: ["RFP Matrix", "RFP software", "tender management", "proposal automation", "AI RFP response", "bid management", "compliance matrix", "RFP response tool"],
  authors: [{ name: "RFP Matrix" }],
  creator: "RFP Matrix",
  publisher: "RFP Matrix",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "/",
    siteName: "RFP Matrix",
    title: "RFP Matrix - AI-Powered RFP Management",
    description: "Respond to RFPs 10x faster with AI-powered requirement extraction and draft generation.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RFP Matrix - AI-Powered RFP Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RFP Matrix - AI-Powered RFP Management",
    description: "Respond to RFPs 10x faster with AI-powered requirement extraction.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
          <CookieConsent />
          <ConditionalAnalytics />
        </Providers>
      </body>
    </html>
  );
}
