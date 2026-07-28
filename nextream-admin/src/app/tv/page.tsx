"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FaExclamationTriangle,
  FaLayerGroup,
  FaPlus,
  FaSearch,
  FaTable,
  FaThLarge,
  FaTrashAlt,
  FaTv,
} from "react-icons/fa";
import AdminLayout from "@/components/AdminLayout";
import { CreateShowDialog } from "@/components/tv/CreateShowDialog";
import { ShowPoster } from "@/components/tv/ShowPoster";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  PublishBadge,
  Select,
  SkeletonCardGrid,
  SkeletonRows,
  useConfirm,
  useToast,
} from "@/components/ui";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/cn";
import { formatRelativeTime, pluralize } from "@/lib/format";
import { apiMessage, tvApi, type ShowListQuery, type TVShow } from "@/lib/tvApi";

type ViewMode = "grid" | "table";
type StatusFilter = "all" | "published" | "draft";

const PAGE_SIZE = 24;
const VIEW_STORAGE_KEY = "nextream:tv:view";

const SORTS = [
  { value: "-createdAt", label: "Newest first" },
  { value: "createdAt", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
  { value: "-title", label: "Title Z–A" },
  { value: "-updatedAt", label: "Recently updated" },
];

export default function TVShowsPage() {
  return (
    <Suspense fallback={null}>
      <TVShowsView />
    </Suspense>
  );
}

function TVShowsView() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [shows, setShows] = useState<TVShow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>("grid");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "table") setView(stored);
  }, []);

  // /tv/new redirects here with ?create=1 so old links still open the flow.
  useEffect(() => {
    if (searchParams.get("create")) setCreating(true);
  }, [searchParams]);

  const chooseView = (next: ViewMode) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  // Filters change the result set, so page 1 is the only sensible landing spot.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, sort]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const query: ShowListQuery = {
        page,
        pageSize: PAGE_SIZE,
        sort,
        q: debouncedSearch.trim() || undefined,
      };
      if (status === "published") query.published = "true";
      if (status === "draft") query.published = "false";

      // The admin endpoint, not the public one: drafts have to be visible here.
      const result = await tvApi.listShows(query);
      setShows(result.data);
      setTotal(result.total);
    } catch (err: any) {
      setError(apiMessage(err, "Failed to load TV shows"));
      setShows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, sort, status, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const removeShow = useCallback(
    async (show: TVShow) => {
      const ok = await confirm({
        title: `Delete "${show.title}"?`,
        description: (
          <>
            This deletes the show, {pluralize(show.seasonsCount ?? 0, "season")}{" "}
            and {pluralize(show.episodesCount ?? 0, "episode")}, along with every
            uploaded poster, backdrop, video, still and subtitle file. This cannot
            be undone.
          </>
        ),
        confirmLabel: "Delete permanently",
        tone: "danger",
        requireTyped: show.title,
      });
      if (!ok) return;

      try {
        setDeletingId(show._id);
        const result = await tvApi.deleteShow(show._id);
        setShows((prev) => prev.filter((row) => row._id !== show._id));
        setTotal((prev) => Math.max(0, prev - 1));
        toast.success(
          "Show deleted",
          `${result.deleted.seasons} season(s) and ${result.deleted.episodes} episode(s) removed.`
        );
      } catch (err: any) {
        toast.error("Could not delete the show", apiMessage(err, "Please try again."));
      } finally {
        setDeletingId(null);
      }
    },
    [confirm, toast]
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = debouncedSearch.trim() || status !== "all";

  const rangeLabel = useMemo(() => {
    if (total === 0) return "No shows";
    const first = (page - 1) * PAGE_SIZE + 1;
    const last = Math.min(total, page * PAGE_SIZE);
    return `${first}–${last} of ${pluralize(total, "show")}`;
  }, [page, total]);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">TV Shows</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Loading…" : rangeLabel}
            </p>
          </div>
          <Button variant="primary" icon={<FaPlus />} onClick={() => setCreating(true)}>
            New show
          </Button>
        </header>

        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <FaSearch
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search shows by title…"
                aria-label="Search shows by title"
                className="pl-9"
              />
            </div>

            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              aria-label="Filter by publish state"
              className="w-40"
            >
              <option value="all">All states</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
            </Select>

            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort shows"
              className="w-44"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <div
              className="flex items-center gap-1 rounded-control border border-border p-0.5"
              role="group"
              aria-label="View mode"
            >
              <IconButton
                label="Grid view"
                size="sm"
                variant={view === "grid" ? "primary" : "ghost"}
                aria-pressed={view === "grid"}
                onClick={() => chooseView("grid")}
              >
                <FaThLarge />
              </IconButton>
              <IconButton
                label="Table view"
                size="sm"
                variant={view === "table" ? "primary" : "ghost"}
                aria-pressed={view === "table"}
                onClick={() => chooseView("table")}
              >
                <FaTable />
              </IconButton>
            </div>
          </div>
        </Card>

        {error ? (
          <EmptyState
            tone="danger"
            icon={<FaExclamationTriangle />}
            title="Could not load TV shows"
            description={error}
            action={
              <Button variant="secondary" onClick={load}>
                Try again
              </Button>
            }
          />
        ) : loading ? (
          view === "grid" ? (
            <SkeletonCardGrid count={10} />
          ) : (
            <Card className="p-4">
              <SkeletonRows count={8} />
            </Card>
          )
        ) : shows.length === 0 ? (
          <EmptyState
            icon={<FaTv />}
            title={filtered ? "No shows match those filters" : "No TV shows yet"}
            description={
              filtered
                ? "Try a different search term, or clear the filters to see everything."
                : "Create a draft, then add artwork, seasons and episodes in its workspace."
            }
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" icon={<FaPlus />} onClick={() => setCreating(true)}>
                  New show
                </Button>
              )
            }
          />
        ) : view === "grid" ? (
          <ShowGrid
            shows={shows}
            deletingId={deletingId}
            onDelete={removeShow}
          />
        ) : (
          <ShowTable
            shows={shows}
            deletingId={deletingId}
            onDelete={removeShow}
          />
        )}

        {!loading && !error && pageCount > 1 && (
          <nav
            className="flex items-center justify-center gap-3"
            aria-label="Pagination"
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </Button>
          </nav>
        )}
      </div>

      <CreateShowDialog open={creating} onClose={() => setCreating(false)} />
      {confirmDialog}
    </AdminLayout>
  );
}

function ShowGrid({
  shows,
  deletingId,
  onDelete,
}: {
  shows: TVShow[];
  deletingId: string | null;
  onDelete: (show: TVShow) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {shows.map((show) => (
        <li key={show._id}>
          <div className="group relative">
            <Link
              href={`/tv/${show._id}`}
              className={cn(
                "block rounded-card focus-visible:outline-2",
                "focus-visible:outline-offset-2 focus-visible:outline-ring"
              )}
            >
              <div className="relative">
                <ShowPoster
                  src={show.poster}
                  title={show.title}
                  className="aspect-2/3 w-full transition-transform duration-200 group-hover:-translate-y-0.5"
                />
                <div className="absolute left-2 top-2">
                  <PublishBadge published={show.published} />
                </div>
              </div>
              <div className="mt-2.5 space-y-1">
                <h3 className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">
                  {show.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {pluralize(show.seasonsCount ?? 0, "season")} ·{" "}
                  {pluralize(show.episodesCount ?? 0, "episode")}
                </p>
              </div>
            </Link>
            <div className="absolute right-2 top-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <IconButton
                label={`Delete ${show.title}`}
                size="sm"
                variant="danger"
                loading={deletingId === show._id}
                disabled={deletingId !== null}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(show);
                }}
              >
                <FaTrashAlt />
              </IconButton>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ShowTable({
  shows,
  deletingId,
  onDelete,
}: {
  shows: TVShow[];
  deletingId: string | null;
  onDelete: (show: TVShow) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="scroll-x">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">
                Show
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                State
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Seasons
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Episodes
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Genres
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Updated
              </th>
              <th scope="col" className="px-4 py-3 font-medium sr-only">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shows.map((show) => (
              <tr key={show._id} className="transition-colors hover:bg-surface-2">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ShowPoster
                      src={show.poster}
                      title={show.title}
                      rounded="rounded-control"
                      className="h-12 w-8 shrink-0"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/tv/${show._id}`}
                        className="block truncate font-medium text-foreground hover:text-primary"
                      >
                        {show.title}
                      </Link>
                      {show.slug && (
                        <span className="block truncate text-xs text-subtle-foreground">
                          /{show.slug}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PublishBadge published={show.published} />
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {show.seasonsCount ?? 0}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {show.episodesCount ?? 0}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(show.genres ?? []).slice(0, 3).map((genre) => (
                      <Badge key={genre}>{genre}</Badge>
                    ))}
                    {(show.genres?.length ?? 0) > 3 && (
                      <Badge>+{show.genres!.length - 3}</Badge>
                    )}
                    {!show.genres?.length && (
                      <span className="text-xs text-subtle-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {formatRelativeTime(show.updatedAt ?? show.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      href={`/tv/${show._id}`}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-control px-3 text-xs font-medium",
                        "border border-border bg-surface-2 text-foreground",
                        "transition-colors hover:bg-muted hover:border-border-strong"
                      )}
                    >
                      <FaLayerGroup aria-hidden />
                      Open
                    </Link>
                    <IconButton
                      label={`Delete ${show.title}`}
                      size="sm"
                      variant="danger"
                      loading={deletingId === show._id}
                      disabled={deletingId !== null}
                      onClick={() => onDelete(show)}
                    >
                      <FaTrashAlt />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
