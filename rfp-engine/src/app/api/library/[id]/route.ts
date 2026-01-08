/**
 * /api/library/[id]
 *
 * GET - Get a single past response by ID
 * PATCH - Update a past response (title, content, tags)
 * DELETE - Delete a past response
 * POST - Track usage (increment usageCount when response is inserted)
 *
 * SECURITY:
 * - All operations require authentication
 * - All operations verify ownership (userId matches session)
 * - Input validation on updates
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";

// Validation constants
const MAX_TITLE_LENGTH = 255;
const MAX_CONTENT_LENGTH = 51200; // 50KB
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/library/[id]
 * Get a single past response
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const response = await prisma.pastResponse.findFirst({
      where: {
        id,
        userId: session.user.id, // Ensure ownership
      },
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!response) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Library GET [id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch response" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/library/[id]
 * Update a past response
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify ownership first
    const existing = await prisma.pastResponse.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, content, tags } = body;

    // Build update data
    const updateData: {
      title?: string;
      content?: string;
      tags?: string[];
    } = {};

    // Validate and add title if provided
    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json(
          { error: "Title cannot be empty" },
          { status: 400 }
        );
      }
      if (title.length > MAX_TITLE_LENGTH) {
        return NextResponse.json(
          { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }

    // Validate and add content if provided
    if (content !== undefined) {
      if (typeof content !== "string" || content.length === 0) {
        return NextResponse.json(
          { error: "Content cannot be empty" },
          { status: 400 }
        );
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
          { error: `Content must be ${MAX_CONTENT_LENGTH} characters or less` },
          { status: 400 }
        );
      }
      updateData.content = content;
    }

    // Validate and add tags if provided
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return NextResponse.json(
          { error: "Tags must be an array" },
          { status: 400 }
        );
      }
      if (tags.length > MAX_TAGS) {
        return NextResponse.json(
          { error: `Maximum ${MAX_TAGS} tags allowed` },
          { status: 400 }
        );
      }

      // Sanitize tags
      const sanitizedTags = tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && tag.length <= MAX_TAG_LENGTH)
        .slice(0, MAX_TAGS);

      updateData.tags = [...new Set(sanitizedTags)];
    }

    // Must have something to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Perform update
    const updated = await prisma.pastResponse.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log (fire-and-forget for performance)
    logAudit({
      userId: session.user.id,
      action: AuditAction.LIBRARY_RESPONSE_UPDATE,
      resource: AuditResource.LIBRARY,
      resourceId: id,
      details: {
        updatedFields: Object.keys(updateData),
      },
      request,
    }).catch((err) => console.error("Audit log failed:", err));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Library PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update response" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/library/[id]
 * Delete a past response
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify ownership first
    const existing = await prisma.pastResponse.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    // Delete the response
    await prisma.pastResponse.delete({
      where: { id },
    });

    // Audit log (fire-and-forget for performance)
    logAudit({
      userId: session.user.id,
      action: AuditAction.LIBRARY_RESPONSE_DELETE,
      resource: AuditResource.LIBRARY,
      resourceId: id,
      details: {
        title: existing.title,
      },
      request,
    }).catch((err) => console.error("Audit log failed:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Library DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete response" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/library/[id]
 * Track usage - increment usageCount when a response is used/inserted
 *
 * Body: { action: "use", requirementId?: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify ownership first
    const existing = await prisma.pastResponse.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action, requirementId } = body;

    if (action !== "use") {
      return NextResponse.json(
        { error: "Invalid action. Only 'use' is supported." },
        { status: 400 }
      );
    }

    // Increment usage count
    const updated = await prisma.pastResponse.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log (fire-and-forget for performance)
    logAudit({
      userId: session.user.id,
      action: AuditAction.LIBRARY_RESPONSE_USED,
      resource: AuditResource.LIBRARY,
      resourceId: id,
      details: {
        requirementId: requirementId || null,
        newUsageCount: updated.usageCount,
      },
      request,
    }).catch((err) => console.error("Audit log failed:", err));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Library POST [id] error:", error);
    return NextResponse.json(
      { error: "Failed to track usage" },
      { status: 500 }
    );
  }
}
