import api from "@/lib/axios";

/**
 * Typed client for the TV catalogue.
 *
 * The series pages used to call `/api/lists?type=series`, which reads curated
 * List documents of *Movie* records flagged isSeries — a different collection
 * from the TVShow/Season/Episode data the admin app actually manages. That is
 * why the page rendered "No series found" against a populated catalogue.
 * Everything series-related goes through here now.
 *
 * Three mounts, three audiences:
 *   /tv        public catalogue, personalised when a token is present
 *   /tv/me     the signed-in viewer's progress and My List
 *   /tv/admin  editorial (admin app only)
 */

export interface VideoSource {
  label: string;
  url: string;
}

export interface SubtitleTrack {
  lang: string;
  url: string;
}

export interface TVShow {
  _id: string;
  title: string;
  slug?: string;
  overview?: string;
  genres?: string[];
  tags?: string[];
  status?: "ongoing" | "ended";
  poster?: string;
  backdrop?: string;
  trailerUrl?: string;
  rating?: number;
  releaseYear?: number;
  seasonsCount?: number;
  episodesCount?: number;
  lastAirDate?: string;
  views?: number;
  createdAt?: string;
  /** Present on any show the API resolved for a signed-in viewer. */
  inMyList?: boolean;
  /** Only on the "New Episodes" row. */
  latestEpisode?: Pick<
    Episode,
    "_id" | "title" | "seasonNumber" | "episodeNumber" | "airDate" | "createdAt"
  >;
}

export interface Season {
  _id: string;
  showId: string;
  seasonNumber: number;
  name?: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  airDate?: string;
  episodesCount?: number;
}

export interface EpisodeProgress {
  positionSec: number;
  percent: number;
  completed: boolean;
  watchedAt?: string;
}

export interface Episode {
  _id: string;
  showId: string;
  seasonId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview?: string;
  airDate?: string;
  /** Minutes, as authored in the admin app. */
  duration?: number;
  stillPath?: string;
  videoSources?: VideoSource[];
  subtitles?: SubtitleTrack[];
  createdAt?: string;
  progress?: EpisodeProgress | null;
}

/** Where the viewer should land, and what the play button should say. */
export interface NextUp {
  episode: Episode;
  resumeSec: number;
  percent: number;
  reason: "start" | "resume" | "next" | "rewatch";
}

export interface ContinueEntry {
  show: TVShow;
  episode: Episode;
  resumeSec: number;
  percent: number;
  reason: NextUp["reason"];
  lastWatchedAt?: string;
}

export interface HubRow {
  key: string;
  title: string;
  kind: "show" | "continue";
  /** Renders the Top 10 numerals. */
  ranked?: boolean;
  genre?: string;
  items: TVShow[] | ContinueEntry[];
}

export interface HubResponse {
  hero: { show: TVShow; nextUp: NextUp | null } | null;
  rows: HubRow[];
}

export interface GenreFacet {
  value: string;
  label: string;
  count: number;
}

export interface ShowPage {
  show: TVShow;
  seasons: Season[];
  activeSeasonNumber: number;
  episodes: Episode[];
  nextUp: NextUp | null;
  similar: TVShow[];
  watchedCount: number;
  totalEpisodes: number;
}

export interface EpisodePage {
  episode: Episode;
  show: TVShow;
  season: Season;
  prev: Episode | null;
  next: Episode | null;
  resumeSec: number;
  seasonEpisodes: Episode[];
}

export interface BrowseQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  genre?: string;
  status?: string;
  year?: number;
  sort?: string;
}

export interface BrowseResult {
  data: TVShow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export const tv = {
  hub: async (): Promise<HubResponse> => (await api.get("/tv/hub")).data,

  browse: async (query: BrowseQuery): Promise<BrowseResult> =>
    (await api.get("/tv", { params: query })).data,

  genres: async (): Promise<GenreFacet[]> => (await api.get("/tv/genres")).data,

  show: async (showId: string): Promise<ShowPage> =>
    (await api.get(`/tv/${showId}`)).data,

  seasonEpisodes: async (showId: string, seasonNumber: number): Promise<Episode[]> =>
    (await api.get(`/tv/${showId}/seasons/${seasonNumber}/episodes`)).data,

  episode: async (episodeId: string): Promise<EpisodePage> =>
    (await api.get(`/tv/episodes/${episodeId}`)).data,

  similar: async (showId: string): Promise<TVShow[]> =>
    (await api.get(`/tv/${showId}/similar`)).data,

  // --- viewer state (requires a token) ---

  continueWatching: async (): Promise<ContinueEntry[]> =>
    (await api.get("/tv/me/continue-watching")).data,

  removeFromContinue: async (showId: string): Promise<void> => {
    await api.delete(`/tv/me/continue-watching/${showId}`);
  },

  myList: async (): Promise<TVShow[]> => (await api.get("/tv/me/my-list")).data,

  addToMyList: async (showId: string): Promise<void> => {
    await api.post("/tv/me/my-list", { showId });
  },

  removeFromMyList: async (showId: string): Promise<void> => {
    await api.delete(`/tv/me/my-list/${showId}`);
  },

  saveProgress: async (input: {
    episodeId: string;
    positionSec: number;
    durationSec?: number;
    completed?: boolean;
  }): Promise<void> => {
    await api.post("/tv/me/progress", input);
  },
};

// --- presentation helpers ---------------------------------------------------

/** "S2:E7" — the label every streaming service uses for an episode address. */
export function episodeCode(episode: Pick<Episode, "seasonNumber" | "episodeNumber">) {
  return `S${episode.seasonNumber}:E${episode.episodeNumber}`;
}

/** Minutes to "1h 12m" / "48m". Episode.duration is authored in minutes. */
export function formatRuntime(minutes?: number | null) {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** Seconds to "1:04:12" / "4:12" — for player timecodes. */
export function formatTimecode(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function formatAirDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * A 0-10 editorial rating shown the way streaming UIs do it, as a "% match".
 * Returns null rather than a fake number when the show is unrated, so the badge
 * can be omitted instead of claiming a 0% match.
 */
export function matchScore(rating?: number | null) {
  if (!rating || rating <= 0) return null;
  return Math.round(Math.min(10, rating) * 10);
}

/**
 * True when a URL can drive a <video> element.
 *
 * trailerUrl is free text in the admin form, so it is just as likely to be a
 * YouTube watch page as a file. Autoplaying a page URL leaves the billboard
 * stuck on a black rectangle, so previews are opt-in on this check.
 */
export function isPlayableVideo(url?: string | null) {
  if (!url) return false;
  const withoutQuery = url.split("?")[0].toLowerCase();
  if (/(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com)/.test(url.toLowerCase())) {
    return false;
  }
  return /\.(mp4|webm|ogg|ogv|mov|m4v)$/.test(withoutQuery);
}

/** Poster art, falling back to the backdrop so a card is never empty. */
export function showPoster(show?: Partial<TVShow> | null) {
  return show?.poster || show?.backdrop || "";
}

export function showBackdrop(show?: Partial<TVShow> | null) {
  return show?.backdrop || show?.poster || "";
}

/**
 * Billboard / card meta line. Prefer published counts from the show page
 * (`totalEpisodes`, seasons.length) when available — `show.episodesCount` is
 * denormalized and includes drafts, which is why a title can claim "2 Episodes"
 * while the Episodes tab is empty.
 */
export function showMeta(
  show?: Partial<TVShow> | null,
  counts?: { seasonsCount?: number; episodesCount?: number }
): string[] {
  if (!show) return [];
  const seasonsCount = counts?.seasonsCount ?? show.seasonsCount;
  const episodesCount = counts?.episodesCount ?? show.episodesCount;
  const parts: string[] = [];
  if (show.releaseYear) parts.push(String(show.releaseYear));
  if (seasonsCount) {
    parts.push(`${seasonsCount} Season${seasonsCount === 1 ? "" : "s"}`);
  }
  if (episodesCount) {
    parts.push(`${episodesCount} Episode${episodesCount === 1 ? "" : "s"}`);
  }
  return parts;
}

export function seasonLabel(season: Pick<Season, "seasonNumber" | "name">) {
  return season.name?.trim() || `Season ${season.seasonNumber}`;
}

/** Button copy that matches what pressing play will actually do. */
export function playLabel(nextUp?: NextUp | null) {
  if (!nextUp) return "Play";
  switch (nextUp.reason) {
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
