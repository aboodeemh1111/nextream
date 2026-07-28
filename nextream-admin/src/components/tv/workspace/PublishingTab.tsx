"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaRegCircle,
  FaSync,
  FaTrashAlt,
} from "react-icons/fa";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Switch,
  useConfirm,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { hasMedia } from "@/lib/media";
import { apiMessage, tvApi } from "@/lib/tvApi";
import type { ShowWorkspace } from "../useShowWorkspace";

interface Check {
  label: string;
  done: boolean;
  detail: string;
  /** A miss here only makes the show worse, not broken. */
  advisory?: boolean;
}

export function PublishingTab({ workspace }: { workspace: ShowWorkspace }) {
  const { show, seasons, patchShow, recount } = workspace;
  const router = useRouter();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const [recounting, setRecounting] = useState(false);

  const clientBase =
    process.env.NEXT_PUBLIC_CLIENT_BASE_URL || "http://localhost:3000";

  const checks = useMemo<Check[]>(() => {
    if (!show) return [];

    const publishedSeasons = seasons.filter((season) => season.published);
    const publishedEpisodes = seasons.reduce(
      (sum, season) => sum + (season.publishedEpisodesCount ?? 0),
      0
    );

    return [
      {
        label: "Has a title",
        done: Boolean(show.title?.trim()),
        detail: show.title?.trim() ? show.title : "Required",
      },
      {
        label: "Has an overview",
        done: Boolean(show.overview?.trim()),
        detail: show.overview?.trim()
          ? "Written"
          : "Shown on the details page — viewers see an empty block without it",
        advisory: true,
      },
      {
        label: "Has poster artwork",
        done: hasMedia(show.poster),
        detail: hasMedia(show.poster)
          ? "Uploaded"
          : "The show grid falls back to a placeholder tile",
        advisory: true,
      },
      {
        label: "Has backdrop artwork",
        done: hasMedia(show.backdrop),
        detail: hasMedia(show.backdrop) ? "Uploaded" : "Used as the hero image",
        advisory: true,
      },
      {
        label: "At least one published season",
        done: publishedSeasons.length > 0,
        detail: publishedSeasons.length
          ? `${pluralize(publishedSeasons.length, "season")} published`
          : "Unpublished seasons stay hidden even when the show is live",
      },
      {
        label: "At least one published episode",
        done: publishedEpisodes > 0,
        detail: publishedEpisodes
          ? `${pluralize(publishedEpisodes, "episode")} published`
          : "There is nothing for a viewer to watch yet",
      },
    ];
  }, [show, seasons]);

  if (!show) return null;

  const blockers = checks.filter((check) => !check.done && !check.advisory);

  const remove = async () => {
    const ok = await confirm({
      title: `Delete "${show.title}"?`,
      description: (
        <>
          This deletes the show, {pluralize(show.seasonsCount ?? 0, "season")} and{" "}
          {pluralize(show.episodesCount ?? 0, "episode")}, along with every uploaded
          poster, backdrop, video, still and subtitle file. This cannot be undone.
        </>
      ),
      confirmLabel: "Delete permanently",
      tone: "danger",
      requireTyped: show.title,
    });
    if (!ok) return;

    try {
      setDeleting(true);
      const result = await tvApi.deleteShow(show._id);
      toast.success(
        "Show deleted",
        `${result.deleted.seasons} season(s) and ${result.deleted.episodes} episode(s) removed.`
      );
      router.push("/tv");
    } catch (err: any) {
      setDeleting(false);
      toast.error("Could not delete the show", apiMessage(err, "Please try again."));
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader
            title="Visibility"
            description="Controls whether the client apps can see this show at all."
          />
          <CardBody className="space-y-4">
            <Switch
              checked={Boolean(show.published)}
              onChange={(published) => void patchShow({ published })}
              label={show.published ? "Published" : "Draft"}
              description={
                show.published
                  ? "Visible in the apps, subject to each season's own state."
                  : "Only visible here in the admin."
              }
            />

            {!show.published && blockers.length > 0 && (
              <div className="flex items-start gap-2 rounded-control border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
                <FaExclamationTriangle className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  Publishing now would show an empty page:{" "}
                  {blockers.map((check) => check.label.toLowerCase()).join(", ")}.
                </span>
              </div>
            )}

            {show.published && (
              <a
                href={`${clientBase}/series/${show.slug || show._id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FaExternalLinkAlt aria-hidden />
                Open on the site
              </a>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Readiness"
            description="What a viewer will find when this goes live."
          />
          <CardBody>
            <ul className="space-y-3">
              {checks.map((check) => (
                <li key={check.label} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0",
                      check.done
                        ? "text-success"
                        : check.advisory
                        ? "text-subtle-foreground"
                        : "text-warning"
                    )}
                    aria-hidden
                  >
                    {check.done ? <FaCheckCircle /> : <FaRegCircle />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">
                      {check.label}
                      {!check.done && check.advisory && (
                        <span className="ml-2 text-xs text-subtle-foreground">optional</span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">{check.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Counts" />
          <CardBody className="space-y-3">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Seasons</dt>
                <dd className="tabular-nums text-foreground">{show.seasonsCount ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Episodes</dt>
                <dd className="tabular-nums text-foreground">{show.episodesCount ?? 0}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Counts are recalculated on every write. Rebuild them if a show
              predates that and still reads zero.
            </p>
            <Button
              size="sm"
              icon={<FaSync />}
              loading={recounting}
              onClick={async () => {
                setRecounting(true);
                await recount();
                setRecounting(false);
              }}
            >
              Rebuild counts
            </Button>
          </CardBody>
        </Card>

        <Card className="border-danger/30">
          <CardHeader title="Danger zone" />
          <CardBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Deleting removes every season and episode under this show, and
              reaps their files from the bucket.
            </p>
            <Button
              variant="danger"
              icon={<FaTrashAlt />}
              loading={deleting}
              onClick={remove}
            >
              Delete show
            </Button>
          </CardBody>
        </Card>
      </div>

      {confirmDialog}
    </div>
  );
}
