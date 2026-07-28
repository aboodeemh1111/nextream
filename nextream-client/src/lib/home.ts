import api from "@/lib/axios";

/**
 * Typed client for the personalised home feed.
 *
 * The home page used to assemble itself: `GET /lists` for the row definitions,
 * then a `GET /lists/find/:id` per row, plus `/movies/featured` for the hero.
 * That was a waterfall, and it could only ever show movies — curated `List`
 * documents reference the Movie collection, so the TVShow catalogue the admin
 * app manages never appeared on the landing page at all.
 *
 * `/home/feed` replaces the lot: one request, both collections, ranked per
 * viewer. Movies and shows arrive in the same `MediaItem` envelope, so a card
 * does not need to know which collection it came from — only where to link.
 */

export type MediaKind = "movie" | "show";

export interface NextUp {
  episodeId: string;
  title: string;
  /** "S2:E7". */
  code: string;
  resumeSec: number;
  reason: "start" | "resume" | "next" | "rewatch";
}

export interface MediaItem {
  /** Namespaced by kind — a Movie and a TVShow can share an ObjectId. */
  uid: string;
  id: string;
  kind: MediaKind;
  /** Display label: legacy Movie rows flagged isSeries still say "Series". */
  badge: "Film" | "Series";
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  titleArt?: string;
  trailer?: string;
  /** Lower-cased, for logic. */
  genres: string[];
  /** As authored, for display. */
  genreLabels: string[];
  year: number | null;
  maturity: number | null;
  /** Movies only, free text as authored ("2h 14m"). */
  runtime?: string;
  seasonsCount?: number;
  episodesCount?: number;
  status?: "ongoing" | "ended";
  /** Both kinds, normalised to a 0-10 scale. */
  rating10: number | null;
  views: number;
  addedAt: string | null;
  href: string;
  /** Null when nothing is published behind the title yet. */
  playHref: string | null;
  inMyList: boolean;
  watched: boolean;
  started: boolean;
  /** 0-100. Absent when there is no taste profile to match against. */
  match: number | null;
  /** Shows only, once an episode has been resolved for this viewer. */
  nextUp?: NextUp;
}

export interface ContinueItem {
  item: MediaItem;
  percent: number;
  resumeSec: number;
  durationSec: number;
  lastWatchedAt: string | null;
  /** "S2:E7 · Fallout" for a show, the runtime for a movie. */
  subtitle: string;
  still: string;
  watchHref: string;
  reason: "start" | "resume" | "next" | "rewatch";
  episodeCode?: string;
}

export interface MediaRow {
  key: string;
  title: string;
  subtitle?: string;
  kind: "media";
  ranked?: boolean;
  genre?: string;
  items: MediaItem[];
}

export interface ContinueRow {
  key: string;
  title: string;
  kind: "continue";
  items: ContinueItem[];
}

export type HomeRowData = MediaRow | ContinueRow;

export interface HeroItem extends MediaItem {
  /** One line on why this title is on the billboard. */
  reason: string;
  resume: { percent: number; resumeSec: number; subtitle: string } | null;
  watchHref: string | null;
}

export interface HomeFeed {
  hero: HeroItem | null;
  rows: HomeRowData[];
  profile: {
    personalised: boolean;
    topGenres: string[];
    signalCount?: number;
  };
  /** Set when the API answered without a database rather than failing. */
  degraded?: string;
}

export const home = {
  feed: async (): Promise<HomeFeed> => (await api.get("/home/feed")).data,
};

/**
 * My List spans two collections with two endpoints — movies hang off the User
 * document, shows off `myShows` — so the toggle dispatches on kind rather than
 * every caller having to.
 */
export async function setInMyList(item: MediaItem, next: boolean): Promise<void> {
  if (item.kind === "show") {
    if (next) await api.post("/tv/me/my-list", { showId: item.id });
    else await api.delete(`/tv/me/my-list/${item.id}`);
    return;
  }
  if (next) await api.post("/users/mylist", { movieId: item.id });
  else await api.delete(`/users/mylist/${item.id}`);
}

/**
 * "Remove from Continue Watching", for either collection.
 *
 * A show drops its whole progress history rather than one episode, so the row
 * cannot resurrect it from an older episode on the next render. A movie only
 * leaves `currentlyWatching`; its watch history is a record of what happened
 * and is not the viewer's to rewrite from a card.
 */
export async function removeFromContinue(item: MediaItem): Promise<void> {
  if (item.kind === "show") {
    await api.delete(`/tv/me/continue-watching/${item.id}`);
    return;
  }
  await api.delete(`/users/currently-watching/remove/${item.id}`);
}

// --- presentation helpers ----------------------------------------------------

/** The metadata line under a title: year, then whatever the kind can offer. */
export function mediaMeta(item: MediaItem): string[] {
  const parts: string[] = [];
  if (item.year) parts.push(String(item.year));

  if (item.kind === "show") {
    if (item.seasonsCount) {
      parts.push(`${item.seasonsCount} Season${item.seasonsCount === 1 ? "" : "s"}`);
    } else if (item.episodesCount) {
      parts.push(`${item.episodesCount} Episode${item.episodesCount === 1 ? "" : "s"}`);
    }
    if (item.status === "ended") parts.push("Complete");
  } else if (item.runtime) {
    parts.push(item.runtime);
  }

  return parts;
}

/** "13+" — the maturity flag movies carry as a bare number. */
export function maturityLabel(item: MediaItem): string | null {
  return Number.isFinite(item.maturity) && item.maturity ? `${item.maturity}+` : null;
}

/** Button copy that matches what pressing play will actually do. */
export function playLabel(item: MediaItem, resumePercent?: number): string {
  if (resumePercent && resumePercent > 0) return "Resume";
  switch (item.nextUp?.reason) {
    case "resume":
      return "Resume";
    case "next":
      return "Next Episode";
    case "rewatch":
      return "Watch Again";
    default:
      return "Play";
  }
}

/** Seconds remaining, phrased the way a Continue Watching tile wants it. */
export function timeLeftLabel(entry: ContinueItem): string {
  const remaining = entry.durationSec - entry.resumeSec;
  if (entry.durationSec > 0 && remaining > 0) {
    return `${Math.max(1, Math.round(remaining / 60))}m left`;
  }
  return entry.item.kind === "movie" ? entry.item.runtime || "" : "";
}

/**
 * True when a URL can drive a <video> element.
 *
 * Trailer fields are free text in the admin form, so they are as likely to hold
 * a YouTube watch page as a file. Autoplaying a page URL leaves a card stuck on
 * a black rectangle, so previews are opt-in on this check.
 */
export function isPlayableVideo(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (/(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com)/.test(lower)) return false;
  return /\.(mp4|webm|ogg|ogv|mov|m4v)$/.test(lower.split("?")[0]);
}
