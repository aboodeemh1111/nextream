"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaExclamationTriangle, FaFilm } from "react-icons/fa";
import Navbar from "@/components/Navbar";
import NeuralRow from "@/components/discover/NeuralRow";
import HomeBillboard from "@/components/home/HomeBillboard";
import HomeRow from "@/components/home/HomeRow";
import { BillboardSkeleton, RowSkeleton } from "@/components/series/Skeletons";
import { useAuth } from "@/context/AuthContext";
import { useDiscovery } from "@/context/DiscoveryContext";
import {
  ContinueItem,
  HomeFeed,
  HomeRowData,
  MediaItem,
  home,
} from "@/lib/home";

/**
 * The home page.
 *
 * Previously this rendered whatever curated `List` documents happened to exist,
 * in whatever order Mongo returned them — and only ever from the Movie
 * collection, so the TVShow catalogue the admin app manages never appeared
 * here at all. Both halves are replaced: one `/home/feed` call returns movies
 * and series ranked together per viewer, and every row states what it ranked on.
 *
 * The page holds the feed in state rather than refetching after a My List
 * toggle: a title appears in several rows, the ranking is expensive, and a
 * refetch would reshuffle the page under the viewer's cursor as a side effect
 * of pressing "+".
 */

/** Rewrites list state wherever a title appears, so every row agrees. */
function syncListState(feed: HomeFeed, uid: string, inMyList: boolean): HomeFeed {
  const patch = (item: MediaItem) => (item.uid === uid ? { ...item, inMyList } : item);

  return {
    ...feed,
    hero: feed.hero && feed.hero.uid === uid ? { ...feed.hero, inMyList } : feed.hero,
    rows: feed.rows.map((row) =>
      row.kind === "continue"
        ? {
            ...row,
            items: row.items.map((entry) => ({ ...entry, item: patch(entry.item) })),
          }
        : { ...row, items: row.items.map(patch) }
    ),
  };
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { ready: modelReady, personalised } = useDiscovery();
  const router = useRouter();

  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // AuthProvider hydrates from localStorage in an effect, and a parent's effect
  // runs *after* its children's — so deciding on `user` alone bounces a
  // signed-in viewer to /login on any hard load of this page.
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const ready = !authLoading && Boolean(user);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    setLoading(true);
    home
      .feed()
      .then((data) => {
        if (cancelled) return;
        setFeed({
          hero: data?.hero ?? null,
          rows: Array.isArray(data?.rows) ? data.rows : [],
          profile: data?.profile ?? { personalised: false, topGenres: [] },
          degraded: data?.degraded,
        });
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load your recommendations.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, reloadToken]);

  const handleListChange = useCallback((uid: string, inMyList: boolean) => {
    setFeed((prev) => (prev ? syncListState(prev, uid, inMyList) : prev));
  }, []);

  const handleContinueRemoved = useCallback((uid: string) => {
    setFeed((prev) => {
      if (!prev) return prev;
      const rows = prev.rows
        .map((row) =>
          row.kind === "continue"
            ? {
                ...row,
                items: (row.items as ContinueItem[]).filter((entry) => entry.item.uid !== uid),
              }
            : row
        )
        .filter((row) => row.items.length > 0);
      return { ...prev, rows: rows as HomeRowData[] };
    });
  }, []);

  if (!ready || loading) {
    return (
      <main className="min-h-screen bg-nx-bg">
        <Navbar />
        <BillboardSkeleton />
        <div className="relative -mt-10 space-y-3 pb-16 sm:-mt-16 md:-mt-24 md:space-y-6">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-nx-bg text-nx-ink">
        <Navbar />
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
          <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-nx-surface text-lg text-nx-accent ring-1 ring-white/10">
            <FaExclamationTriangle />
          </span>
          <p className="text-lg font-bold">{error}</p>
          <p className="mt-1.5 text-sm text-nx-muted">
            The catalogue service may be waking up. Give it another go.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setReloadToken((token) => token + 1);
            }}
            className="mt-6 rounded-lg bg-nx-ink px-6 py-2.5 text-sm font-bold text-nx-black transition hover:bg-white focus:outline-none focus-visible:nx-focus"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const hasContent = Boolean(feed?.hero) || Boolean(feed?.rows.length);

  return (
    <main className="min-h-screen bg-nx-bg text-nx-ink">
      <Navbar />

      {feed?.hero ? (
        <HomeBillboard hero={feed.hero} onListChange={handleListChange} />
      ) : (
        // The navbar is fixed, so a page with no billboard has to give its
        // height back or the first row starts underneath it.
        <div className="h-14" aria-hidden />
      )}

      {hasContent ? (
        <>
          {/* Rows ride up over the billboard's fade, the way every streaming
              landing page seats its first row. */}
          <div className="relative z-10 -mt-10 space-y-3 pb-24 sm:-mt-16 md:-mt-24 md:space-y-6">
            {feed?.rows.map((row, index) => (
              <Fragment key={row.key}>
                <HomeRow
                  row={row}
                  onListChange={handleListChange}
                  onContinueRemoved={handleContinueRemoved}
                />

                {/* The on-device row sits second rather than first. The server
                    knows about Continue Watching and about titles published
                    minutes ago; the browser knows what was scrolled past and
                    what was hovered. Leading with the one that cannot be wrong
                    about what is unfinished, and following it with the one that
                    learns, is the honest order — and it means a viewer whose
                    engine has not booted yet sees no gap. */}
                {index === 0 && modelReady && (
                  <NeuralRow
                    title={personalised ? "Learned from this device" : "Ranked on this device"}
                    subtitle={
                      personalised
                        ? "Ranked in your browser from what you watched, hovered and skipped"
                        : "Ranked in your browser — it starts learning as you watch"
                    }
                    options={{ limit: 20, surface: "home" }}
                  />
                )}
              </Fragment>
            ))}
          </div>

          {/* Cold start: the ranking has nothing to work from, and the fastest
              way out of that is to say so rather than to keep serving the same
              popularity ordering and hope. */}
          {feed && !feed.profile.personalised && (
            <div className="mx-auto mb-20 max-w-2xl px-4 text-center">
              <p className="text-sm text-nx-muted">
                These are the catalogue&apos;s most popular titles. Watch something, or add
                it to your list, and this page starts ranking around you.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-28 text-center">
          <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-nx-surface text-lg text-nx-dim ring-1 ring-white/10">
            <FaFilm />
          </span>
          <p className="text-lg font-bold">Nothing published yet</p>
          <p className="mt-1.5 max-w-sm text-sm text-nx-muted">
            {feed?.degraded === "DB_UNAVAILABLE"
              ? "The catalogue database is not reachable from the API right now."
              : "Films and series appear here as soon as they are published in the admin panel."}
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/movies"
              className="rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/20"
            >
              Browse movies
            </Link>
            <Link
              href="/series"
              className="rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/20"
            >
              Browse series
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
