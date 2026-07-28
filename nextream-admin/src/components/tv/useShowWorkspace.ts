"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui";
import {
  apiMessage,
  tvApi,
  type Episode,
  type Season,
  type TVShow,
} from "@/lib/tvApi";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * All the state one show's workspace needs, in one place.
 *
 * Previously the show detail page and the show edit page each carried their own
 * copy of this logic — two ~670-line files whose season and episode handling had
 * already drifted apart, so a fix had to be made twice and usually was not.
 */
export function useShowWorkspace(showId: string) {
  const toast = useToast();

  const [show, setShow] = useState<TVShow | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>({});
  const [loadingEpisodes, setLoadingEpisodes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const savedTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    },
    []
  );

  const flashSaved = useCallback(() => {
    setSaveState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 2000);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await tvApi.getShow(showId);
      setShow(result.show);
      setSeasons(result.seasons);
    } catch (err: any) {
      setError(apiMessage(err, "Failed to load the show"));
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    load();
  }, [load]);

  // --- episodes -------------------------------------------------------------

  const loadEpisodes = useCallback(
    async (seasonId: string, force = false) => {
      if (!force && episodes[seasonId]) return;
      try {
        setLoadingEpisodes((prev) => ({ ...prev, [seasonId]: true }));
        const list = await tvApi.listEpisodes(seasonId);
        setEpisodes((prev) => ({ ...prev, [seasonId]: list }));
      } catch (err: any) {
        // No silent fallback to the published-only public route: an empty list
        // that actually meant "this request failed" is what hid draft episodes.
        toast.error("Could not load episodes", apiMessage(err, "Please try again."));
        setEpisodes((prev) => ({ ...prev, [seasonId]: prev[seasonId] ?? [] }));
      } finally {
        setLoadingEpisodes((prev) => ({ ...prev, [seasonId]: false }));
      }
    },
    [episodes, toast]
  );

  // getShow rather than listSeasons: it also returns publishedEpisodesCount,
  // which the season rows and the publish checklist both read.
  const refreshSeasonCounts = useCallback(async () => {
    try {
      const result = await tvApi.getShow(showId);
      setSeasons(result.seasons);
      setShow(result.show);
    } catch {
      // Counts are cosmetic here; the next full load will correct them.
    }
  }, [showId]);

  // --- show -----------------------------------------------------------------

  const patchShow = useCallback(
    async (changes: Partial<TVShow>): Promise<boolean> => {
      if (Object.keys(changes).length === 0) return true;
      try {
        setSaveState("saving");
        const updated = await tvApi.updateShow(showId, changes);
        setShow(updated);
        flashSaved();
        return true;
      } catch (err: any) {
        setSaveState("error");
        toast.error("Could not save", apiMessage(err, "The change was not stored."));
        return false;
      }
    },
    [showId, flashSaved, toast]
  );

  // --- seasons --------------------------------------------------------------

  const createSeason = useCallback(
    async (input: Partial<Season>): Promise<Season | null> => {
      try {
        const season = await tvApi.createSeason(showId, input);
        setSeasons((prev) =>
          [...prev, season].sort((a, b) => a.seasonNumber - b.seasonNumber)
        );
        setShow((prev) =>
          prev ? { ...prev, seasonsCount: (prev.seasonsCount ?? 0) + 1 } : prev
        );
        toast.success(`Season ${season.seasonNumber} added`);
        return season;
      } catch (err: any) {
        const suggestion = err?.response?.data?.suggestion;
        toast.error(
          "Could not add the season",
          suggestion
            ? `${apiMessage(err, "")} Season ${suggestion} is free.`
            : apiMessage(err, "Please try again.")
        );
        return null;
      }
    },
    [showId, toast]
  );

  const updateSeason = useCallback(
    async (seasonId: string, changes: Partial<Season>): Promise<boolean> => {
      try {
        const updated = await tvApi.updateSeason(seasonId, changes);
        setSeasons((prev) =>
          prev
            .map((season) => (season._id === seasonId ? { ...season, ...updated } : season))
            .sort((a, b) => a.seasonNumber - b.seasonNumber)
        );
        return true;
      } catch (err: any) {
        toast.error("Could not save the season", apiMessage(err, "Please try again."));
        return false;
      }
    },
    [toast]
  );

  const deleteSeason = useCallback(
    async (seasonId: string): Promise<boolean> => {
      try {
        const result = await tvApi.deleteSeason(seasonId);
        setSeasons((prev) => prev.filter((season) => season._id !== seasonId));
        setEpisodes((prev) => {
          const next = { ...prev };
          delete next[seasonId];
          return next;
        });
        await refreshSeasonCounts();
        toast.success(
          "Season deleted",
          result?.deleted?.episodes
            ? `${result.deleted.episodes} episode(s) removed with it.`
            : undefined
        );
        return true;
      } catch (err: any) {
        toast.error("Could not delete the season", apiMessage(err, "Please try again."));
        return false;
      }
    },
    [refreshSeasonCounts, toast]
  );

  /**
   * Reorder is applied optimistically and reverted on failure, because it also
   * renumbers every episode server-side and a stale local list would then be
   * describing seasons that no longer have those numbers.
   */
  const reorderSeasons = useCallback(
    async (ordered: Season[]): Promise<boolean> => {
      const previous = seasons;
      const previousEpisodes = episodes;

      // The server deals out the numbers the show already uses, in order, so a
      // show with a season 0 for specials keeps it. Mirror that locally rather
      // than guessing 1..N, or the optimistic render disagrees with the result.
      const slots = seasons.map((season) => season.seasonNumber).sort((a, b) => a - b);
      setSeasons(ordered.map((season, index) => ({ ...season, seasonNumber: slots[index] })));

      try {
        const result = await tvApi.reorderSeasons(
          showId,
          ordered.map((season) => season._id)
        );
        setSeasons(result.seasons);

        // Every episode's denormalised seasonNumber moved with its season, so
        // refetch the lists that are currently open instead of blanking them —
        // an expanded season would otherwise render as "no episodes".
        const loaded = Object.keys(previousEpisodes);
        setEpisodes({});
        await Promise.all(loaded.map((seasonId) => loadEpisodes(seasonId, true)));

        toast.success("Season order saved");
        return true;
      } catch (err: any) {
        setSeasons(previous);
        toast.error("Could not reorder seasons", apiMessage(err, "Nothing was changed."));
        return false;
      }
    },
    [seasons, episodes, showId, loadEpisodes, toast]
  );

  // --- episodes: mutations --------------------------------------------------

  const createEpisode = useCallback(
    async (seasonId: string, input: Partial<Episode>): Promise<Episode | null> => {
      try {
        const episode = await tvApi.createEpisode(seasonId, input);
        setEpisodes((prev) => ({
          ...prev,
          [seasonId]: [...(prev[seasonId] ?? []), episode].sort(
            (a, b) => a.episodeNumber - b.episodeNumber
          ),
        }));
        await refreshSeasonCounts();
        return episode;
      } catch (err: any) {
        const suggestion = err?.response?.data?.suggestion;
        toast.error(
          "Could not add the episode",
          suggestion
            ? `${apiMessage(err, "")} Episode ${suggestion} is free.`
            : apiMessage(err, "Please try again.")
        );
        return null;
      }
    },
    [refreshSeasonCounts, toast]
  );

  const createEpisodesBulk = useCallback(
    async (seasonId: string, items: Array<Partial<Episode>>) => {
      try {
        const result = await tvApi.createEpisodesBulk(seasonId, items);
        await loadEpisodes(seasonId, true);
        await refreshSeasonCounts();

        // Say exactly what happened. The old wizard swallowed conflicts with a
        // `continue`, so it could report success for episodes it never created.
        if (result.failed.length === 0) {
          toast.success(`${result.created.length} episode(s) created`);
        } else {
          toast.toast({
            tone: result.created.length ? "warning" : "error",
            title: `${result.created.length} created, ${result.failed.length} skipped`,
            description: result.failed
              .slice(0, 3)
              .map((f) => `${f.title ?? `Row ${f.index + 1}`}: ${f.message}`)
              .join(" · "),
          });
        }
        return result;
      } catch (err: any) {
        toast.error("Bulk create failed", apiMessage(err, "Nothing was created."));
        return null;
      }
    },
    [loadEpisodes, refreshSeasonCounts, toast]
  );

  const updateEpisode = useCallback(
    async (
      seasonId: string,
      episodeId: string,
      changes: Partial<Episode>
    ): Promise<Episode | null> => {
      try {
        const updated = await tvApi.updateEpisode(episodeId, changes);
        setEpisodes((prev) => ({
          ...prev,
          [seasonId]: (prev[seasonId] ?? [])
            .map((episode) => (episode._id === episodeId ? updated : episode))
            .sort((a, b) => a.episodeNumber - b.episodeNumber),
        }));
        return updated;
      } catch (err: any) {
        toast.error("Could not save the episode", apiMessage(err, "Please try again."));
        return null;
      }
    },
    [toast]
  );

  const deleteEpisode = useCallback(
    async (seasonId: string, episodeId: string): Promise<boolean> => {
      try {
        await tvApi.deleteEpisode(episodeId);
        setEpisodes((prev) => ({
          ...prev,
          [seasonId]: (prev[seasonId] ?? []).filter((episode) => episode._id !== episodeId),
        }));
        await refreshSeasonCounts();
        toast.success("Episode deleted");
        return true;
      } catch (err: any) {
        toast.error("Could not delete the episode", apiMessage(err, "Please try again."));
        return false;
      }
    },
    [refreshSeasonCounts, toast]
  );

  const reorderEpisodes = useCallback(
    async (seasonId: string, ordered: Episode[]): Promise<boolean> => {
      const previous = episodes[seasonId] ?? [];
      const slots = previous.map((episode) => episode.episodeNumber).sort((a, b) => a - b);
      setEpisodes((prev) => ({
        ...prev,
        [seasonId]: ordered.map((episode, index) => ({
          ...episode,
          episodeNumber: slots[index] ?? index + 1,
        })),
      }));

      try {
        const result = await tvApi.reorderEpisodes(
          seasonId,
          ordered.map((episode) => episode._id)
        );
        setEpisodes((prev) => ({ ...prev, [seasonId]: result.episodes }));
        toast.success("Episode order saved");
        return true;
      } catch (err: any) {
        setEpisodes((prev) => ({ ...prev, [seasonId]: previous }));
        toast.error("Could not reorder episodes", apiMessage(err, "Nothing was changed."));
        return false;
      }
    },
    [episodes, toast]
  );

  const recount = useCallback(async () => {
    try {
      await tvApi.recount(showId);
      await load();
      toast.success("Counts rebuilt from the database");
    } catch (err: any) {
      toast.error("Could not rebuild counts", apiMessage(err, "Please try again."));
    }
  }, [showId, load, toast]);

  return {
    show,
    seasons,
    episodes,
    loadingEpisodes,
    loading,
    error,
    saveState,
    reload: load,
    loadEpisodes,
    patchShow,
    createSeason,
    updateSeason,
    deleteSeason,
    reorderSeasons,
    createEpisode,
    createEpisodesBulk,
    updateEpisode,
    deleteEpisode,
    reorderEpisodes,
    recount,
  };
}

export type ShowWorkspace = ReturnType<typeof useShowWorkspace>;
