import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NewProjectClient } from "./NewProjectClient";

export default async function NewProjectPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Check email verification from database
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });

  if (!user?.emailVerified) {
    redirect("/verify-email?redirect=/projects/new");
  }

  return <NewProjectClient />;
}
