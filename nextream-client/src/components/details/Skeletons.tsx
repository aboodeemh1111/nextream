/**
 * Detail-page loading state, shaped like the page it stands in for.
 *
 * The old view showed one centred spinner on a black screen, so every visit
 * flashed empty and then jumped as the billboard pushed the content down.
 * Holding the hero's height keeps that reflow out of the first second.
 */
export function DetailsSkeleton() {
  return (
    <>
      <div className="relative h-[78vh] min-h-[520px] w-full overflow-hidden">
        <div className="nx-skeleton absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-nx-bg via-nx-bg/50 to-transparent" />

        <div className="relative flex h-full flex-col justify-end gap-4 px-4 pb-16 md:px-12 md:pb-20">
          <div className="nx-skeleton h-12 w-3/4 max-w-lg rounded" />
          <div className="nx-skeleton h-4 w-1/2 max-w-sm rounded" />
          <div className="nx-skeleton h-4 w-full max-w-2xl rounded" />
          <div className="nx-skeleton h-4 w-2/3 max-w-xl rounded" />
          <div className="mt-2 flex gap-3">
            <div className="nx-skeleton h-12 w-36 rounded-md" />
            <div className="nx-skeleton h-12 w-32 rounded-md" />
            <div className="nx-skeleton h-11 w-11 rounded-full" />
            <div className="nx-skeleton h-11 w-11 rounded-full" />
            <div className="nx-skeleton h-11 w-11 rounded-full" />
          </div>
        </div>
      </div>

      <div className="px-4 py-10 md:px-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="nx-skeleton h-6 w-40 rounded" />
            <div className="nx-skeleton h-4 w-full rounded" />
            <div className="nx-skeleton h-4 w-full rounded" />
            <div className="nx-skeleton h-4 w-4/5 rounded" />
          </div>
          <div className="nx-skeleton h-44 w-full rounded-xl" />
        </div>
      </div>
    </>
  );
}
