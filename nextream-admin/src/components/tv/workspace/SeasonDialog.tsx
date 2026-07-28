"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, Input, Switch, Textarea } from "@/components/ui";
import { MediaField } from "@/components/upload/MediaField";
import { previewFor } from "@/lib/media";
import type { Season } from "@/lib/tvApi";

interface Draft {
  seasonNumber: string;
  name: string;
  overview: string;
  airDate: string;
  published: boolean;
  poster: string;
  backdrop: string;
}

const EMPTY: Draft = {
  seasonNumber: "",
  name: "",
  overview: "",
  airDate: "",
  published: false,
  poster: "",
  backdrop: "",
};

/**
 * Create and edit a season, artwork included.
 *
 * The old modal took poster and backdrop as free-text URL boxes while the
 * create wizard used file uploaders for the same two fields, so which one you
 * got depended on where you happened to be standing.
 */
export function SeasonDialog({
  open,
  season,
  suggestedNumber,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** null for create. */
  season: Season | null;
  suggestedNumber: number;
  onClose: () => void;
  onSubmit: (payload: Partial<Season>) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDraft(
      season
        ? {
            seasonNumber: String(season.seasonNumber),
            name: season.name ?? "",
            overview: season.overview ?? "",
            airDate: season.airDate ? season.airDate.slice(0, 10) : "",
            published: Boolean(season.published),
            poster: season.poster ?? "",
            backdrop: season.backdrop ?? "",
          }
        : { ...EMPTY, seasonNumber: String(suggestedNumber) }
    );
  }, [open, season, suggestedNumber]);

  const update = (changes: Partial<Draft>) =>
    setDraft((prev) => ({ ...prev, ...changes }));

  const submit = async () => {
    const number = Number(draft.seasonNumber);
    if (draft.seasonNumber.trim() && (!Number.isInteger(number) || number < 0)) {
      setError("Season number must be a whole number (0 is allowed, for specials)");
      return;
    }

    setSaving(true);
    setError(null);
    const ok = await onSubmit({
      seasonNumber: draft.seasonNumber.trim() ? number : undefined,
      name: draft.name.trim() || undefined,
      overview: draft.overview.trim() || undefined,
      airDate: draft.airDate || undefined,
      published: draft.published,
      poster: draft.poster || undefined,
      backdrop: draft.backdrop || undefined,
    });
    setSaving(false);
    if (ok) onClose();
  };

  const fieldScope = season ? `season:${season._id}` : "season:new";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={season ? `Edit season ${season.seasonNumber}` : "Add season"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            {season ? "Save season" : "Add season"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7rem_1fr]">
          <Input
            label="Number"
            inputMode="numeric"
            value={draft.seasonNumber}
            onChange={(e) => update({ seasonNumber: e.target.value })}
            hint={season ? undefined : "Leave blank to append"}
          />
          <Input
            label="Name"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder={`e.g. Season ${draft.seasonNumber || suggestedNumber}: Origins`}
          />
        </div>

        <Textarea
          label="Overview"
          rows={3}
          value={draft.overview}
          onChange={(e) => update({ overview: e.target.value })}
        />

        <Input
          label="Air date"
          type="date"
          value={draft.airDate}
          onChange={(e) => update({ airDate: e.target.value })}
        />

        <Switch
          checked={draft.published}
          onChange={(published) => update({ published })}
          label="Published"
          description="An unpublished season hides all of its episodes."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <MediaField
            fieldId={`${fieldScope}:poster`}
            label="Season poster"
            prefix="shows"
            kind="image"
            aspect="poster"
            value={draft.poster}
            previewUrl={previewFor(draft.poster)}
            onChange={(key) => update({ poster: key })}
          />
          <MediaField
            fieldId={`${fieldScope}:backdrop`}
            label="Season backdrop"
            prefix="shows"
            kind="image"
            aspect="wide"
            value={draft.backdrop}
            previewUrl={previewFor(draft.backdrop)}
            onChange={(key) => update({ backdrop: key })}
          />
        </div>
      </div>
    </Dialog>
  );
}
