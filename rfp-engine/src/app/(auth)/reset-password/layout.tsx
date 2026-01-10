import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set New Password",
  description: "Set a new password for your RFP Engine account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
