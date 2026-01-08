import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LibraryClient } from "./LibraryClient";

export default async function LibraryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <LibraryClient />;
}
