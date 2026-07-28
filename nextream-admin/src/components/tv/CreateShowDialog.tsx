"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Input, Textarea, useToast } from "@/components/ui";
import { slugify } from "@/lib/format";
import { apiMessage, tvApi } from "@/lib/tvApi";

/**
 * Creates the show as a draft and opens its workspace.
 *
 * This replaces a four-step wizard that held the entire show — seasons,
 * episodes, uploaded media — in component state until a final submit fired
 * N+M sequential requests with no rollback. A failure halfway left a partial
 * show behind, a refresh lost everything, and the wizard's own episode
 * conflicts were swallowed so it could report success for episodes that were
 * never created. Persisting immediately makes all of that impossible.
 */
export function CreateShowDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setOverview("");
    setSlug("");
    setSlugTouched(false);
    setError(null);
  }, [open]);

  // Mirror the title until the admin edits the slug themselves.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  const submit = async () => {
    if (!title.trim()) {
      setError("A title is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const show = await tvApi.createShow({
        title: title.trim(),
        overview: overview.trim() || undefined,
        slug: slug.trim() || undefined,
        published: false,
      });
      toast.success("Draft created", `${show.title} is saved as a draft.`);
      onClose();
      router.push(`/tv/${show._id}`);
    } catch (err: any) {
      setError(apiMessage(err, "Could not create the show"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New TV show"
      description="Starts as a draft. Artwork, seasons and episodes come next."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!title.trim()}>
            Create draft
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

        <Input
          label="Title"
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Tom and Jerry Show"
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) submit();
          }}
        />

        <Textarea
          label="Overview"
          rows={3}
          value={overview}
          onChange={(e) => setOverview(e.target.value)}
          placeholder="A short description. You can fill this in later."
        />

        <Input
          label="Slug"
          value={slug}
          hint="Used in the public URL. Generated from the title unless you change it."
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
      </div>
    </Dialog>
  );
}
