"use client";

import { Card, CardContent } from "@/components/ui/card";

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
  );
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header Skeleton */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-10">
            <div className="font-extrabold text-xl text-slate-800 tracking-tight">
              RFP Matrix
            </div>
            <nav className="hidden sm:flex items-center gap-1">
              <div className="px-4 py-2 text-sm font-semibold text-[#0d9488] bg-[#f0fdfa] rounded-lg">
                Projects
              </div>
              <div className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg">
                Library
              </div>
              <div className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg">
                Settings
              </div>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </header>

      {/* Hero Section Skeleton */}
      <div className="bg-gradient-to-b from-white to-[#faf9f7] py-8 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Your Projects</h1>
              <p className="text-slate-500 mt-1">Manage your RFP and tender responses</p>
            </div>
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Quota Banner Skeleton */}
        <Card className="bg-white border-slate-200 rounded-2xl shadow-sm mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </CardContent>
        </Card>

        {/* Project Cards Skeleton */}
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white border-slate-200 rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Skeleton className="h-4 w-16 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </div>
                {/* Progress bar skeleton */}
                <div className="mt-4">
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
