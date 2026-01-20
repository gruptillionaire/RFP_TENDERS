"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/tooltip";

interface QuotaBannerProps {
  userPlan: string;
  quota: {
    used: number;
    limit: number;
    remaining: number;
  };
  singleUseQuota: {
    hasCredits: boolean;
    extractionsRemaining: number;
    draftsRemaining: number;
    expiresAt: Date | null;
  };
}

export function QuotaBanner({ userPlan, quota, singleUseQuota }: QuotaBannerProps) {
  // Single-Use Credit Banner
  if (singleUseQuota.hasCredits) {
    return (
      <div className="mb-4 p-4 rounded-lg border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-orange-800 flex items-center gap-1">
              Single RFP Credit Active
              <InfoTooltip content="A one-time credit purchased separately from your subscription. Used before your monthly quota." />
            </p>
            <p className="text-sm text-orange-700">
              Your next project will use your single-use credit ({singleUseQuota.extractionsRemaining} extraction{singleUseQuota.extractionsRemaining !== 1 ? 's' : ''}, {singleUseQuota.draftsRemaining} drafts remaining).
              {singleUseQuota.expiresAt && (
                <span className="ml-1">
                  Expires {new Date(singleUseQuota.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Free tier banner
  if (userPlan === "FREE") {
    return (
      <div className="mb-6 p-4 rounded-lg border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                Get started with RFP Matrix
              </p>
              <p className="text-sm text-gray-600">
                Subscribe to extract requirements and generate AI drafts for your RFPs
              </p>
            </div>
          </div>
          <Link href="/pricing">
            <Button className="bg-blue-600 hover:bg-blue-700">
              View Plans
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Business tier (unlimited)
  if (quota.limit === -1) {
    return (
      <div className="mb-6 p-4 rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900 flex items-center gap-1">
              Unlimited extractions
              <InfoTooltip content="Your Business plan includes unlimited RFP extractions each month." />
            </p>
            <p className="text-sm text-gray-600">
              {quota.used} extraction{quota.used === 1 ? "" : "s"} used this month
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Limited paid tiers
  return (
    <div className={`mb-6 p-4 rounded-lg border ${
      quota.remaining === 0
        ? "bg-red-50 border-red-200"
        : quota.remaining <= 2
        ? "bg-yellow-50 border-yellow-200"
        : "bg-blue-50 border-blue-200"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            quota.remaining === 0
              ? "bg-red-100"
              : quota.remaining <= 2
              ? "bg-yellow-100"
              : "bg-blue-100"
          }`}>
            <svg className={`w-5 h-5 ${
              quota.remaining === 0
                ? "text-red-600"
                : quota.remaining <= 2
                ? "text-yellow-600"
                : "text-blue-600"
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900 flex items-center gap-1">
              {quota.remaining === 0
                ? "Monthly limit reached"
                : `${quota.remaining} extraction${quota.remaining === 1 ? "" : "s"} remaining`}
              <InfoTooltip content="Extractions reset at the start of each billing cycle. Each new RFP upload uses one extraction." />
            </p>
            <p className="text-sm text-gray-600">
              {quota.used} of {quota.limit} extractions used this month
            </p>
          </div>
        </div>
        {quota.remaining === 0 && (
          <Link href="/pricing">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              Upgrade Plan
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
