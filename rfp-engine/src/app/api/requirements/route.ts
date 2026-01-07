import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDraft } from "@/lib/openai";
import { RequirementType } from "@/lib/constants";
import { DomainContext } from "@/lib/domain-context";

// Security constants
const MAX_DRAFT_LENGTH = 50000; // 50KB
const MAX_NOTES_LENGTH = 10000; // 10KB
const VALID_STATUSES = ["UNANSWERED", "PARTIAL", "ANSWERED"];
const VALID_TYPES = ["CONTEXTUAL", "PROCEDURAL", "DECLARATIVE", "DESCRIPTIVE", "EVIDENCE_BASED"];
const VALID_DOMAINS = ["FEATURE", "PROCESS", "LEGAL"];

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, status, draftAnswer, type, domainContext, internalNotes } = await request.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Requirement ID is required" }, { status: 400 });
    }

    // Input validation
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    if (type && !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid type value" }, { status: 400 });
    }

    if (domainContext && !VALID_DOMAINS.includes(domainContext)) {
      return NextResponse.json({ error: "Invalid domain context value" }, { status: 400 });
    }

    if (draftAnswer !== undefined && typeof draftAnswer === "string" && draftAnswer.length > MAX_DRAFT_LENGTH) {
      return NextResponse.json(
        { error: `Draft answer must not exceed ${MAX_DRAFT_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (internalNotes !== undefined && typeof internalNotes === "string" && internalNotes.length > MAX_NOTES_LENGTH) {
      return NextResponse.json(
        { error: `Internal notes must not exceed ${MAX_NOTES_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Verify ownership through project
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } },
    });

    if (!requirement || requirement.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Update requirement
    const updated = await prisma.requirement.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(draftAnswer !== undefined && { draftAnswer }),
        ...(type && { type }),
        ...(domainContext && { domainContext }),
        ...(internalNotes !== undefined && { internalNotes }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Requirement update error:", error);
    return NextResponse.json(
      { error: "Failed to update requirement" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, action } = await request.json();

    if (!id || action !== "generate-draft") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Verify ownership and get requirement with project's companyName
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: { project: { select: { userId: true, companyName: true } } },
    });

    if (!requirement || requirement.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Generate draft with requirement type and domain context
    const { draft, requiresReview } = await generateDraft(
      requirement.text,
      requirement.type as RequirementType,
      (requirement.domainContext as DomainContext) || "FEATURE"
    );

    // Replace [COMPANY NAME] with actual company name if set
    let finalDraft = draft;
    if (requirement.project.companyName) {
      finalDraft = draft.replace(/\[COMPANY NAME\]/g, requirement.project.companyName);
    }

    // Update requirement with draft and review status
    const updated = await prisma.requirement.update({
      where: { id },
      data: {
        draftAnswer: finalDraft,
        status: "PARTIAL",
        requiresReview,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Draft generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate draft" },
      { status: 500 }
    );
  }
}
