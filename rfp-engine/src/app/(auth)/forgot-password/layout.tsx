import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your RFP Matrix account password.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
