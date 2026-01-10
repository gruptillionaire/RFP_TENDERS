import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProjectView } from "./ProjectView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true },
  });

  return {
    title: project?.name || "Project",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      requirements: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!project || project.userId !== session.user.id) {
    notFound();
  }

  return <ProjectView project={project} />;
}
