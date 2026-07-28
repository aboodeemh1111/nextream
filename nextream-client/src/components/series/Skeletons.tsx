import { cn } from "@/lib/cn";
import { GUTTER } from "./Bits";

/**
 * Loading placeholders shaped like the content they stand in for.
 *
 * The previous series page rendered a single centred spinner for the whole
 * view, so every load flashed an empty page and then reflowed. These hold the
 * layout, which keeps the scroll position stable when data lands.
 */

export function BillboardSkeleton({ header }: { header?: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[600px] w-full flex-col overflow-hidden sm:min-h-[80vh]">
      <div className="nx-skeleton absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-nx-bg via-nx-bg/45 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/75 to-transparent" />

      {header}

      <div
        className={cn(
          "relative mt-auto flex flex-col gap-4 pb-20 sm:pb-24 md:pb-36",
          GUTTER
        )}
      >
        <div className="nx-skeleton h-12 w-2/3 max-w-md rounded-lg" />
        <div className="nx-skeleton h-4 w-1/2 max-w-sm rounded" />
        <div className="nx-skeleton h-4 w-full max-w-lg rounded" />
        <div className="mt-2 flex gap-3">
          <div className="nx-skeleton h-12 w-36 rounded-lg" />
          <div className="nx-skeleton h-12 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function RowSkeleton({ tiles = 7 }: { tiles?: number }) {
  return (
    <section>
      <div className={cn("pb-1", GUTTER)}>
        <div className="nx-skeleton h-6 w-44 rounded" />
      </div>
      <div className={cn("flex gap-2.5 overflow-hidden py-5 md:gap-3", GUTTER)}>
        {Array.from({ length: tiles }).map((_, index) => (
          <div
            key={index}
            className="nx-skeleton aspect-[4/5] w-[40vw] shrink-0 rounded-xl sm:w-[27vw] md:w-[20vw] lg:w-[15.5vw] xl:w-[13vw] 2xl:w-[11.5vw]"
          />
        ))}
      </div>
    </section>
  );
}

export function GridSkeleton({ tiles = 21 }: { tiles?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {Array.from({ length: tiles }).map((_, index) => (
        <div key={index} className="nx-skeleton aspect-[4/5] w-full rounded-xl" />
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
