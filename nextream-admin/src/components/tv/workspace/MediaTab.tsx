"use client";

import { Card, CardBody, CardHeader } from "@/components/ui";
import { MediaField } from "@/components/upload/MediaField";
import { previewFor } from "@/lib/media";
import type { ShowWorkspace } from "../useShowWorkspace";
import { SaveIndicator } from "./DetailsTab";

/**
 * Artwork for the show itself.
 *
 * Season artwork lives on each season row, and episode stills live in the
 * episode panel — the old season editor asked for "Poster URL" and "Banner URL"
 * as raw text boxes, so pasting anything off the API's allowlist failed with a
 * generic "Failed to update season" toast.
 */
export function MediaTab({ workspace }: { workspace: ShowWorkspace }) {
  const { show, patchShow, saveState } = workspace;
  if (!show) return null;

  return (
    <Card>
      <CardHeader
        title="Artwork"
        description="Uploads go straight to the bucket and are saved as soon as they finish."
        actions={<SaveIndicator state={saveState} />}
      />
      <CardBody className="grid gap-6 md:grid-cols-2">
        <MediaField
          fieldId={`show:${show._id}:poster`}
          label="Poster"
          prefix="shows"
          kind="image"
          aspect="poster"
          value={show.poster ?? ""}
          previewUrl={previewFor(show.poster)}
          onChange={(key) => void patchShow({ poster: key })}
          hint="Portrait artwork, 2:3 — used on the show grid and details page"
        />

        <MediaField
          fieldId={`show:${show._id}:backdrop`}
          label="Backdrop"
          prefix="shows"
          kind="image"
          aspect="wide"
          value={show.backdrop ?? ""}
          previewUrl={previewFor(show.backdrop)}
          onChange={(key) => void patchShow({ backdrop: key })}
          hint="Landscape hero image, 16:9"
        />
      </CardBody>
    </Card>
  );
}
