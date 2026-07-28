import { cn } from "@/lib/cn";

/**
 * Loading placeholders shaped like the content they stand in for.
 *
 * The previous series page rendered a single centred spinner for the whole
 * view, so every load flashed an empty page and then reflowed. These hold the
 * layout, which keeps the scroll position stable when data lands.
 */

export function BillboardSkeleton() {
  return (
    <div className="relative h-[62vh] min-h-[420px] w-full overflow-hidden sm:h-[72vh]">
      <div className="nx-skeleton absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-nx-bg via-nx-bg/40 to-transparent" />
      <div className="relative flex h-full flex-col justify-end gap-4 px-4 pb-12 md:px-12 md:pb-20">
        <div className="nx-skeleton h-10 w-2/3 max-w-md rounded" />
        <div className="nx-skeleton h-4 w-1/2 max-w-sm rounded" />
        <div className="nx-skeleton h-4 w-full max-w-lg rounded" />
        <div className="flex gap-3">
          <div className="nx-skeleton h-11 w-32 rounded-md" />
          <div className="nx-skeleton h-11 w-32 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function RowSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <section className="mb-2">
      <div className="mb-1 px-4 md:px-12">
        <div className="nx-skeleton h-6 w-48 rounded" />
      </div>
      <div className="flex gap-2 overflow-hidden px-4 py-6 md:gap-3 md:px-12">
        {Array.from({ length: tiles }).map((_, index) => (
          <div
            key={index}
            className="nx-skeleton aspect-[2/3] w-[41vw] shrink-0 rounded-lg sm:w-[28vw] md:w-[21vw] lg:w-[16vw] xl:w-[13vw]"
          />
        ))}
      </div>
    </section>
  );
}

export function GridSkeleton({ tiles = 18 }: { tiles?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: tiles }).map((_, index) => (
        <div key={index} className="nx-skeleton aspect-[2/3] w-full rounded-lg" />
      ))}
    </div>
  );
}

export function EpisodeListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-nx-line">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 py-4">
          <div className="nx-skeleton h-6 w-6 shrink-0 rounded" />
          <div className="nx-skeleton aspect-video w-32 shrink-0 rounded-md sm:w-44" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="nx-skeleton h-4 w-1/3 rounded" />
            <div className="nx-skeleton h-3 w-full rounded" />
            <div className="nx-skeleton h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn("nx-skeleton rounded", className)} />;
}
