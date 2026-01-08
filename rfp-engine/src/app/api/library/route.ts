/**
 * /api/library
 *
 * GET - List all past responses for the authenticated user
 * POST - Create a new past response
 *
 * SECURITY:
 * - All queries filter by authenticated user's ID
 * - Input validation on title, content, and tags
 * - Rate limiting to prevent abuse
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";

// Rate limiting: max 50 requests per user per minute
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(userId);

  if (!record || now > record.resetAt) {
    requestCounts.set(userId, { count: 1, resetAt: now + 60000 }); // 1 minute
    return true;
  }

  if (record.count >= 50) {
    return false;
  }

  record.count++;
  return true;
}

// Validation constants
const MAX_TITLE_LENGTH = 255;
const MAX_CONTENT_LENGTH = 51200; // 50KB
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

/**
 * GET /api/library
 * List past responses with optional search, tag filter, and sorting
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const tagsParam = searchParams.get("tags") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Parse tags filter
    const filterTags = tagsParam
      ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    // Build where clause
    const where: {
      userId: string;
      OR?: Array<{ title: { contains: string; mode: "insensitive" } } | { content: { contains: string; mode: "insensitive" } }>;
      tags?: { hasSome: string[] };
    } = {
      userId: session.user.id,
    };

    // Search in title and content
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by tags (any match)
    if (filterTags.length > 0) {
      where.tags = { hasSome: filterTags };
    }

    // Validate sort field
    const allowedSortFields = ["createdAt", "updatedAt", "usageCount", "title"];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const orderDirection = sortOrder === "asc" ? "asc" : "desc";

    // Fetch responses
    const [responses, totalCount] = await Promise.all([
      prisma.pastResponse.findMany({
        where,
        orderBy: { [orderField]: orderDirection },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          content: true,
          tags: true,
          usageCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.pastResponse.count({ where }),
    ]);

    // Get all unique tags for the user (for filter suggestions)
    const allTags = await prisma.pastResponse.findMany({
      where: { userId: session.user.id },
      select: { tags: true },
    });
    const uniqueTags = [...new Set(allTags.flatMap((r) => r.tags))].sort();

    return NextResponse.json({
      responses,
      totalCount,
      availableTags: uniqueTags,
    });
  } catch (error) {
    console.error("Library GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch library responses" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/library
 * Create a new past response
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { title, content, tags = [] } = body;

    // Validate title
    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Validate content
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Content must be ${MAX_CONTENT_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Validate tags
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

    // Remove duplicates
    const uniqueTags = [...new Set(sanitizedTags)];

    // Create the response
    const response = await prisma.pastResponse.create({
      data: {
        userId: session.user.id,
        title: title.trim(),
        content,
        tags: uniqueTags,
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

    // Audit log
    await logAudit({
      userId: session.user.id,
      action: AuditAction.LIBRARY_RESPONSE_CREATE,
      resource: AuditResource.LIBRARY,
      resourceId: response.id,
      details: {
        title: response.title,
        tagCount: uniqueTags.length,
      },
      request,
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Library POST error:", error);
    return NextResponse.json(
      { error: "Failed to create library response" },
      { status: 500 }
    );
  }
}
