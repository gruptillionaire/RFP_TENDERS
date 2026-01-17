import { Metadata } from "next";
import { GoNoGoTool } from "./GoNoGoTool";

export const metadata: Metadata = {
  title: "Go/No-Go Decision Tool | RFP Matrix",
  description: "Free tool to evaluate RFP opportunities. Get a data-driven recommendation on whether to pursue an RFP based on strategic fit, capability, competition, and more.",
  keywords: ["go no-go decision", "RFP qualification", "bid decision tool", "RFP evaluation", "bid no-bid"],
  openGraph: {
    title: "Go/No-Go Decision Tool | RFP Matrix",
    description: "Free tool to evaluate whether an RFP opportunity is worth pursuing.",
    type: "website",
  },
};

export default function GoNoGoPage() {
  return <GoNoGoTool />;
}
