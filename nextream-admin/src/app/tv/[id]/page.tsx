"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  FaArrowLeft,
  FaExclamationTriangle,
  FaImages,
  FaInfoCircle,
  FaLayerGroup,
  FaRocket,
} from "react-icons/fa";
import AdminLayout from "@/components/AdminLayout";
import { ShowPoster } from "@/components/tv/ShowPoster";
import { useShowWorkspace } from "@/components/tv/useShowWorkspace";
import { DetailsTab, SaveIndicator } from "@/components/tv/workspace/DetailsTab";
import { MediaTab } from "@/components/tv/workspace/MediaTab";
import { PublishingTab } from "@/components/tv/workspace/PublishingTab";
import { SeasonsTab } from "@/components/tv/workspace/SeasonsTab";
import {
  Button,
  Card,
  EmptyState,
  PublishBadge,
  Skeleton,
  Tabs,
  type TabItem,
} from "@/components/ui";
import { pluralize } from "@/lib/format";

const TAB_IDS = ["details", "seasons", "media", "publishing"] as const;
type TabId = (typeof TAB_IDS)[number];

/**
 * One workspace per show.
 *
 * This replaces four routes: a four-step create wizard, a detail page, a
 * near-identical edit page, and two standalone episode routes. Seasons and
 * episodes are managed in place rather than by navigating away from the show
 * and back, and nothing is staged in component state waiting for a submit.
 */
export default function ShowWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showId = params?.id as string;

  const workspace = useShowWorkspace(showId);
  const { show, seasons, loading, error, saveState, reload } = workspace;

  const [tab, setTab] = useState<TabId>("details");

  // Deep links: /tv/<id>?tab=seasons survives a refresh and can be shared.
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested && TAB_IDS.includes(requested as TabId)) {
      setTab(requested as TabId);
    }
  }, [searchParams]);

  const chooseTab = (next: string) => {
    setTab(next as TabId);
    const query = new URLSearchParams(searchParams.toString());
    query.set("tab", next);
    router.replace(`/tv/${showId}?${query.toString()}`, { scroll: false });
  };

  const tabs: TabItem[] = [
    { id: "details", label: "Details", icon: <FaInfoCircle /> },
    {
      id: "seasons",
      label: "Seasons & Episodes",
      icon: <FaLayerGroup />,
      count: seasons.length,
    },
    { id: "media", label: "Artwork", icon: <FaImages /> },
    { id: "publishing", label: "Publishing", icon: <FaRocket /> },
  ];

  if (error) {
    return (
      <AdminLayout>
        <EmptyState
          tone="danger"
          icon={<FaExclamationTriangle />}
          title="Could not load this show"
          description={error}
          action={
            <>
              <Button variant="secondary" onClick={reload}>
                Try again
              </Button>
              <Link href="/tv">
                <Button variant="ghost">Back to shows</Button>
              </Link>
            </>
          }
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-5">
        <Link
          href="/tv"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <FaArrowLeft aria-hidden />
          All shows
        </Link>

        <Card className="w-full min-w-0 p-4">
          {loading || !show ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-24 w-16 rounded-control" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start gap-4">
              <ShowPoster
                src={show.poster}
                title={show.title}
                rounded="rounded-control"
                className="h-24 w-16 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    {show.title}
                  </h1>
                  <PublishBadge published={show.published} />
                  <SaveIndicator state={saveState} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pluralize(show.seasonsCount ?? 0, "season")} ·{" "}
                  {pluralize(show.episodesCount ?? 0, "episode")}
                  {show.slug && ` · /${show.slug}`}
                </p>
                {show.overview && (
                  <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-muted-foreground">
                    {show.overview}
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>

        <Tabs items={tabs} value={tab} onChange={chooseTab} />

        {loading || !show ? (
          <Card className="p-5">
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </Card>
        ) : (
          <div className="w-full min-w-0 animate-in">
            {tab === "details" && <DetailsTab workspace={workspace} />}
            {tab === "seasons" && <SeasonsTab workspace={workspace} />}
            {tab === "media" && <MediaTab workspace={workspace} />}
            {tab === "publishing" && <PublishingTab workspace={workspace} />}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
