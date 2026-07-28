"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaChevronDown,
  FaChevronRight,
  FaEdit,
  FaExclamationTriangle,
  FaGripVertical,
  FaLayerGroup,
  FaPlus,
  FaTrashAlt,
} from "react-icons/fa";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  PublishBadge,
  SkeletonRows,
  Switch,
  useConfirm,
  useToast,
} from "@/components/ui";
import { useUploads } from "@/components/upload/UploadProvider";
import { ShowPoster } from "@/components/tv/ShowPoster";
import { cn } from "@/lib/cn";
import { episodeCode, formatDuration, pluralize } from "@/lib/format";
import type { Episode, Season } from "@/lib/tvApi";
import type { ShowWorkspace } from "../useShowWorkspace";
import { BulkEpisodeDialog, type BulkRow } from "./BulkEpisodeDialog";
import { EpisodeSheet } from "./EpisodeSheet";
import { SeasonDialog } from "./SeasonDialog";

export function SeasonsTab({ workspace }: { workspace: ShowWorkspace }) {
  const {
    show,
    seasons,
    episodes,
    loadingEpisodes,
    loadEpisodes,
    createSeason,
    updateSeason,
    deleteSeason,
    reorderSeasons,
    createEpisodesBulk,
    updateEpisode,
    deleteEpisode,
    reorderEpisodes,
  } = workspace;

  const toast = useToast();
  const uploads = useUploads();
  const { confirm, confirmDialog } = useConfirm();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [seasonDialog, setSeasonDialog] = useState<{ open: boolean; season: Season | null }>({
    open: false,
    season: null,
  });
  const [bulkSeason, setBulkSeason] = useState<Season | null>(null);
  const [editing, setEditing] = useState<{ seasonId: string; episode: Episode } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  /**
   * Uploads started by the bulk flow, keyed by upload id.
   *
   * Bulk create makes the episodes first so their numbering is settled, then
   * attaches each video when its transfer lands. Nothing here blocks: the admin
   * can keep working while a dozen files go up.
   */
  const pendingAttachments = useRef(
    new Map<string, { seasonId: string; episodeId: string }>()
  );

  useEffect(() => {
    if (pendingAttachments.current.size === 0) return;

    for (const item of uploads.items) {
      const target = pendingAttachments.current.get(item.id);
      if (!target) continue;

      if (item.status === "done" && item.result) {
        pendingAttachments.current.delete(item.id);
        void updateEpisode(target.seasonId, target.episodeId, {
          videoSources: [{ label: "HD", url: item.result.key }],
        });
      } else if (item.status === "error") {
        pendingAttachments.current.delete(item.id);
      }
    }
  }, [uploads.items, updateEpisode]);

  const toggle = (season: Season) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(season._id)) {
        next.delete(season._id);
      } else {
        next.add(season._id);
        // Episodes load on expand. They used to sit behind a "Load episodes"
        // button that hit a shadowed route and silently returned nothing.
        void loadEpisodes(season._id);
      }
      return next;
    });
  };

  const nextSeasonNumber = useMemo(
    () => seasons.reduce((max, season) => Math.max(max, season.seasonNumber), 0) + 1,
    [seasons]
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= seasons.length || from === to) return;
    const next = [...seasons];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    // Applied immediately: the previous UI staged a reorder locally and threw
    // it away unless you found the "Save Order" button before navigating.
    void reorderSeasons(next);
  };

  const removeSeason = async (season: Season) => {
    const count = season.episodesCount ?? 0;
    const ok = await confirm({
      title: `Delete season ${season.seasonNumber}?`,
      description: count
        ? `This also deletes ${pluralize(count, "episode")} and their uploaded video, stills and subtitles. This cannot be undone.`
        : "This season has no episodes. This cannot be undone.",
      confirmLabel: "Delete season",
      tone: "danger",
      requireTyped: count > 0 ? `season ${season.seasonNumber}` : undefined,
    });
    if (ok) void deleteSeason(season._id);
  };

  const runBulk = async (rows: BulkRow[], publish: boolean) => {
    const season = bulkSeason;
    if (!season) return;

    const result = await createEpisodesBulk(
      season._id,
      rows.map((row) => ({
        title: row.title.trim() || row.file.name,
        episodeNumber: Number(row.episodeNumber),
        published: publish,
      }))
    );
    if (!result) return;

    // Match created episodes back to their files by number, so a partially
    // rejected batch still attaches the right video to the right episode.
    const byNumber = new Map(result.created.map((episode) => [episode.episodeNumber, episode]));
    for (const row of rows) {
      const episode = byNumber.get(Number(row.episodeNumber));
      if (!episode) continue;

      const uploadId = uploads.enqueue({
        file: row.file,
        prefix: "episodes",
        fieldId: `episode:${episode._id}:source:0`,
        label: `${episodeCode(season.seasonNumber, episode.episodeNumber)} · ${episode.title}`,
      });
      pendingAttachments.current.set(uploadId, {
        seasonId: season._id,
        episodeId: episode._id,
      });
    }

    setExpanded((prev) => new Set(prev).add(season._id));
    if (result.created.length) {
      toast.info(
        "Videos are uploading",
        "Each episode gets its file attached as the upload finishes. You can leave this page."
      );
    }
  };

  if (!show) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {seasons.length === 0
            ? "No seasons yet."
            : `${pluralize(seasons.length, "season")} · ${pluralize(
                show.episodesCount ?? 0,
                "episode"
              )}`}
        </p>
        <Button
          variant="primary"
          icon={<FaPlus />}
          onClick={() => setSeasonDialog({ open: true, season: null })}
        >
          Add season
        </Button>
      </div>

      {seasons.length === 0 ? (
        <EmptyState
          icon={<FaLayerGroup />}
          title="No seasons yet"
          description="Add a season, then drop your episode files onto it."
          action={
            <Button
              variant="primary"
              icon={<FaPlus />}
              onClick={() => setSeasonDialog({ open: true, season: null })}
            >
              Add season
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {seasons.map((season, index) => {
            const isOpen = expanded.has(season._id);
            const list = episodes[season._id];

            return (
              <li key={season._id}>
                <Card
                  draggable
                  onDragStart={() => setDragId(season._id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!dragId || dragId === season._id) return;
                    const from = seasons.findIndex((s) => s._id === dragId);
                    setDragId(null);
                    move(from, index);
                  }}
                  className={cn(
                    "overflow-hidden transition-opacity",
                    dragId === season._id && "opacity-50"
                  )}
                >
                  <div className="flex items-center gap-3 p-3">
                    <span
                      className="cursor-grab text-subtle-foreground active:cursor-grabbing"
                      aria-hidden
                    >
                      <FaGripVertical />
                    </span>

                    <button
                      type="button"
                      onClick={() => toggle(season)}
                      aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="text-subtle-foreground" aria-hidden>
                        {isOpen ? <FaChevronDown /> : <FaChevronRight />}
                      </span>
                      <ShowPoster
                        src={season.poster ?? show.poster}
                        title={`Season ${season.seasonNumber}`}
                        rounded="rounded-control"
                        className="h-12 w-8 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {season.name?.trim() || `Season ${season.seasonNumber}`}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Season {season.seasonNumber} ·{" "}
                          {pluralize(season.episodesCount ?? 0, "episode")}
                          {season.publishedEpisodesCount != null &&
                            season.episodesCount != null &&
                            season.publishedEpisodesCount < season.episodesCount &&
                            ` · ${season.episodesCount - season.publishedEpisodesCount} draft`}
                        </span>
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <PublishBadge published={season.published} />

                      <span className="hidden items-center sm:flex">
                        <IconButton
                          label={`Move season ${season.seasonNumber} up`}
                          size="sm"
                          variant="ghost"
                          disabled={index === 0}
                          onClick={() => move(index, index - 1)}
                        >
                          <span aria-hidden>↑</span>
                        </IconButton>
                        <IconButton
                          label={`Move season ${season.seasonNumber} down`}
                          size="sm"
                          variant="ghost"
                          disabled={index === seasons.length - 1}
                          onClick={() => move(index, index + 1)}
                        >
                          <span aria-hidden>↓</span>
                        </IconButton>
                      </span>

                      <Button
                        size="sm"
                        icon={<FaPlus />}
                        onClick={() => {
                          void loadEpisodes(season._id);
                          setBulkSeason(season);
                        }}
                      >
                        Episodes
                      </Button>
                      <IconButton
                        label={`Edit season ${season.seasonNumber}`}
                        size="sm"
                        variant="ghost"
                        onClick={() => setSeasonDialog({ open: true, season })}
                      >
                        <FaEdit />
                      </IconButton>
                      <IconButton
                        label={`Delete season ${season.seasonNumber}`}
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSeason(season)}
                      >
                        <FaTrashAlt />
                      </IconButton>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border bg-surface-2/40 px-3 py-3">
                      {loadingEpisodes[season._id] && !list ? (
                        <SkeletonRows count={3} />
                      ) : !list || list.length === 0 ? (
                        <EmptyState
                          className="border-0 bg-transparent py-6"
                          title="No episodes in this season"
                          description="Drop your episode files here to create them in one go."
                          action={
                            <Button
                              size="sm"
                              variant="primary"
                              icon={<FaPlus />}
                              onClick={() => setBulkSeason(season)}
                            >
                              Add episodes
                            </Button>
                          }
                        />
                      ) : (
                        <EpisodeList
                          season={season}
                          episodes={list}
                          onEdit={(episode) => setEditing({ seasonId: season._id, episode })}
                          onTogglePublish={(episode) =>
                            void updateEpisode(season._id, episode._id, {
                              published: !episode.published,
                            })
                          }
                          onDelete={async (episode) => {
                            const ok = await confirm({
                              title: `Delete ${episodeCode(
                                season.seasonNumber,
                                episode.episodeNumber
                              )}?`,
                              description:
                                "Its video, still image and subtitle files are deleted from the bucket too. This cannot be undone.",
                              confirmLabel: "Delete episode",
                              tone: "danger",
                            });
                            if (ok) void deleteEpisode(season._id, episode._id);
                          }}
                          onReorder={(ordered) => void reorderEpisodes(season._id, ordered)}
                        />
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <SeasonDialog
        open={seasonDialog.open}
        season={seasonDialog.season}
        suggestedNumber={nextSeasonNumber}
        onClose={() => setSeasonDialog({ open: false, season: null })}
        onSubmit={async (payload) => {
          if (seasonDialog.season) {
            return updateSeason(seasonDialog.season._id, payload);
          }
          return Boolean(await createSeason(payload));
        }}
      />

      <BulkEpisodeDialog
        open={Boolean(bulkSeason)}
        season={bulkSeason}
        existingNumbers={(bulkSeason ? episodes[bulkSeason._id] ?? [] : []).map(
          (episode) => episode.episodeNumber
        )}
        onClose={() => setBulkSeason(null)}
        onSubmit={runBulk}
      />

      <EpisodeSheet
        open={Boolean(editing)}
        episode={editing?.episode ?? null}
        onClose={() => setEditing(null)}
        onSave={(changes) =>
          editing
            ? updateEpisode(editing.seasonId, editing.episode._id, changes)
            : Promise.resolve(null)
        }
      />

      {confirmDialog}
    </div>
  );
}

function EpisodeList({
  season,
  episodes,
  onEdit,
  onTogglePublish,
  onDelete,
  onReorder,
}: {
  season: Season;
  episodes: Episode[];
  onEdit: (episode: Episode) => void;
  onTogglePublish: (episode: Episode) => void;
  onDelete: (episode: Episode) => void;
  onReorder: (ordered: Episode[]) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= episodes.length || from === to) return;
    const next = [...episodes];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  return (
    <ul className="divide-y divide-border">
      {episodes.map((episode, index) => {
        const playable = (episode.videoSources ?? []).some((source) => source.url);

        return (
          <li
            key={episode._id}
            draggable
            onDragStart={() => setDragId(episode._id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!dragId || dragId === episode._id) return;
              move(
                episodes.findIndex((item) => item._id === dragId),
                index
              );
              setDragId(null);
            }}
            className={cn(
              "flex items-center gap-3 py-2.5 transition-opacity",
              dragId === episode._id && "opacity-50"
            )}
          >
            <span className="cursor-grab text-subtle-foreground active:cursor-grabbing" aria-hidden>
              <FaGripVertical />
            </span>

            <ShowPoster
              src={episode.stillPath}
              title={episode.title}
              rounded="rounded-control"
              className="h-10 w-16 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                <span className="text-muted-foreground tabular-nums">
                  {episodeCode(season.seasonNumber, episode.episodeNumber)}
                </span>{" "}
                {episode.title}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDuration(episode.duration)}</span>
                {playable ? (
                  <Badge tone="neutral">
                    {pluralize(episode.videoSources!.length, "source")}
                  </Badge>
                ) : (
                  <Badge tone="warning">
                    <FaExclamationTriangle className="text-[10px]" aria-hidden />
                    No video
                  </Badge>
                )}
                {(episode.subtitles?.length ?? 0) > 0 && (
                  <Badge tone="info">
                    {pluralize(episode.subtitles!.length, "subtitle")}
                  </Badge>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Switch
                checked={Boolean(episode.published)}
                onChange={() => onTogglePublish(episode)}
                id={`publish-${episode._id}`}
                aria-label={`Publish ${episode.title}`}
              />
              <IconButton
                label={`Edit ${episode.title}`}
                size="sm"
                variant="ghost"
                onClick={() => onEdit(episode)}
              >
                <FaEdit />
              </IconButton>
              <IconButton
                label={`Delete ${episode.title}`}
                size="sm"
                variant="ghost"
                onClick={() => onDelete(episode)}
              >
                <FaTrashAlt />
              </IconButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
