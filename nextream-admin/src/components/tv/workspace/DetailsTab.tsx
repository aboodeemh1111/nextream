"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FaCheck, FaExclamationCircle, FaSpinner } from "react-icons/fa";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  TagsInput,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { slugify } from "@/lib/format";
import type { TVShow } from "@/lib/tvApi";
import type { ShowWorkspace } from "../useShowWorkspace";

const AUTOSAVE_MS = 900;

type Draft = {
  title: string;
  slug: string;
  overview: string;
  genres: string[];
  tags: string[];
  status: "ongoing" | "ended";
  releaseYear: string;
  rating: string;
  trailerUrl: string;
};

function draftFrom(show: TVShow): Draft {
  return {
    title: show.title ?? "",
    slug: show.slug ?? "",
    overview: show.overview ?? "",
    genres: show.genres ?? [],
    tags: show.tags ?? [],
    status: show.status ?? "ongoing",
    releaseYear: show.releaseYear != null ? String(show.releaseYear) : "",
    rating: show.rating != null ? String(show.rating) : "",
    trailerUrl: show.trailerUrl ?? "",
  };
}

/** Only the fields that actually changed, so a save never rewrites the document. */
function diff(draft: Draft, show: TVShow): Partial<TVShow> {
  const changes: Partial<TVShow> = {};
  const base = draftFrom(show);

  if (draft.title.trim() !== base.title) changes.title = draft.title.trim();
  if (draft.slug.trim() !== base.slug) changes.slug = draft.slug.trim();
  if (draft.overview !== base.overview) changes.overview = draft.overview;
  if (draft.status !== base.status) changes.status = draft.status;
  if (draft.trailerUrl.trim() !== base.trailerUrl) changes.trailerUrl = draft.trailerUrl.trim();

  if (draft.genres.join("|") !== base.genres.join("|")) changes.genres = draft.genres;
  if (draft.tags.join("|") !== base.tags.join("|")) changes.tags = draft.tags;

  if (draft.releaseYear !== base.releaseYear) {
    const year = Number(draft.releaseYear);
    changes.releaseYear = draft.releaseYear.trim() && Number.isFinite(year) ? year : undefined;
  }
  if (draft.rating !== base.rating) {
    const rating = Number(draft.rating);
    changes.rating = draft.rating.trim() && Number.isFinite(rating) ? rating : undefined;
  }

  return changes;
}

/**
 * Autosaving details form.
 *
 * The old edit page had one Save button at the top of a page whose lower half
 * managed seasons and episodes with immediate writes — so half the screen saved
 * instantly and half did not, and leaving without pressing Save lost the rest.
 */
export function DetailsTab({ workspace }: { workspace: ShowWorkspace }) {
  const { show, patchShow, saveState } = workspace;
  const [draft, setDraft] = useState<Draft | null>(show ? draftFrom(show) : null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  // Adopt server state whenever the record itself changes.
  useEffect(() => {
    if (show) setDraft(draftFrom(show));
  }, [show?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback(
    (next: Draft) => {
      if (!show) return;
      if (timer.current) window.clearTimeout(timer.current);

      timer.current = window.setTimeout(() => {
        if (!next.title.trim()) {
          setTitleError("A title is required");
          return;
        }
        setTitleError(null);
        const changes = diff(next, show);
        if (Object.keys(changes).length > 0) void patchShow(changes);
      }, AUTOSAVE_MS);
    },
    [show, patchShow]
  );

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const update = (changes: Partial<Draft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...changes };
      scheduleSave(next);
      return next;
    });
  };

  if (!draft || !show) return null;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="Show details"
          description="Changes save automatically."
          actions={<SaveIndicator state={saveState} />}
        />
        <CardBody className="space-y-4">
          <Input
            label="Title"
            required
            value={draft.title}
            error={titleError}
            onChange={(e) => update({ title: e.target.value })}
          />

          <Textarea
            label="Overview"
            rows={5}
            value={draft.overview}
            onChange={(e) => update({ overview: e.target.value })}
            placeholder="What the show is about. Shown on the details page."
          />

          <Input
            label="Slug"
            value={draft.slug}
            hint="Used in the public URL. Must be unique across all shows."
            onChange={(e) => update({ slug: e.target.value })}
            labelSuffix={
              draft.title.trim() && draft.slug !== slugify(draft.title) ? (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => update({ slug: slugify(draft.title) })}
                >
                  Match title
                </button>
              ) : null
            }
          />

          <Input
            label="Trailer URL"
            type="url"
            value={draft.trailerUrl}
            onChange={(e) => update({ trailerUrl: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=…"
            hint="Only hosts on the API's media allowlist are accepted."
          />
        </CardBody>
      </Card>

      <Card className="h-fit">
        <CardHeader title="Classification" />
        <CardBody className="space-y-4">
          <TagsInput
            label="Genres"
            value={draft.genres}
            onChange={(genres) => update({ genres })}
            placeholder="drama, sci-fi"
            hint="Comma separated."
          />

          <TagsInput
            label="Tags"
            value={draft.tags}
            onChange={(tags) => update({ tags })}
            placeholder="award-winning, family"
            hint="Comma separated."
          />

          <Select
            label="Airing status"
            value={draft.status}
            onChange={(e) => update({ status: e.target.value as Draft["status"] })}
          >
            <option value="ongoing">Ongoing</option>
            <option value="ended">Ended</option>
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First aired"
              inputMode="numeric"
              value={draft.releaseYear}
              onChange={(e) => update({ releaseYear: e.target.value })}
              placeholder="2019"
            />
            <Input
              label="Rating"
              inputMode="decimal"
              value={draft.rating}
              onChange={(e) => update({ rating: e.target.value })}
              placeholder="8.4"
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export function SaveIndicator({ state }: { state: ShowWorkspace["saveState"] }) {
  if (state === "idle") return null;

  const config = {
    saving: { icon: <FaSpinner className="animate-spin" />, text: "Saving…", tone: "text-muted-foreground" },
    saved: { icon: <FaCheck />, text: "Saved", tone: "text-success" },
    error: { icon: <FaExclamationCircle />, text: "Not saved", tone: "text-danger" },
  }[state];

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-1.5 text-xs", config.tone)}
    >
      <span aria-hidden>{config.icon}</span>
      {config.text}
    </span>
  );
}
