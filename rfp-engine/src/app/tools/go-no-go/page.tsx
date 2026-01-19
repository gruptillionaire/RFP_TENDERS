import { Metadata } from "next";
import { GoNoGoTool } from "./GoNoGoTool";

export const metadata: Metadata = {
  title: "Go/No-Go Decision Tool | RFP Matrix",
  description: "Evaluate RFP opportunities with our Go/No-Go decision tool. Get a data-driven recommendation on whether to pursue an RFP based on strategic fit, capability, competition, and more.",
  keywords: ["go no-go decision", "RFP qualification", "bid decision tool", "RFP evaluation", "bid no-bid"],
  openGraph: {
    title: "Go/No-Go Decision Tool | RFP Matrix",
    description: "Evaluate whether an RFP opportunity is worth pursuing with our Go/No-Go decision tool.",
    type: "website",
  },
};

export default function GoNoGoPage() {
  return <GoNoGoTool />;
}
