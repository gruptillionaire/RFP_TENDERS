import { Skeleton } from "./skeleton";

/**
 * Skeleton card for library response items
 */
export function LibraryCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <Skeleton className="h-5 w-3/4 mb-2" />
          {/* Content preview - 2 lines */}
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-5/6 mb-3" />
          {/* Tags */}
          <div className="flex gap-2 mb-3">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          {/* Meta info */}
          <div className="flex gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Skeleton className="h-8 w-14 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton card for project items on dashboard
 */
export function ProjectCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Project name */}
          <Skeleton className="h-5 w-2/3 mb-2" />
          {/* Status badge */}
          <Skeleton className="h-5 w-20 rounded-full mb-3" />
          {/* Stats row */}
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        {/* Action button */}
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
    </div>
  );
}

/**
 * Grid of skeleton cards for library loading state
 */
export function LibrarySkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <LibraryCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Grid of skeleton cards for dashboard projects loading state
 */
export function ProjectSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}
