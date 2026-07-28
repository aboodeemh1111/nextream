"use client";

import { useEffect, useState } from "react";
import { FaMagic, FaPlus, FaTrashAlt } from "react-icons/fa";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  IconButton,
  Input,
  Sheet,
  Switch,
  Textarea,
  useToast,
} from "@/components/ui";
import { MediaField } from "@/components/upload/MediaField";
import { episodeCode, formatDuration } from "@/lib/format";
import { previewFor } from "@/lib/media";
import type { Episode, SubtitleTrack, VideoSource } from "@/lib/tvApi";

interface Draft {
  title: string;
  episodeNumber: string;
  overview: string;
  duration: string;
  airDate: string;
  published: boolean;
  stillPath: string;
  videoSources: VideoSource[];
  subtitles: SubtitleTrack[];
}

function draftFrom(episode: Episode): Draft {
  return {
    title: episode.title ?? "",
    episodeNumber: String(episode.episodeNumber ?? ""),
    overview: episode.overview ?? "",
    duration: episode.duration != null ? String(episode.duration) : "",
    airDate: episode.airDate ? episode.airDate.slice(0, 10) : "",
    published: Boolean(episode.published),
    stillPath: episode.stillPath ?? "",
    // Copies, not references: editing a row must not mutate the list behind the panel.
    videoSources: (episode.videoSources ?? []).map((source) => ({ ...source })),
    subtitles: (episode.subtitles ?? []).map((track) => ({ ...track })),
  };
}

/**
 * Full episode editor in a side panel.
 *
 * The route it replaces rebuilt `videoSources` as `[{label:"HD", url}]` and
 * `subtitles` as `[{lang, url}]` from the first entry of each on every save — so
 * opening an episode with three quality sources or five subtitle tracks and
 * pressing Save silently deleted all but one of each.
 */
export function EpisodeSheet({
  open,
  episode,
  onClose,
  onSave,
}: {
  open: boolean;
  episode: Episode | null;
  onClose: () => void;
  onSave: (changes: Partial<Episode>) => Promise<Episode | null>;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);

  useEffect(() => {
    setDraft(episode ? draftFrom(episode) : null);
  }, [episode?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!episode || !draft) return null;

  const update = (changes: Partial<Draft>) =>
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev));

  const updateSource = (index: number, changes: Partial<VideoSource>) =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            videoSources: prev.videoSources.map((source, i) =>
              i === index ? { ...source, ...changes } : source
            ),
          }
        : prev
    );

  const updateSubtitle = (index: number, changes: Partial<SubtitleTrack>) =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            subtitles: prev.subtitles.map((track, i) =>
              i === index ? { ...track, ...changes } : track
            ),
          }
        : prev
    );

  /** Reads the real length out of the attached video instead of guessing. */
  const probeDuration = () => {
    const source = draft.videoSources.find((s) => previewFor(s.url));
    if (!source) {
      toast.info("No playable source", "Upload a video first, then try again.");
      return;
    }

    setProbing(true);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      setProbing(false);
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        update({ duration: String(Math.round(probe.duration)) });
      } else {
        toast.error("Could not read the length", "The file did not report a duration.");
      }
      probe.src = "";
    };
    probe.onerror = () => {
      setProbing(false);
      toast.error("Could not read the length", "The video could not be loaded.");
    };
    probe.src = previewFor(source.url);
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error("Title is required");
      return;
    }

    const number = Number(draft.episodeNumber);
    if (draft.episodeNumber.trim() && (!Number.isInteger(number) || number < 0)) {
      toast.error("Episode number must be a whole number");
      return;
    }

    const durationValue = Number(draft.duration);

    setSaving(true);
    const result = await onSave({
      title: draft.title.trim(),
      episodeNumber: draft.episodeNumber.trim() ? number : undefined,
      overview: draft.overview,
      duration:
        draft.duration.trim() && Number.isFinite(durationValue) ? durationValue : undefined,
      airDate: draft.airDate || undefined,
      published: draft.published,
      stillPath: draft.stillPath || undefined,
      // Every source and track survives the round trip.
      videoSources: draft.videoSources.filter((source) => source.url),
      subtitles: draft.subtitles.filter((track) => track.url),
    });
    setSaving(false);

    if (result) {
      toast.success("Episode saved");
      onClose();
    }
  };

  const durationSeconds = Number(draft.duration);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${episodeCode(episode.seasonNumber, episode.episodeNumber)} · ${episode.title}`}
      description="Sources and subtitle tracks are kept exactly as listed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save episode
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7rem_1fr]">
          <Input
            label="Number"
            inputMode="numeric"
            value={draft.episodeNumber}
            onChange={(e) => update({ episodeNumber: e.target.value })}
          />
          <Input
            label="Title"
            required
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>

        <Textarea
          label="Overview"
          rows={3}
          value={draft.overview}
          onChange={(e) => update({ overview: e.target.value })}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Duration (seconds)"
            inputMode="numeric"
            value={draft.duration}
            onChange={(e) => update({ duration: e.target.value })}
            hint={
              draft.duration.trim() && Number.isFinite(durationSeconds)
                ? `That is ${formatDuration(durationSeconds)}`
                : "Stored in seconds"
            }
            labelSuffix={
              <button
                type="button"
                onClick={probeDuration}
                disabled={probing}
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                <FaMagic aria-hidden />
                {probing ? "Reading…" : "Read from video"}
              </button>
            }
          />
          <Input
            label="Air date"
            type="date"
            value={draft.airDate}
            onChange={(e) => update({ airDate: e.target.value })}
          />
        </div>

        <Switch
          checked={draft.published}
          onChange={(published) => update({ published })}
          label="Published"
          description="Unpublished episodes stay hidden from the client apps."
        />

        <MediaField
          fieldId={`episode:${episode._id}:still`}
          label="Still image"
          prefix="episodes"
          kind="image"
          aspect="wide"
          value={draft.stillPath}
          previewUrl={previewFor(draft.stillPath)}
          onChange={(key) => update({ stillPath: key })}
          hint="Thumbnail shown in episode lists, 16:9"
        />

        <Card>
          <CardHeader
            title="Video sources"
            description="One per quality or CDN. The first is used by default."
            actions={
              <Button
                size="sm"
                icon={<FaPlus />}
                onClick={() =>
                  update({
                    videoSources: [
                      ...draft.videoSources,
                      { label: draft.videoSources.length ? "Alternate" : "HD", url: "" },
                    ],
                  })
                }
              >
                Add source
              </Button>
            }
          />
          <CardBody className="space-y-4">
            {draft.videoSources.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No sources yet — this episode cannot play until one is added.
              </p>
            )}
            {draft.videoSources.map((source, index) => (
              <div
                key={index}
                className="space-y-3 rounded-control border border-border bg-surface-2/50 p-3"
              >
                <div className="flex items-end gap-2">
                  <Input
                    label="Label"
                    containerClassName="flex-1"
                    value={source.label ?? ""}
                    onChange={(e) => updateSource(index, { label: e.target.value })}
                    placeholder="1080p"
                  />
                  <IconButton
                    label={`Remove source ${index + 1}`}
                    variant="ghost"
                    onClick={() =>
                      update({
                        videoSources: draft.videoSources.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <FaTrashAlt />
                  </IconButton>
                </div>
                <MediaField
                  fieldId={`episode:${episode._id}:source:${index}`}
                  label="Video file"
                  prefix="episodes"
                  kind="video"
                  aspect="wide"
                  value={source.url}
                  previewUrl={previewFor(source.url)}
                  onChange={(key) => updateSource(index, { url: key })}
                />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Subtitles"
            description="WebVTT tracks, one per language."
            actions={
              <Button
                size="sm"
                icon={<FaPlus />}
                onClick={() =>
                  update({ subtitles: [...draft.subtitles, { lang: "en", url: "" }] })
                }
              >
                Add track
              </Button>
            }
          />
          <CardBody className="space-y-4">
            {draft.subtitles.length === 0 && (
              <p className="text-sm text-muted-foreground">No subtitle tracks.</p>
            )}
            {draft.subtitles.map((track, index) => (
              <div
                key={index}
                className="space-y-3 rounded-control border border-border bg-surface-2/50 p-3"
              >
                <div className="flex items-end gap-2">
                  <Input
                    label="Language code"
                    containerClassName="w-32"
                    value={track.lang ?? ""}
                    onChange={(e) => updateSubtitle(index, { lang: e.target.value })}
                    placeholder="en"
                  />
                  <div className="flex-1" />
                  <IconButton
                    label={`Remove subtitle track ${index + 1}`}
                    variant="ghost"
                    onClick={() =>
                      update({ subtitles: draft.subtitles.filter((_, i) => i !== index) })
                    }
                  >
                    <FaTrashAlt />
                  </IconButton>
                </div>
                <MediaField
                  fieldId={`episode:${episode._id}:subtitle:${index}`}
                  label="Subtitle file"
                  prefix="subs"
                  kind="subtitle"
                  aspect="wide"
                  value={track.url}
                  previewUrl={previewFor(track.url)}
                  onChange={(key) => updateSubtitle(index, { url: key })}
                  hint="WebVTT (.vtt)"
                />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </Sheet>
  );
}
