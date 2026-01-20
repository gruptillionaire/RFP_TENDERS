import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Health check endpoint for monitoring and load balancers
 *
 * GET /api/health - Returns service health status
 *
 * Response:
 * - 200: All systems operational
 * - 503: One or more dependencies unhealthy
 */
export async function GET() {
  const start = Date.now();
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }> = {};

  // Check database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      status: "error",
      error: error instanceof Error ? error.message : "Database unreachable"
    };
  }

  // Check Redis connectivity (optional - only if configured)
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const redisStart = Date.now();
      const response = await fetch(`${redisUrl}/ping`, {
        headers: { Authorization: `Bearer ${redisToken}` },
      });
      if (response.ok) {
        checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
      } else {
        checks.redis = { status: "error", error: `HTTP ${response.status}` };
      }
    } catch (error) {
      checks.redis = {
        status: "error",
        error: error instanceof Error ? error.message : "Redis unreachable"
      };
    }
  }

  // Determine overall health
  const allHealthy = Object.values(checks).every((c) => c.status === "ok");
  const totalLatency = Date.now() - start;

  const body = {
    status: allHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    latencyMs: totalLatency,
    checks,
  };

  return NextResponse.json(body, {
    status: allHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
