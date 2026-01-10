import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CookieConsent } from "@/components/CookieConsent";
import { PostHogProvider } from "@/components/PostHogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://rfpengine.com'),
  title: {
    default: "RFP Engine - AI-Powered RFP Management Software",
    template: "%s | RFP Engine"
  },
  description: "Respond to RFPs and tenders 10x faster with AI-powered requirement extraction and draft response generation. Upload documents, track compliance, and win more bids.",
  keywords: ["RFP software", "tender management", "proposal automation", "AI RFP response", "bid management", "compliance matrix", "RFP response tool"],
  authors: [{ name: "RFP Engine" }],
  creator: "RFP Engine",
  publisher: "RFP Engine",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "/",
    siteName: "RFP Engine",
    title: "RFP Engine - AI-Powered RFP Management",
    description: "Respond to RFPs 10x faster with AI-powered requirement extraction and draft generation.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RFP Engine - AI-Powered RFP Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RFP Engine - AI-Powered RFP Management",
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
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
