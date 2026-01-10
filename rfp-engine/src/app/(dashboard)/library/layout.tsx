import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Response Library",
};

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
