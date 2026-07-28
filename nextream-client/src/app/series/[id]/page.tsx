"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FaArrowLeft,
  FaExclamationTriangle,
  FaFilm,
  FaPlay,
} from "react-icons/fa";
import Navbar from "@/components/Navbar";
import Art from "@/components/series/Art";
import { MetaLine, Pill, ProgressBar } from "@/components/series/Bits";
import MyListButton from "@/components/series/MyListButton";
import EpisodeList from "@/components/series/EpisodeList";
import SeasonList from "@/components/series/SeasonList";
import SeriesCard from "@/components/series/SeriesCard";
import {
  BillboardSkeleton,
  EpisodeListSkeleton,
} from "@/components/series/Skeletons";
import { useAuth } from "@/context/AuthContext";
import {
  Episode,
  ShowPage,
  episodeCode,
  formatAirDate,
  isPlayableVideo,
  matchScore,
  playLabel,
  seasonLabel,
  showBackdrop,
  showMeta,
  tv,
} from "@/lib/tv";
import { cn } from "@/lib/cn";

type Tab = "episodes" | "similar" | "details";
type EpisodesView = "seasons" | "episodes";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "episodes", label: "Episodes" },
  { id: "similar", label: "More Like This" },
  { id: "details", label: "Details" },
];

export default function ShowPageView() {
  const { id } = useParams();
  const showId = Array.isArray(id) ? id[0] : id || "";
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<ShowPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("episodes");
  const [episodesView, setEpisodesView] = useState<EpisodesView>("seasons");
  const [seasonNumber, setSeasonNumber] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  // See the note on the series hub: AuthProvider hydrates in a parent effect,
  // which runs after this one, so `user` is null on the first pass either way.
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const ready = !authLoading && Boolean(user);

  useEffect(() => {
    if (!ready || !showId) return;
    let cancelled = false;

    setLoading(true);
    tv.show(showId)
      .then((page) => {
        if (cancelled) return;
        setData(page);
        // Prefetch the active season's episodes so opening it is instant,
        // but keep the Episodes tab on the season list first.
        setSeasonNumber(page.activeSeasonNumber);
        setEpisodes(page.episodes);
        setEpisodesView("seasons");
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.status === 404
            ? "That series isn't available."
            : "We couldn't load this series."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, showId]);

  const openSeason = useCallback(
    async (next: number) => {
      if (!showId) return;

      setEpisodesView("episodes");

      // Reuse the list already loaded for this season (active season from
      // show fetch, or a prior drill-down).
      if (next === seasonNumber && episodes.length > 0) {
        setSeasonNumber(next);
        return;
      }

      setSeasonNumber(next);
      setEpisodesLoading(true);
      try {
        setEpisodes(await tv.seasonEpisodes(showId, next));
      } catch {
        setEpisodes([]);
      } finally {
        setEpisodesLoading(false);
      }
    },
    [showId, seasonNumber, episodes.length]
  );

  const backToSeasons = useCallback(() => {
    setEpisodesView("seasons");
  }, []);

  const handleListChange = useCallback((changedId: string, inMyList: boolean) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        show: prev.show._id === changedId ? { ...prev.show, inMyList } : prev.show,
        similar: prev.similar.map((item) =>
          item._id === changedId ? { ...item, inMyList } : item
        ),
      };
    });
  }, []);

  if (!ready || loading) {
    return (
      <main className="min-h-screen bg-nx-bg">
        <Navbar />
        <BillboardSkeleton />
        <div className="px-4 py-10 md:px-12">
          <EpisodeListSkeleton />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen flex-col bg-nx-bg text-nx-ink">
        <Navbar />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-nx-surface text-nx-accent">
            <FaExclamationTriangle />
          </span>
          <p className="text-lg font-semibold">{error || "Series not found"}</p>
          <Link
            href="/series"
            className="mt-6 rounded-md bg-nx-ink px-5 py-2 text-sm font-semibold text-nx-black transition hover:bg-white"
          >
            Back to Series
          </Link>
        </div>
      </main>
    );
  }

  const { show, seasons, nextUp, similar, watchedCount, totalEpisodes } = data;
  const match = matchScore(show.rating);
  const progressPercent = totalEpisodes ? (watchedCount / totalEpisodes) * 100 : 0;

  const watchHref = nextUp
    ? nextUp.resumeSec > 0
      ? `/watch/episode/${nextUp.episode._id}?t=${Math.floor(nextUp.resumeSec)}`
      : `/watch/episode/${nextUp.episode._id}`
    : null;

  return (
    <main className="min-h-screen bg-nx-bg text-nx-ink">
      <Navbar />

      <section className="relative min-h-[58vh] w-full sm:min-h-[66vh]">
        <div className="absolute inset-0 overflow-hidden bg-nx-black">
          <Art
            src={showBackdrop(show)}
            alt={show.title}
            priority
            sizes="100vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-nx-bg via-nx-bg/55 to-nx-bg/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-nx-bg/90 via-transparent to-transparent" />
        </div>

        <div className="relative flex min-h-[58vh] flex-col justify-end px-4 pb-10 pt-24 sm:min-h-[66vh] md:px-12">
          <Link
            href="/series"
            className="mb-auto inline-flex w-fit items-center gap-2 rounded-full border border-nx-line bg-black/40 px-3 py-1.5 text-xs text-nx-ink backdrop-blur transition hover:bg-black/70"
          >
            <FaArrowLeft className="text-[10px]" /> All series
          </Link>

          <div className="max-w-2xl animate-nx-rise">
            <h1 className="nx-text-shadow text-3xl font-extrabold leading-tight sm:text-5xl">
              {show.title}
            </h1>

            <MetaLine
              parts={[
                match ? `${match}% Match` : null,
                ...showMeta(show, {
                  seasonsCount: seasons.length,
                  episodesCount: totalEpisodes,
                }),
                show.status === "ended" ? "Complete series" : "Ongoing",
              ]}
              className="mt-3 text-sm font-medium text-nx-ink/90"
            />

            {show.genres?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {show.genres.slice(0, 5).map((genre) => (
                  <Link key={genre} href={`/series?genre=${encodeURIComponent(genre)}`}>
                    <Pill tone="outline" className="border-white/25 hover:text-nx-ink">
                      {genre}
                    </Pill>
                  </Link>
                ))}
              </div>
            ) : null}

            {show.overview && (
              <p className="nx-text-shadow mt-4 max-w-xl text-sm leading-relaxed text-nx-ink/85 sm:text-base">
                {show.overview}
              </p>
            )}

            {nextUp && nextUp.reason !== "start" && (
              <p className="mt-4 text-xs font-medium text-nx-muted">
                {nextUp.reason === "resume" ? "Resume" : "Up next"}:{" "}
                {episodeCode(nextUp.episode)} &middot; {nextUp.episode.title}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {watchHref ? (
                <Link
                  href={watchHref}
                  className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:bg-white/85"
                >
                  <FaPlay /> {playLabel(nextUp)}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-md bg-white/20 px-6 py-2.5 text-sm font-bold text-nx-muted">
                  <FaPlay /> No episodes yet
                </span>
              )}

              <MyListButton
                showId={show._id}
                inMyList={show.inMyList}
                onChange={handleListChange}
                variant="full"
              />

              {isPlayableVideo(show.trailerUrl) && (
                <a
                  href={show.trailerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-nx-line bg-white/10 px-5 py-2.5 text-sm font-semibold text-nx-ink backdrop-blur transition hover:bg-white/20"
                >
                  <FaFilm /> Trailer
                </a>
              )}
            </div>

            {totalEpisodes > 0 && watchedCount > 0 && (
              <div className="mt-6 max-w-xs">
                <p className="mb-1.5 text-xs text-nx-muted">
                  {watchedCount} of {totalEpisodes} episodes watched
                </p>
                <ProgressBar percent={progressPercent} className="rounded-full" />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="sticky top-0 z-30 border-b border-nx-line bg-nx-bg/85 backdrop-blur-xl">
        <div className="flex gap-1 overflow-x-auto px-4 md:px-12">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              aria-current={tab === entry.id ? "page" : undefined}
              className={cn(
                "relative shrink-0 px-4 py-3.5 text-sm font-semibold transition",
                tab === entry.id ? "text-nx-ink" : "text-nx-muted hover:text-nx-ink"
              )}
            >
              {entry.label}
              {entry.id === "similar" && similar.length > 0 && (
                <span className="ml-1.5 text-xs text-nx-dim">{similar.length}</span>
              )}
              {tab === entry.id && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-nx-accent" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-24 pt-6 md:px-12">
        {tab === "episodes" &&
          (episodesView === "seasons" ? (
            <SeasonList
              seasons={seasons}
              activeSeasonNumber={data.activeSeasonNumber}
              onSelect={openSeason}
              fallbackArt={showBackdrop(show)}
            />
          ) : (
            <>
              <div className="mb-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={backToSeasons}
                  className="inline-flex items-center gap-2 rounded-md border border-nx-line bg-nx-surface px-3 py-2 text-sm font-semibold text-nx-ink transition hover:bg-white/10 focus:outline-none focus-visible:nx-focus"
                >
                  <FaArrowLeft className="text-[10px]" />
                  Seasons
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-nx-ink">
                    {seasonNumber != null
                      ? seasonLabel(
                          seasons.find((s) => s.seasonNumber === seasonNumber) || {
                            seasonNumber,
                          }
                        )
                      : "Episodes"}
                  </p>
                  <p className="text-xs text-nx-dim">
                    {episodes.length} episode{episodes.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <EpisodeList
                episodes={episodes}
                loading={episodesLoading}
                activeEpisodeId={nextUp?.episode?._id}
                fallbackStill={showBackdrop(show)}
              />
            </>
          ))}

        {tab === "similar" &&
          (similar.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {similar.map((item) => (
                <SeriesCard key={item._id} show={item} onListChange={handleListChange} />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-nx-muted">
              Nothing comparable in the catalogue yet.
            </p>
          ))}

        {tab === "details" && (
          <dl className="grid max-w-3xl gap-x-10 gap-y-4 sm:grid-cols-2">
            <Detail label="Status">
              {show.status === "ended" ? "Complete series" : "Ongoing"}
            </Detail>
            <Detail label="Seasons">{seasons.length || show.seasonsCount || 0}</Detail>
            <Detail label="Episodes">{totalEpisodes}</Detail>
            <Detail label="First released">{show.releaseYear || "—"}</Detail>
            <Detail label="Latest episode">
              {formatAirDate(show.lastAirDate) || "—"}
            </Detail>
            <Detail label="Rating">
              {show.rating ? `${show.rating.toFixed(1)} / 10` : "Not yet rated"}
            </Detail>
            <Detail label="Genres">{show.genres?.join(", ") || "—"}</Detail>
            <Detail label="Tags">{show.tags?.join(", ") || "—"}</Detail>
          </dl>
        )}
      </div>
    </main>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-nx-line pb-3">
      <dt className="text-xs uppercase tracking-wider text-nx-dim">{label}</dt>
      <dd className="mt-1 text-sm text-nx-ink">{children}</dd>
    </div>
  );
}
