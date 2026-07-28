"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FaArrowLeft,
  FaCheck,
  FaClock,
  FaExclamationTriangle,
  FaFilm,
  FaHeart,
  FaPlay,
  FaPlus,
  FaRegClock,
  FaRegHeart,
  FaStar,
} from "react-icons/fa";
import Navbar from "@/components/Navbar";
import RatingStars from "@/components/RatingStars";
import ReviewList from "@/components/ReviewList";
import { Pill, ProgressBar } from "@/components/series/Bits";
import CircleAction from "@/components/details/CircleAction";
import HeroBackdrop from "@/components/details/HeroBackdrop";
import Reveal from "@/components/details/Reveal";
import SimilarGrid, { SimilarMovie } from "@/components/details/SimilarGrid";
import { DetailsSkeleton } from "@/components/details/Skeletons";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/axios";
import { cn } from "@/lib/cn";
import { isPlayableVideo } from "@/lib/tv";
import { fetchResume } from "@/lib/watchTracker";

interface Movie {
  _id: string;
  title: string;
  desc: string;
  img: string;
  imgTitle?: string;
  imgSm?: string;
  trailer?: string;
  video?: string;
  year?: string;
  limit?: number;
  genre?: string;
  duration?: string;
  isSeries?: boolean;
  views?: number;
  avgRating?: number;
  numRatings?: number;
  createdAt?: string;
}

type ListKey = "myList" | "favorites" | "watchlist";
type UserLists = Record<ListKey, boolean>;
type Tab = "overview" | "reviews" | "similar";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "reviews", label: "Ratings & Reviews" },
  { id: "similar", label: "More Like This" },
];

/** Where each list's add/remove lives. All three take { movieId } on POST. */
const LIST_PATHS: Record<ListKey, string> = {
  myList: "mylist",
  favorites: "favorites",
  watchlist: "watchlist",
};

/** Anything past this counts as watched, so it offers a replay, not a resume. */
const RESUME_CEILING_PERCENT = 95;
/** Below a minute in, "Resume" is noise — the viewer has seen the logos. */
const RESUME_FLOOR_SEC = 60;

/**
 * Reviews are collected on a 5-point scale, so the familiar "% Match" badge is
 * a fifth of the average — not `matchScore` from lib/tv, which reads the 10-point
 * editorial rating the TV catalogue carries.
 */
function matchPercent(avgRating?: number) {
  if (!avgRating || avgRating <= 0) return null;
  return Math.round((Math.min(5, avgRating) / 5) * 100);
}

function formatRuntime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function MovieDetails() {
  const { id } = useParams();
  const movieId = Array.isArray(id) ? id[0] : id || "";
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lists, setLists] = useState<UserLists>({
    myList: false,
    favorites: false,
    watchlist: false,
  });
  const [updating, setUpdating] = useState<ListKey | null>(null);
  const [resume, setResume] = useState({ positionSec: 0, percent: 0 });
  const [similar, setSimilar] = useState<SimilarMovie[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [trailerTrigger, setTrailerTrigger] = useState(0);
  const [titleArtBroken, setTitleArtBroken] = useState(false);

  // AuthProvider hydrates from localStorage in a parent effect, which runs
  // after this one — redirecting on a merely-unhydrated `user` would bounce
  // every signed-in viewer to /login on a hard refresh.
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const ready = !authLoading && Boolean(user);

  useEffect(() => {
    if (!ready || !movieId) return;
    let cancelled = false;

    setLoading(true);
    setTitleArtBroken(false);

    api
      .get(`/movies/find/${movieId}`)
      .then((res) => {
        if (cancelled) return;
        setMovie(res.data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.status === 404
            ? "That title isn't available."
            : "We couldn't load this title."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // List membership and playback position are both secondary to the page
    // rendering: a failure in either leaves the buttons in their default state
    // rather than blocking the billboard.
    api
      .get("/users/profile")
      .then((res) => {
        if (cancelled) return;
        const held = (entries?: Array<{ _id?: string } | string>) =>
          Boolean(
            entries?.some((entry) => {
              const value = typeof entry === "string" ? entry : entry?._id;
              return String(value) === movieId;
            })
          );

        setLists({
          myList: held(res.data?.myList),
          favorites: held(res.data?.favorites),
          watchlist: held(res.data?.watchlist),
        });
      })
      .catch(() => undefined);

    fetchResume("movie", movieId)
      .then((position) => {
        if (cancelled) return;
        setResume({
          positionSec: position.positionSec || 0,
          percent: position.percent || 0,
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [ready, movieId]);

  // Related titles come from the genre search rather than a dedicated endpoint:
  // GET /movies is admin-only, and the search route already matches on genre.
  useEffect(() => {
    const genre = movie?.genre;
    if (!ready || !genre) return;
    let cancelled = false;

    api
      .get("/movies/search", { params: { q: genre, isSeries: false } })
      .then((res) => {
        if (cancelled) return;
        const rows: SimilarMovie[] = Array.isArray(res.data) ? res.data : [];
        setSimilar(rows.filter((row) => row._id !== movieId).slice(0, 12));
      })
      .catch(() => {
        if (!cancelled) setSimilar([]);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, movie?.genre, movieId]);

  const toggleList = useCallback(
    async (key: ListKey) => {
      if (!movieId || updating) return;

      const adding = !lists[key];
      setUpdating(key);
      try {
        if (adding) {
          await api.post(`/users/${LIST_PATHS[key]}`, { movieId });
        } else {
          await api.delete(`/users/${LIST_PATHS[key]}/${movieId}`);
        }
        setLists((prev) => ({ ...prev, [key]: adding }));
      } catch (err) {
        console.warn(`Could not update ${key}`, err);
      } finally {
        setUpdating(null);
      }
    },
    [movieId, lists, updating]
  );

  if (!ready || loading) {
    return (
      <main className="min-h-screen bg-nx-bg text-nx-ink">
        <Navbar />
        <DetailsSkeleton />
      </main>
    );
  }

  if (error || !movie) {
    return (
      <main className="flex min-h-screen flex-col bg-nx-bg text-nx-ink">
        <Navbar />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-nx-surface text-nx-accent">
            <FaExclamationTriangle />
          </span>
          <p className="text-lg font-semibold">{error || "Title not found"}</p>
          <Link
            href="/movies"
            className="mt-6 rounded-md bg-nx-ink px-5 py-2 text-sm font-semibold text-nx-black transition hover:bg-white"
          >
            Browse movies
          </Link>
        </div>
      </main>
    );
  }

  const match = matchPercent(movie.avgRating);
  const canResume =
    resume.positionSec >= RESUME_FLOOR_SEC &&
    resume.percent > 0 &&
    resume.percent < RESUME_CEILING_PERCENT;
  const hasTitleArt = Boolean(movie.imgTitle) && !titleArtBroken;
  const showTrailerButton = Boolean(movie.trailer);

  return (
    <main className="min-h-screen bg-nx-bg text-nx-ink">
      <Navbar />

      <section className="relative flex min-h-[78vh] w-full flex-col justify-end sm:min-h-[86vh]">
        <HeroBackdrop
          img={movie.img}
          trailer={movie.trailer}
          title={movie.title}
          trigger={trailerTrigger}
        />

        <div className="relative flex min-h-[78vh] flex-col justify-end px-4 pb-14 pt-24 sm:min-h-[86vh] md:px-12">
          <Link
            href="/movies"
            className="mb-auto inline-flex w-fit items-center gap-2 rounded-full border border-nx-line bg-black/40 px-3 py-1.5 text-xs font-medium text-nx-ink backdrop-blur transition hover:bg-black/70 focus:outline-none focus-visible:nx-focus"
          >
            <FaArrowLeft className="text-[10px]" /> All movies
          </Link>

          <div className="max-w-3xl">
            {hasTitleArt ? (
              <h1 className="animate-nx-rise">
                <img
                  src={movie.imgTitle}
                  alt={movie.title}
                  onError={() => setTitleArtBroken(true)}
                  className="max-h-28 w-auto max-w-full object-contain object-left drop-shadow-2xl sm:max-h-36"
                />
              </h1>
            ) : (
              <h1 className="nx-text-shadow animate-nx-rise text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
                {movie.title}
              </h1>
            )}

            <div
              className="animate-nx-rise mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium"
              style={{ animationDelay: "70ms" }}
            >
              {match !== null && (
                <span className="font-bold text-emerald-400">{match}% Match</span>
              )}
              {movie.year && <span className="text-nx-ink/90">{movie.year}</span>}
              {movie.limit ? (
                <span className="rounded border border-white/40 px-1.5 py-0.5 text-xs text-nx-ink/90">
                  {movie.limit}+
                </span>
              ) : null}
              {movie.duration && <span className="text-nx-ink/90">{movie.duration}</span>}
              <Pill tone="outline" className="border-white/30 text-nx-ink/80">
                {movie.isSeries ? "Series" : "Film"}
              </Pill>
              <Pill tone="outline" className="border-white/30 text-nx-ink/80">
                HD
              </Pill>
            </div>

            {movie.genre && (
              <div
                className="animate-nx-rise mt-3 flex flex-wrap gap-1.5"
                style={{ animationDelay: "110ms" }}
              >
                <Link href={`/search?q=${encodeURIComponent(movie.genre)}`}>
                  <Pill
                    tone="outline"
                    className="border-white/25 capitalize transition hover:border-white/60 hover:text-nx-ink"
                  >
                    {movie.genre}
                  </Pill>
                </Link>
              </div>
            )}

            {movie.avgRating ? (
              <div
                className="animate-nx-rise mt-4 flex items-center gap-2"
                style={{ animationDelay: "140ms" }}
              >
                <RatingStars rating={movie.avgRating} size={16} />
                <span className="text-sm font-semibold">{movie.avgRating.toFixed(1)}</span>
                <span className="text-sm text-nx-muted">
                  ({movie.numRatings} {movie.numRatings === 1 ? "review" : "reviews"})
                </span>
              </div>
            ) : null}

            {movie.desc && (
              <p
                className="nx-text-shadow animate-nx-rise mt-4 line-clamp-3 max-w-2xl text-sm leading-relaxed text-nx-ink/85 sm:text-base"
                style={{ animationDelay: "180ms" }}
              >
                {movie.desc}
              </p>
            )}

            {canResume && (
              <div
                className="animate-nx-rise mt-5 max-w-xs"
                style={{ animationDelay: "210ms" }}
              >
                <p className="mb-1.5 text-xs text-nx-muted">
                  {formatRuntime(resume.positionSec)} in &middot;{" "}
                  {Math.round(resume.percent)}% watched
                </p>
                <ProgressBar percent={resume.percent} className="rounded-full" />
              </div>
            )}

            <div
              className="animate-nx-rise mt-6 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "250ms" }}
            >
              <Link
                href={`/watch?videoId=${movie._id}`}
                className="nx-sheen inline-flex items-center gap-2.5 rounded-md bg-white px-7 py-3 text-sm font-bold text-black shadow-lg shadow-black/40 transition duration-200 hover:scale-[1.03] hover:bg-white/90 focus:outline-none focus-visible:nx-focus"
              >
                <FaPlay /> {canResume ? "Resume" : "Play"}
              </Link>

              {showTrailerButton &&
                (isPlayableVideo(movie.trailer) ? (
                  <button
                    type="button"
                    onClick={() => setTrailerTrigger((n) => n + 1)}
                    className="inline-flex items-center gap-2.5 rounded-md border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-nx-ink backdrop-blur transition duration-200 hover:scale-[1.03] hover:bg-white/20 focus:outline-none focus-visible:nx-focus"
                  >
                    <FaFilm /> Trailer
                  </button>
                ) : (
                  <Link
                    href={`/watch/${movie._id}`}
                    className="inline-flex items-center gap-2.5 rounded-md border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-nx-ink backdrop-blur transition duration-200 hover:scale-[1.03] hover:bg-white/20 focus:outline-none focus-visible:nx-focus"
                  >
                    <FaFilm /> Trailer
                  </Link>
                ))}

              <div className="ml-1 flex items-center gap-2.5">
                <CircleAction
                  icon={<FaPlus />}
                  activeIcon={<FaCheck />}
                  label="Add to My List"
                  activeLabel="Remove from My List"
                  active={lists.myList}
                  busy={updating === "myList"}
                  onClick={() => toggleList("myList")}
                />
                <CircleAction
                  icon={<FaRegHeart />}
                  activeIcon={<FaHeart />}
                  label="Add to Favorites"
                  activeLabel="Remove from Favorites"
                  active={lists.favorites}
                  busy={updating === "favorites"}
                  tone="accent"
                  onClick={() => toggleList("favorites")}
                />
                <CircleAction
                  icon={<FaRegClock />}
                  activeIcon={<FaClock />}
                  label="Add to Watchlist"
                  activeLabel="Remove from Watchlist"
                  active={lists.watchlist}
                  busy={updating === "watchlist"}
                  tone="cyan"
                  onClick={() => toggleList("watchlist")}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-14 z-30 border-b border-nx-line bg-nx-bg/85 backdrop-blur-xl">
        <div className="nx-scroll-x flex gap-1 overflow-x-auto px-4 md:px-12">
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
              {entry.id === "reviews" && movie.numRatings ? (
                <span className="ml-1.5 text-xs text-nx-dim">{movie.numRatings}</span>
              ) : null}
              {tab === entry.id && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-nx-accent" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-24 pt-8 md:px-12">
        {tab === "overview" && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-10">
              <Reveal>
                <h2 className="text-lg font-semibold">Synopsis</h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-nx-muted sm:text-base">
                  {movie.desc || "No synopsis has been written for this title yet."}
                </p>
              </Reveal>

              <Reveal delay={80}>
                <h2 className="text-lg font-semibold">Details</h2>
                <dl className="mt-3 grid max-w-3xl gap-x-10 gap-y-4 sm:grid-cols-2">
                  <Detail label="Genre">
                    <span className="capitalize">{movie.genre || "—"}</span>
                  </Detail>
                  <Detail label="Released">{movie.year || "—"}</Detail>
                  <Detail label="Runtime">{movie.duration || "—"}</Detail>
                  <Detail label="Maturity">
                    {movie.limit ? `${movie.limit}+` : "Not rated"}
                  </Detail>
                  <Detail label="Format">{movie.isSeries ? "Series" : "Film"}</Detail>
                  <Detail label="Views">
                    {typeof movie.views === "number" ? movie.views.toLocaleString() : "—"}
                  </Detail>
                  <Detail label="Average rating">
                    {movie.avgRating
                      ? `${movie.avgRating.toFixed(1)} / 5 from ${movie.numRatings} ${
                          movie.numRatings === 1 ? "review" : "reviews"
                        }`
                      : "Not yet rated"}
                  </Detail>
                  <Detail label="Added">
                    {movie.createdAt
                      ? new Date(movie.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </Detail>
                </dl>
              </Reveal>
            </div>

            <Reveal delay={120} className="lg:sticky lg:top-32 lg:self-start">
              <div className="rounded-2xl border border-nx-line bg-gradient-to-b from-nx-surface to-nx-bg p-6">
                <p className="text-xs uppercase tracking-wider text-nx-dim">
                  Audience score
                </p>

                <div className="mt-3 flex items-end gap-2">
                  <span className="text-5xl font-extrabold leading-none">
                    {movie.avgRating ? movie.avgRating.toFixed(1) : "—"}
                  </span>
                  <span className="pb-1 text-sm text-nx-muted">/ 5</span>
                </div>

                <div className="mt-3">
                  <RatingStars rating={movie.avgRating || 0} size={18} />
                </div>

                <p className="mt-2 text-sm text-nx-muted">
                  {movie.numRatings
                    ? `${movie.numRatings} ${
                        movie.numRatings === 1 ? "rating" : "ratings"
                      } from viewers`
                    : "Be the first to rate this title"}
                </p>

                <button
                  type="button"
                  onClick={() => setTab("reviews")}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-nx-ink px-4 py-2.5 text-sm font-bold text-nx-black transition hover:bg-white focus:outline-none focus-visible:nx-focus"
                >
                  <FaStar className="text-xs" /> Rate this title
                </button>

                <div className="mt-6 space-y-2 border-t border-nx-line pt-5 text-sm">
                  <StatusLine label="In My List" on={lists.myList} />
                  <StatusLine label="In Favorites" on={lists.favorites} />
                  <StatusLine label="In Watchlist" on={lists.watchlist} />
                </div>
              </div>
            </Reveal>
          </div>
        )}

        {tab === "reviews" && (
          <Reveal>
            <div className="max-w-4xl">
              <ReviewList movieId={movieId} />
            </div>
          </Reveal>
        )}

        {tab === "similar" && <SimilarGrid movies={similar} />}
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

function StatusLine({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-nx-muted">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-semibold",
          on ? "text-emerald-400" : "text-nx-dim"
        )}
      >
        {on ? <FaCheck className="text-[10px]" /> : null}
        {on ? "Yes" : "No"}
      </span>
    </div>
  );
}
