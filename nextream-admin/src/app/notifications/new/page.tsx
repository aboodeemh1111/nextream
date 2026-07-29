"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FaArrowLeft, FaBell, FaPaperPlane, FaUsers, FaVial } from "react-icons/fa";
import AdminLayout from "@/components/AdminLayout";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  Select,
  Switch,
  Textarea,
  useToast,
} from "@/components/ui";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/cn";
import {
  DispatchSummary,
  PreviewResult,
  Segment,
  broadcast,
  previewAudience,
  ruleLabel,
  sendTest,
} from "@/lib/notificationsApi";

/**
 * The composer.
 *
 * Its most important feature is the number in the right-hand column, and it is the
 * one the previous version did not have: the recipient count, resolved live as the
 * audience is narrowed. Without it, "send to everyone who watches horror" is a
 * guess whose only resolution is pressing an irreversible button — so the count is
 * recomputed on every change to the segment, before anything is sent.
 *
 * Two other deliberate choices:
 *
 *   - **Test to self is prominent, not hidden.** The fastest way to discover that
 *     a deep link is wrong is to receive the notification, and an admin who has to
 *     go looking for that button will send to everyone instead.
 *   - **The result is a breakdown, not a checkmark.** After a send, this reports
 *     how many were created, how many were pushed, and *why* the rest were not.
 *     "Sent to 400 people" is the number an admin remembers; "created 400, pushed
 *     260, 140 in quiet hours" is the number that is true.
 */

const PLANS = ["", "basic", "standard", "premium"];

/** Bounded and coarse on purpose: exact day counts are false precision here. */
const ACTIVITY_WINDOWS = [
  { value: 0, label: "Any time" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

const INACTIVITY_WINDOWS = [
  { value: 0, label: "Not filtered" },
  { value: 14, label: "14+ days" },
  { value: 30, label: "30+ days" },
  { value: 90, label: "90+ days" },
];

type Mode = "segment" | "users";

export default function ComposeNotificationPage() {
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [image, setImage] = useState("");

  const [mode, setMode] = useState<Mode>("segment");
  const [userIds, setUserIds] = useState("");
  const [activeWithinDays, setActiveWithinDays] = useState(0);
  const [inactiveForDays, setInactiveForDays] = useState(0);
  const [genres, setGenres] = useState("");
  const [plan, setPlan] = useState("");
  const [hasPush, setHasPush] = useState(false);
  const [excludeAdmins, setExcludeAdmins] = useState(false);

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [summary, setSummary] = useState<DispatchSummary | null>(null);

  const parsedUserIds = useMemo(
    () =>
      userIds
        .split(/[\s,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    [userIds]
  );

  const segment = useMemo<Segment>(
    () => ({
      activeWithinDays: activeWithinDays || null,
      inactiveForDays: inactiveForDays || null,
      genres: genres
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      plan: plan || null,
      hasPush: hasPush ? true : null,
      isAdmin: excludeAdmins ? false : null,
    }),
    [activeWithinDays, inactiveForDays, genres, plan, hasPush, excludeAdmins]
  );

  // Debounced because the genre field is a text input, and resolving a segment
  // touches the session collection — one request per keystroke would be a scan
  // per keystroke.
  const debouncedSegment = useDebouncedValue(segment, 400);
  const debouncedUserIds = useDebouncedValue(parsedUserIds, 400);

  useEffect(() => {
    let cancelled = false;
    setPreviewing(true);

    previewAudience(
      mode === "users"
        ? { mode: "users", userIds: debouncedUserIds }
        : { mode: "segment", segment: debouncedSegment }
    )
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, debouncedSegment, debouncedUserIds]);

  const reach = mode === "users" ? preview?.total ?? 0 : preview?.reachable ?? preview?.total ?? 0;
  const canSend = Boolean(title.trim()) && reach > 0 && !sending;

  const handleTest = async () => {
    if (!title.trim()) {
      toast.error("A title is required");
      return;
    }
    setTesting(true);
    try {
      const result = await sendTest({ title, body, deepLink, image });
      const pushed = result.summary.pushed > 0;
      toast.success(
        "Test sent to your account",
        pushed
          ? "Check your devices and the client inbox."
          : `In your inbox. No push: ${
              Object.keys(result.summary.rules).map(ruleLabel).join(", ") || "see the console"
            }.`
      );
    } catch {
      toast.error("Couldn't send the test");
    } finally {
      setTesting(false);
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setSummary(null);
    try {
      const result = await broadcast({
        title,
        body,
        deepLink,
        image,
        mode,
        ...(mode === "users" ? { userIds: parsedUserIds } : { segment }),
      });
      setSummary(result.summary);
      toast.success(
        `Sent to ${result.summary.created} ${result.summary.created === 1 ? "viewer" : "viewers"}`,
        `${result.summary.pushed} reached a device.`
      );
    } catch (err: unknown) {
      toast.error("The broadcast failed", "Nothing was sent. Check the API log.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/notifications"
              className="inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <FaArrowLeft className="text-[10px]" aria-hidden />
              Notifications
            </Link>
            <h1 className="mt-1 text-2xl font-bold">Compose</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A one-off announcement. Everything else the system sends is triggered by the
              catalogue or by playback.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
          {/* --- message ---------------------------------------------------- */}
          <div className="space-y-5">
            <Card>
              <CardHeader title="Message" />
              <CardBody className="space-y-4">
                <Input
                  label="Title"
                  value={title}
                  maxLength={90}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Offline downloads are here"
                  hint={`${title.length}/90 — trimmed to fit a lock screen.`}
                />
                <Textarea
                  label="Body"
                  value={body}
                  rows={3}
                  maxLength={220}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Save titles to watch without a connection. Available on all plans."
                  hint={`${body.length}/220`}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Opens"
                    value={deepLink}
                    onChange={(event) => setDeepLink(event.target.value)}
                    placeholder="/series/abc123"
                    hint="A path on the client app. Defaults to the home page."
                  />
                  <Input
                    label="Image (optional)"
                    value={image}
                    onChange={(event) => setImage(event.target.value)}
                    placeholder="Storage key or https:// URL"
                  />
                </div>
              </CardBody>
            </Card>

            {/* --- audience ------------------------------------------------- */}
            <Card>
              <CardHeader
                title="Audience"
                description="Narrow it down, and watch the count on the right."
                actions={
                  <div className="flex rounded-control border border-border p-0.5">
                    {(["segment", "users"] as Mode[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        aria-pressed={mode === value}
                        className={cn(
                          "rounded px-2.5 py-1 text-xs font-medium transition",
                          mode === value
                            ? "bg-surface-2 text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {value === "segment" ? "By segment" : "By user id"}
                      </button>
                    ))}
                  </div>
                }
              />
              <CardBody className="space-y-4">
                {mode === "users" ? (
                  <Textarea
                    label="User ids"
                    value={userIds}
                    rows={4}
                    onChange={(event) => setUserIds(event.target.value)}
                    placeholder="6394c01bec646e309c271b52, 6a67dd792e88047ff8a02e4f"
                    hint="Comma, space or newline separated."
                  />
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select
                        label="Active"
                        value={String(activeWithinDays)}
                        onChange={(event) => {
                          setActiveWithinDays(Number(event.target.value));
                          // The two windows describe opposite things; holding both
                          // would silently resolve to nobody.
                          if (Number(event.target.value)) setInactiveForDays(0);
                        }}
                      >
                        {ACTIVITY_WINDOWS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        label="Or inactive for"
                        value={String(inactiveForDays)}
                        onChange={(event) => {
                          setInactiveForDays(Number(event.target.value));
                          if (Number(event.target.value)) setActiveWithinDays(0);
                        }}
                      >
                        {INACTIVITY_WINDOWS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <Input
                      label="Who watch these genres"
                      value={genres}
                      onChange={(event) => setGenres(event.target.value)}
                      placeholder="horror, thriller"
                      hint="Matched against what each viewer actually watches, not against a tag on their account. Leave empty for everyone."
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select
                        label="Plan"
                        value={plan}
                        onChange={(event) => setPlan(event.target.value)}
                      >
                        {PLANS.map((value) => (
                          <option key={value || "any"} value={value}>
                            {value ? value : "Any plan"}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-3 border-t border-border pt-4">
                      <Switch
                        checked={hasPush}
                        onChange={setHasPush}
                        label="Only viewers with a registered device"
                        description="Everyone else would receive it in-app only."
                      />
                      <Switch
                        checked={excludeAdmins}
                        onChange={setExcludeAdmins}
                        label="Exclude admins"
                      />
                    </div>
                  </>
                )}
              </CardBody>
            </Card>

            {/* --- result --------------------------------------------------- */}
            {summary && (
              <Card>
                <CardHeader
                  title="Result"
                  description="What actually happened, rather than what was requested."
                />
                <CardBody className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Figure label="Created" value={summary.created} />
                    <Figure label="Pushed" value={summary.pushed} />
                    <Figure label="Held back" value={summary.deferred} />
                    <Figure label="Skipped" value={summary.skipped} />
                  </div>

                  {Object.keys(summary.rules).length > 0 && (
                    <ul className="space-y-1.5 border-t border-border pt-3 text-sm">
                      {Object.entries(summary.rules)
                        .sort((a, b) => b[1] - a[1])
                        .map(([rule, count]) => (
                          <li key={rule} className="flex items-baseline justify-between gap-3">
                            <span className="text-muted-foreground">{ruleLabel(rule)}</span>
                            <span className="tabular-nums text-foreground">{count}</span>
                          </li>
                        ))}
                    </ul>
                  )}

                  {summary.duplicates > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {summary.duplicates} were already sent and were not duplicated.
                    </p>
                  )}
                  {summary.truncated && (
                    <p className="text-xs text-warning">
                      The audience was larger than the per-send limit and was capped.
                    </p>
                  )}
                </CardBody>
              </Card>
            )}
          </div>

          {/* --- reach + actions -------------------------------------------- */}
          <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader title="Reach" />
              <CardBody>
                <p
                  className={cn(
                    "text-3xl font-semibold tabular-nums",
                    previewing && "opacity-50 transition-opacity"
                  )}
                >
                  {preview ? reach.toLocaleString() : "—"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {preview
                    ? `${reach === 1 ? "viewer" : "viewers"} — ${preview.description}`
                    : "Couldn't resolve the audience."}
                </p>

                {preview && (
                  <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">With a device</dt>
                      <dd className="tabular-nums text-foreground">{preview.withPush}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">Inbox only</dt>
                      <dd className="tabular-nums text-foreground">
                        {Math.max(0, reach - preview.withPush)}
                      </dd>
                    </div>
                  </dl>
                )}

                {preview?.truncated && (
                  <p className="mt-3 text-xs text-warning">
                    More match than one send can reach; the best-matching will be used.
                  </p>
                )}

                {/* Stated plainly rather than left as a surprise in the result
                    panel: preferences and quiet hours will reduce this number, and
                    an admin who expects the reach figure to equal the pushes sent
                    will read a correct send as a broken one. */}
                <p className="mt-4 rounded-control bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground">
                  Everyone here gets it in their inbox unless they have switched Product news off.
                  Pushes are further filtered by each viewer&apos;s quiet hours, daily limit and
                  engagement.
                </p>
              </CardBody>

              <CardFooter className="flex-col items-stretch gap-2">
                <Button
                  variant="primary"
                  icon={<FaPaperPlane />}
                  onClick={handleSend}
                  loading={sending}
                  disabled={!canSend}
                >
                  {reach > 0 ? `Send to ${reach.toLocaleString()}` : "Send"}
                </Button>
                <Button icon={<FaVial />} onClick={handleTest} loading={testing}>
                  Send a test to myself
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader title="Preview" />
              <CardBody>
                <div className="flex items-start gap-3 rounded-control border border-border bg-surface-2 p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <FaBell className="text-xs" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {title || "Your title"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {body || "Your message body."}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      just now · opens {deepLink || "/"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="info">system.announcement</Badge>
                  <Badge tone="neutral">Product news</Badge>
                  <Badge tone="neutral">normal priority</Badge>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Not sure who to reach?" />
              <CardBody className="space-y-2 text-xs text-muted-foreground">
                <p className="flex items-start gap-2">
                  <FaUsers className="mt-0.5 shrink-0" aria-hidden />
                  Leave everything unset to reach every account.
                </p>
                <p>
                  Genre targeting reads each viewer&apos;s watch history, so a small catalogue or a
                  new deployment will match very few people. The count on the right is the truth.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control bg-surface-2 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
