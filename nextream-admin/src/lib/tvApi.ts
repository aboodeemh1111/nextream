import api from "@/services/api";

/**
 * Typed client for the admin TV API (mounted at /api/tv/admin).
 *
 * Pages used to build these URLs inline, which is how the app ended up calling
 * the *public* endpoints for admin work: the show list read `GET /tv`, which
 * filters to published only, so drafts were invisible in the admin panel.
 * Everything admin-facing goes through here.
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
  published?: boolean;
  seasonsCount?: number;
  episodesCount?: number;
  lastAirDate?: string;
  createdAt?: string;
  updatedAt?: string;
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
  published?: boolean;
  episodesCount?: number;
  publishedEpisodesCount?: number;
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
  duration?: number;
  stillPath?: string;
  videoSources?: VideoSource[];
  subtitles?: SubtitleTrack[];
  thumbnails?: string[];
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShowListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  genre?: string;
  status?: string;
  published?: "true" | "false";
  sort?: string;
}

export interface ShowListResult {
  data: TVShow[];
  page: number;
  pageSize: number;
  total: number;
}

const BASE = "/tv/admin";

/** Turns an axios failure into the message the API actually sent. */
export function apiMessage(err: any, fallback: string): string {
  return err?.response?.data?.message || err?.message || fallback;
}

export const tvApi = {
  listShows: async (query: ShowListQuery): Promise<ShowListResult> => {
    const res = await api.get(`${BASE}/shows`, { params: query });
    return res.data;
  },

  createShow: async (payload: Partial<TVShow>): Promise<TVShow> => {
    const res = await api.post(`${BASE}/shows`, payload);
    return res.data;
  },

  getShow: async (
    showId: string
  ): Promise<{ show: TVShow; seasons: Season[] }> => {
    const res = await api.get(`${BASE}/shows/${showId}`);
    return res.data;
  },

  updateShow: async (showId: string, payload: Partial<TVShow>): Promise<TVShow> => {
    const res = await api.patch(`${BASE}/shows/${showId}`, payload);
    return res.data;
  },

  deleteShow: async (
    showId: string
  ): Promise<{
    ok: true;
    deleted: { seasons: number; episodes: number; progress?: number };
  }> => {
    const res = await api.delete(`${BASE}/shows/${showId}`);
    return res.data;
  },

  recount: async (showId: string) => {
    const res = await api.post(`${BASE}/shows/${showId}/recount`);
    return res.data;
  },

  listSeasons: async (showId: string): Promise<Season[]> => {
    const res = await api.get(`${BASE}/shows/${showId}/seasons`);
    return res.data;
  },

  createSeason: async (
    showId: string,
    payload: Partial<Season>
  ): Promise<Season> => {
    const res = await api.post(`${BASE}/shows/${showId}/seasons`, payload);
    return res.data;
  },

  updateSeason: async (seasonId: string, payload: Partial<Season>): Promise<Season> => {
    const res = await api.patch(`${BASE}/seasons/${seasonId}`, payload);
    return res.data;
  },

  deleteSeason: async (seasonId: string) => {
    const res = await api.delete(`${BASE}/seasons/${seasonId}`);
    return res.data;
  },

  reorderSeasons: async (
    showId: string,
    seasonIds: string[]
  ): Promise<{ ok: true; seasons: Season[] }> => {
    const res = await api.post(`${BASE}/shows/${showId}/seasons/reorder`, {
      seasons: seasonIds,
    });
    return res.data;
  },

  listEpisodes: async (seasonId: string): Promise<Episode[]> => {
    const res = await api.get(`${BASE}/seasons/${seasonId}/episodes`);
    return res.data;
  },

  getEpisode: async (episodeId: string): Promise<Episode> => {
    const res = await api.get(`${BASE}/episodes/${episodeId}`);
    return res.data;
  },

  createEpisode: async (
    seasonId: string,
    payload: Partial<Episode>
  ): Promise<Episode> => {
    const res = await api.post(`${BASE}/seasons/${seasonId}/episodes`, payload);
    return res.data;
  },

  /** Reports per-row outcomes rather than silently skipping conflicts. */
  createEpisodesBulk: async (
    seasonId: string,
    episodes: Array<Partial<Episode>>
  ): Promise<{
    created: Episode[];
    failed: Array<{ index: number; title?: string; error: string; message: string }>;
  }> => {
    const res = await api.post(`${BASE}/seasons/${seasonId}/episodes/bulk`, {
      episodes,
    });
    return res.data;
  },

  updateEpisode: async (
    episodeId: string,
    payload: Partial<Episode>
  ): Promise<Episode> => {
    const res = await api.patch(`${BASE}/episodes/${episodeId}`, payload);
    return res.data;
  },

  deleteEpisode: async (episodeId: string) => {
    const res = await api.delete(`${BASE}/episodes/${episodeId}`);
    return res.data;
  },

  reorderEpisodes: async (
    seasonId: string,
    episodeIds: string[]
  ): Promise<{ ok: true; episodes: Episode[] }> => {
    const res = await api.post(`${BASE}/seasons/${seasonId}/episodes/reorder`, {
      episodes: episodeIds,
    });
    return res.data;
  },
};

/**
 * Parses "Show.Name.S02E07.title.mkv" and friends.
 *
 * Used when files are dropped straight onto a season: the numbering an editor
 * already encoded in the filename is better than making them retype it.
 */
export function parseEpisodeFilename(filename: string): {
  seasonNumber?: number;
  episodeNumber?: number;
  title: string;
} {
  const stem = filename.replace(/\.[^.]+$/, "");

  const patterns = [
    /[sS](\d{1,2})[\s._-]*[eE](\d{1,3})/, // S02E07
    /(\d{1,2})[xX](\d{1,3})/, // 2x07
    /[\s._-](\d{1,2})(\d{2})[\s._-]/, // .207.
  ];

  for (const pattern of patterns) {
    const match = stem.match(pattern);
    if (!match) continue;

    const rest = stem
      .slice(match.index! + match[0].length)
      .replace(/^[\s._-]+/, "")
      .replace(/[\s._-]+/g, " ")
      .trim();

    return {
      seasonNumber: Number(match[1]),
      episodeNumber: Number(match[2]),
      title: rest || `Episode ${Number(match[2])}`,
    };
  }

  // No numbering found — fall back to a readable title and let the API append.
  return {
    title:
      stem
        .replace(/[\s._-]+/g, " ")
        .trim()
        .slice(0, 120) || filename,
  };
}
