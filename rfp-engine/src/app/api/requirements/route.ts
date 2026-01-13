import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDraft } from "@/lib/openai";
import { RequirementType } from "@/lib/constants";
import { DomainContext } from "@/lib/domain-context";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";
import { rateLimiters, rateLimitHeaders } from "@/lib/rate-limit";
import {
  checkAndIncrementDraftQuota,
  getSingleUseQuotaStatus,
  checkAndConsumeSingleUseDraft,
} from "@/lib/quota";

// Security constants
const MAX_DRAFT_LENGTH = 50000; // 50KB
const MAX_NOTES_LENGTH = 10000; // 10KB
const VALID_STATUSES = ["UNANSWERED", "PARTIAL", "ANSWERED"];
const VALID_TYPES = ["CONTEXTUAL", "PROCEDURAL", "DECLARATIVE", "DESCRIPTIVE", "EVIDENCE_BASED", "QUANTITATIVE", "REFERENCE_BASED", "STAFFING"];
const VALID_DOMAINS = ["FEATURE", "PROCESS", "LEGAL"];
const VALID_COMPLIANCE_STATUSES = ["PENDING", "COMPLIANT", "NON_COMPLIANT", "NOT_APPLICABLE"];

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimit = rateLimiters.requirements(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    const { id, status, draftAnswer, type, domainContext, internalNotes, isAttestation, complianceStatus } = await request.json();

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

    if (complianceStatus && !VALID_COMPLIANCE_STATUSES.includes(complianceStatus)) {
      return NextResponse.json({ error: "Invalid compliance status value" }, { status: 400 });
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

    // Create version entry if draftAnswer is changing and there was an existing value
    const shouldCreateVersion = draftAnswer !== undefined &&
                                requirement.draftAnswer !== null &&
                                requirement.draftAnswer !== draftAnswer;

    // Update requirement and create version in transaction if needed
    const updated = await prisma.$transaction(async (tx) => {
      // Create version entry for the previous state before updating
      if (shouldCreateVersion) {
        await tx.requirementVersion.create({
          data: {
            requirementId: id,
            draftAnswer: requirement.draftAnswer!,
            status: requirement.status,
            editedById: session.user.id,
            changeSource: "manual",
          },
        });
      }

      // Update the requirement
      return tx.requirement.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(draftAnswer !== undefined && { draftAnswer }),
          ...(type && { type }),
          ...(domainContext && { domainContext }),
          ...(internalNotes !== undefined && { internalNotes }),
          ...(isAttestation !== undefined && { isAttestation }),
          ...(complianceStatus && { complianceStatus }),
        },
      });
    });

    // Log the update
    await logAudit({
      userId: session.user.id,
      action: AuditAction.REQUIREMENT_UPDATE,
      resource: AuditResource.REQUIREMENT,
      resourceId: id,
      details: {
        projectId: requirement.projectId,
        changedFields: Object.keys({
          ...(status && { status }),
          ...(draftAnswer !== undefined && { draftAnswer }),
          ...(type && { type }),
          ...(domainContext && { domainContext }),
          ...(internalNotes !== undefined && { internalNotes }),
          ...(isAttestation !== undefined && { isAttestation }),
          ...(complianceStatus && { complianceStatus }),
        }),
      },
      request,
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

    // Rate limiting
    const rateLimit = rateLimiters.requirements(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const { action } = body;

    // Handle manual requirement creation
    if (action === "create-manual") {
      const { projectId, text, section, isMandatory, type, domainContext, isAttestation } = body;

      if (!projectId || !text?.trim()) {
        return NextResponse.json({ error: "Project ID and requirement text are required" }, { status: 400 });
      }

      if (text.length > 5000) {
        return NextResponse.json({ error: "Requirement text must not exceed 5000 characters" }, { status: 400 });
      }

      if (type && !VALID_TYPES.includes(type)) {
        return NextResponse.json({ error: "Invalid type value" }, { status: 400 });
      }

      if (domainContext && !VALID_DOMAINS.includes(domainContext)) {
        return NextResponse.json({ error: "Invalid domain context value" }, { status: 400 });
      }

      // Verify project ownership
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { userId: true, _count: { select: { requirements: true } } },
      });

      if (!project || project.userId !== session.user.id) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      // Get the next order number
      const nextOrder = project._count.requirements + 1;

      // Create the requirement
      const created = await prisma.requirement.create({
        data: {
          projectId,
          text: text.trim(),
          section: section?.trim() || null,
          isMandatory: isMandatory ?? false,
          type: type || "DESCRIPTIVE",
          domainContext: domainContext || "FEATURE",
          order: nextOrder,
          status: "UNANSWERED",
          isManuallyAdded: true,
          isAttestation: isAttestation ?? false,
        },
      });

      // Log the creation
      await logAudit({
        userId: session.user.id,
        action: AuditAction.REQUIREMENT_UPDATE,
        resource: AuditResource.REQUIREMENT,
        resourceId: created.id,
        details: {
          projectId,
          action: "manual_create",
          type: created.type,
        },
        request,
      });

      return NextResponse.json(created);
    }

    // Handle draft generation
    const { id } = body;

    if (!id || action !== "generate-draft") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Verify ownership and get requirement with project info
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: { project: { select: { userId: true, companyName: true, isSingleUseProject: true } } },
    });

    if (!requirement || requirement.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check draft quota - use single-use for single-use projects, otherwise subscription
    const isSingleUseProject = requirement.project.isSingleUseProject;

    if (isSingleUseProject) {
      // Check single-use draft credits
      const singleUseStatus = await getSingleUseQuotaStatus(session.user.id);
      if (singleUseStatus.draftsRemaining <= 0 || singleUseStatus.isExpired) {
        return NextResponse.json(
          {
            error: "No draft credits remaining for this single-use project.",
            remaining: 0,
          },
          { status: 403 }
        );
      }
    } else {
      // Check subscription draft quota
      const draftQuota = await checkAndIncrementDraftQuota(session.user.id, false);
      if (!draftQuota.allowed) {
        return NextResponse.json(
          {
            error: "Monthly draft generation limit reached. Please upgrade your plan.",
            remaining: 0,
            limit: draftQuota.limit,
          },
          { status: 403 }
        );
      }
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
      finalDraft = draft.replace(/\[COMPANY\s*NAME\]/gi, requirement.project.companyName);
    }

    // Update requirement with draft and create version in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Create version entry for the previous state if there was a draft
      if (requirement.draftAnswer !== null) {
        await tx.requirementVersion.create({
          data: {
            requirementId: id,
            draftAnswer: requirement.draftAnswer,
            status: requirement.status,
            editedById: session.user.id,
            changeSource: "ai_generated",
          },
        });
      }

      // Update the requirement
      return tx.requirement.update({
        where: { id },
        data: {
          draftAnswer: finalDraft,
          status: "PARTIAL",
          requiresReview,
        },
      });
    });

    // Consume draft quota after successful generation
    if (isSingleUseProject) {
      await checkAndConsumeSingleUseDraft(session.user.id);
    } else {
      await checkAndIncrementDraftQuota(session.user.id, true);
    }

    // Log the draft generation
    await logAudit({
      userId: session.user.id,
      action: AuditAction.REQUIREMENT_GENERATE_DRAFT,
      resource: AuditResource.REQUIREMENT,
      resourceId: id,
      details: {
        projectId: requirement.projectId,
        requirementType: requirement.type,
        domainContext: requirement.domainContext,
        requiresReview,
      },
      request,
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
