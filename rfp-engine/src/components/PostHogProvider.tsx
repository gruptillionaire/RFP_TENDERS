"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, capturePageview } from "@/lib/posthog";
import { isCookieCategoryAllowed } from "@/lib/cookies";

function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only track if analytics cookies are consented
    if (isCookieCategoryAllowed("analytics") && pathname) {
      capturePageview(pathname);
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only initialize if analytics cookies are consented
    if (isCookieCategoryAllowed("analytics")) {
      initPostHog();
    }
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </>
  );
}
