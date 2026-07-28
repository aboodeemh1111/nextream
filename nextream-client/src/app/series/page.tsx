"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaExclamationTriangle, FaTv } from "react-icons/fa";
import Navbar from "@/components/Navbar";
import SeriesBillboard from "@/components/series/SeriesBillboard";
import SeriesRow from "@/components/series/SeriesRow";
import SeriesGrid from "@/components/series/SeriesGrid";
import SeriesFilterBar, {
  DEFAULT_FILTERS,
  SeriesFilters,
  hasActiveFilters,
} from "@/components/series/SeriesFilterBar";
import {
  BillboardSkeleton,
  RowSkeleton,
} from "@/components/series/Skeletons";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import { useAuth } from "@/context/AuthContext";
import {
  ContinueEntry,
  GenreFacet,
  HubResponse,
  HubRow,
  TVShow,
  tv,
} from "@/lib/tv";

const PAGE_SIZE = 24;

interface BrowseState {
  items: TVShow[];
  page: number;
  hasMore: boolean;
  total: number;
}

/** Rewrites My List state wherever a show appears, so every row agrees. */
function syncHubListState(hub: HubResponse, showId: string, inMyList: boolean): HubResponse {
  const patchShow = (show: TVShow) =>
    show._id === showId ? { ...show, inMyList } : show;

  return {
    hero: hub.hero ? { ...hub.hero, show: patchShow(hub.hero.show) } : null,
    rows: hub.rows.map((row) =>
      row.kind === "continue"
        ? {
            ...row,
            items: (row.items as ContinueEntry[]).map((entry) => ({
              ...entry,
              show: patchShow(entry.show),
            })),
          }
        : { ...row, items: (row.items as TVShow[]).map(patchShow) }
    ),
  };
}

function SeriesBrowser() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<SeriesFilters>(() => ({
    q: searchParams.get("q") || "",
    genre: searchParams.get("genre") || "",
    status: searchParams.get("status") || "",
    sort: searchParams.get("sort") || DEFAULT_FILTERS.sort,
  }));

  const [genres, setGenres] = useState<GenreFacet[]>([]);
  const [hub, setHub] = useState<HubResponse | null>(null);
  const [hubLoading, setHubLoading] = useState(true);
  const [browse, setBrowse] = useState<BrowseState | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Only the query needs settling; chips and selects fire once per interaction.
  const debouncedQuery = useDebouncedValue(filters.q, 350);
  const effective = useMemo<SeriesFilters>(
    () => ({ ...filters, q: debouncedQuery }),
    [filters, debouncedQuery]
  );
  const browsing = hasActiveFilters(effective);

  // AuthProvider hydrates from localStorage in an effect, and a parent's effect
  // runs *after* its children's — so deciding on `user` alone bounces a
  // signed-in viewer to /login on any hard load of this page.
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const ready = !authLoading && Boolean(user);

  // Keep the URL in step so a filtered view is shareable and the back button
  // works. history.replaceState rather than router.replace: this should not
  // push a navigation or re-run the route on every keystroke.
  useEffect(() => {
    const params = new URLSearchParams();
    if (effective.q.trim()) params.set("q", effective.q.trim());
    if (effective.genre) params.set("genre", effective.genre);
    if (effective.status) params.set("status", effective.status);
    if (effective.sort !== DEFAULT_FILTERS.sort) params.set("sort", effective.sort);

    const query = params.toString();
    window.history.replaceState(null, "", query ? `/series?${query}` : "/series");
  }, [effective]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    tv.genres()
      .then((data) => !cancelled && setGenres(data))
      .catch(() => !cancelled && setGenres([]));

    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    setHubLoading(true);
    tv.hub()
      .then((data) => {
        if (cancelled) return;
        setHub(data);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load the series catalogue.");
      })
      .finally(() => {
        if (!cancelled) setHubLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, reloadToken]);

  useEffect(() => {
    if (!ready || !browsing) return;
    let cancelled = false;

    setBrowseLoading(true);
    tv.browse({ ...effective, page: 1, pageSize: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setBrowse({
          items: res.data,
          page: res.page,
          hasMore: res.hasMore,
          total: res.total,
        });
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load those results.");
      })
      .finally(() => {
        if (!cancelled) setBrowseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, browsing, effective, reloadToken]);

  // Read through a ref: the observer in SeriesGrid holds this callback across
  // renders, and a stale copy would refetch page 2 forever.
  const loadMoreRef = useRef<() => void>(() => {});
  loadMoreRef.current = async () => {
    if (!browse?.hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const res = await tv.browse({
        ...effective,
        page: browse.page + 1,
        pageSize: PAGE_SIZE,
      });
      setBrowse((prev) =>
        prev
          ? {
              items: [...prev.items, ...res.data],
              page: res.page,
              hasMore: res.hasMore,
              total: res.total,
            }
          : prev
      );
    } catch {
      // Leave what is already on screen; the sentinel retries on next scroll.
    } finally {
      setLoadingMore(false);
    }
  };
  const loadMore = useCallback(() => loadMoreRef.current(), []);

  const handleListChange = useCallback((showId: string, inMyList: boolean) => {
    setHub((prev) => (prev ? syncHubListState(prev, showId, inMyList) : prev));
    setBrowse((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((show) =>
              show._id === showId ? { ...show, inMyList } : show
            ),
          }
        : prev
    );
  }, []);

  const handleContinueRemoved = useCallback((showId: string) => {
    setHub((prev) => {
      if (!prev) return prev;
      const rows = prev.rows
        .map((row) =>
          row.kind === "continue"
            ? {
                ...row,
                items: (row.items as ContinueEntry[]).filter(
                  (entry) => entry.show._id !== showId
                ),
              }
            : row
        )
        .filter((row) => row.items.length > 0);
      return { ...prev, rows: rows as HubRow[] };
    });
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen bg-nx-bg">
        <Navbar />
        <BillboardSkeleton />
        <div className="-mt-16 relative space-y-2 pb-16">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </main>
    );
  }

  const showBillboard = !browsing;

  return (
    <main className="min-h-screen bg-nx-bg text-nx-ink">
      <Navbar />

      {showBillboard ? (
        hubLoading ? (
          <BillboardSkeleton />
        ) : hub?.hero ? (
          <SeriesBillboard
            show={hub.hero.show}
            nextUp={hub.hero.nextUp}
            onListChange={handleListChange}
          />
        ) : null
      ) : null}

      <SeriesFilterBar
        genres={genres}
        filters={filters}
        onChange={setFilters}
        resultCount={browsing ? browse?.total ?? null : null}
      />

      {error ? (
        <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
          <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-nx-surface text-nx-accent">
            <FaExclamationTriangle />
          </span>
          <p className="text-lg font-semibold">{error}</p>
          <p className="mt-1 text-sm text-nx-muted">
            The catalogue service may be waking up. Give it another go.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setReloadToken((token) => token + 1);
            }}
            className="mt-6 rounded-md bg-nx-ink px-5 py-2 text-sm font-semibold text-nx-black transition hover:bg-white"
          >
            Try again
          </button>
        </div>
      ) : browsing ? (
        <SeriesGrid
          shows={browse?.items || []}
          loading={browseLoading && !browse}
          loadingMore={loadingMore}
          hasMore={Boolean(browse?.hasMore)}
          onLoadMore={loadMore}
          onListChange={handleListChange}
        />
      ) : hubLoading ? (
        <div className="space-y-2 py-6">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : hub?.rows.length ? (
        // Rows ride up over the billboard's fade, the way every streaming
        // landing page seats its first row.
        <div className="relative z-10 -mt-10 space-y-2 pb-20 sm:-mt-16">
          {hub.rows.map((row) => (
            <SeriesRow
              key={row.key}
              row={row}
              onListChange={handleListChange}
              onContinueRemoved={handleContinueRemoved}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
          <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-nx-surface text-nx-dim">
            <FaTv />
          </span>
          <p className="text-lg font-semibold">No series published yet</p>
          <p className="mt-1 max-w-sm text-sm text-nx-muted">
            Shows appear here as soon as they are published in the admin panel.
          </p>
        </div>
      )}
    </main>
  );
}

export default function SeriesPage() {
  // useSearchParams opts the tree into client rendering; the boundary keeps the
  // rest of the route prerenderable.
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-nx-bg">
          <Navbar />
          <BillboardSkeleton />
        </main>
      }
    >
      <SeriesBrowser />
    </Suspense>
  );
}
