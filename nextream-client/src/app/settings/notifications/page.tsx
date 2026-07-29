"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaBell, FaCheck, FaExclamationTriangle } from "react-icons/fa";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/fcm";
import {
  CategoryMeta,
  NotificationPreferences,
  PreferencesPayload,
  fetchPreferences,
  savePreferences,
} from "@/lib/notifications";
import { cn } from "@/lib/cn";

/**
 * Notification settings.
 *
 * The design goal is that a viewer never has to choose between "all of it" and
 * "none of it", because that choice is always resolved as none. So the controls
 * are graduated: switch off one category, cap the daily volume, silence the night,
 * or collapse everything into one message a week — each of which is a way of
 * staying subscribed.
 *
 * Two things here are unusual and deliberate.
 *
 * **Saves are immediate.** No Save button. Every switch writes on change and shows
 * the result, because a preferences page with a submit step invites someone to
 * toggle four things and navigate away, and there is no honest way to tell them
 * later that nothing was kept.
 *
 * **The throttle is disclosed.** When the server has stopped pushing a category
 * because the last several were ignored, this says so. That state is otherwise
 * indistinguishable from a bug, and a viewer who reads "we've paused these" can
 * act on it — which is the entire difference between a system that adapts and one
 * that appears broken.
 */

const DAY_LIMITS = [2, 4, 6, 10, 20];
const GAP_OPTIONS = [0, 5, 20, 60];

export default function NotificationSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [payload, setPayload] = useState<PreferencesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [browserState, setBrowserState] = useState<PushState>("prompt");
  const [busyPush, setBusyPush] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([fetchPreferences(), pushState()])
      .then(([data, state]) => {
        setPayload(data);
        setBrowserState(state);
      })
      .catch(() => setError("Couldn't load your settings."))
      .finally(() => setLoading(false));
  }, [user]);

  /**
   * Writes one change and reconciles from the response.
   *
   * The server re-resolves and clamps everything it is sent, so the value that
   * comes back is authoritative — rendering the optimistic value instead would
   * show "99999 per day" for as long as the page stayed open.
   */
  const update = useCallback(
    async (patch: Partial<NotificationPreferences>, message?: string) => {
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
        const preferences = await savePreferences(patch);
        setPayload((current) => (current ? { ...current, preferences } : current));
        if (message) setNotice(message);
      } catch {
        setError("That didn't save. Check your connection and try again.");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const handleEnablePush = async () => {
    setBusyPush(true);
    setError(null);
    setNotice(null);
    try {
      const result = await enablePush();
      setBrowserState(result.state);
      if (result.ok) {
        // The account-level switch is separate from the browser permission: a
        // viewer who just granted the permission plainly wants it on.
        await update({ push: true }, "Push notifications are on for this device.");
        const refreshed = await fetchPreferences();
        setPayload(refreshed);
      } else {
        setError(result.message || "Couldn't turn on push notifications.");
      }
    } finally {
      setBusyPush(false);
    }
  };

  const handleDisablePush = async () => {
    setBusyPush(true);
    try {
      await disablePush();
      setBrowserState(await pushState());
      const refreshed = await fetchPreferences();
      setPayload(refreshed);
      setNotice("This device will no longer receive push notifications.");
    } finally {
      setBusyPush(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-nx-bg">
        <Navbar />
        <div className="h-14" />
      </div>
    );
  }

  const prefs = payload?.preferences;
  const categories = payload?.categories || [];
  const devices = payload?.devices || [];
  const hasDevice = devices.length > 0;

  return (
    <div className="min-h-screen bg-nx-bg text-nx-ink">
      <Navbar />
      <div className="h-14" />

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6">
        <Link
          href="/notifications"
          className="inline-flex items-center gap-2 text-[12px] text-nx-muted transition hover:text-nx-ink focus:outline-none focus-visible:nx-focus"
        >
          <FaArrowLeft className="text-[10px]" aria-hidden />
          Notifications
        </Link>

        <h1 className="mt-3 text-2xl font-bold tracking-tight">Notification settings</h1>
        <p className="mt-1 text-[13px] text-nx-muted">
          Choose what reaches you, and when. Everything you switch off here stops arriving
          entirely — inbox included.
        </p>

        {/* A single live region for both outcomes, so a screen reader announces the
            result of a toggle without the page having two competing regions. */}
        <div aria-live="polite" className="mt-4 space-y-2 empty:mt-0">
          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
              <FaExclamationTriangle className="mt-0.5 shrink-0 text-[11px]" aria-hidden />
              {error}
            </p>
          )}
          {notice && (
            <p className="flex items-start gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[12px] text-emerald-200">
              <FaCheck className="mt-0.5 shrink-0 text-[11px]" aria-hidden />
              {notice}
            </p>
          )}
        </div>

        {loading || !prefs ? (
          <div className="mt-6 space-y-3" aria-hidden>
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-24 rounded-xl border border-white/[0.07] bg-nx-surface/50"
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {/* --- this device ------------------------------------------------ */}
            <Card
              title="This device"
              description="Push notifications reach you when Nextream isn't open. The in-app inbox works either way."
            >
              <DeviceControl
                state={browserState}
                enabled={prefs.push && hasDevice}
                available={payload?.pushAvailable !== false}
                busy={busyPush}
                onEnable={handleEnablePush}
                onDisable={handleDisablePush}
              />

              {devices.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-white/[0.07] pt-3">
                  {devices.map((device) => (
                    <li key={device.id} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="min-w-0 truncate text-nx-muted">
                        {shortenAgent(device.userAgent) || device.platform}
                      </span>
                      <span className="shrink-0 text-[11px] text-nx-dim">
                        {device.createdAt
                          ? new Date(device.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* --- categories ------------------------------------------------ */}
            <Card
              title="What you hear about"
              description="Each of these can be switched off on its own."
            >
              <ul className="divide-y divide-white/[0.06]">
                {categories.map((category) => (
                  <CategoryToggle
                    key={category.key}
                    category={category}
                    enabled={prefs.categories[category.key] !== false}
                    throttled={
                      (payload?.stats?.categories?.[category.key]?.ignoredStreak || 0) >= 3
                    }
                    disabled={saving}
                    onChange={(value) =>
                      update(
                        { categories: { ...prefs.categories, [category.key]: value } },
                        value ? `${category.label} is on.` : `${category.label} is off.`
                      )
                    }
                  />
                ))}
              </ul>
            </Card>

            {/* --- quiet hours ----------------------------------------------- */}
            <Card
              title="Quiet hours"
              description="Pushes inside this window are held until it ends — nothing is lost, it just waits."
            >
              <Row
                label="Silence a stretch of the day"
                control={
                  <Switch
                    checked={prefs.quietHours.enabled}
                    disabled={saving}
                    label="Quiet hours"
                    onChange={(value) =>
                      update({ quietHours: { ...prefs.quietHours, enabled: value } })
                    }
                  />
                }
              />

              {prefs.quietHours.enabled && (
                <div className="mt-3 flex flex-wrap items-end gap-4 border-t border-white/[0.07] pt-3">
                  <TimeField
                    label="From"
                    value={prefs.quietHours.start}
                    disabled={saving}
                    onChange={(value) =>
                      update({ quietHours: { ...prefs.quietHours, start: value } })
                    }
                  />
                  <TimeField
                    label="Until"
                    value={prefs.quietHours.end}
                    disabled={saving}
                    onChange={(value) => update({ quietHours: { ...prefs.quietHours, end: value } })}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-nx-dim">Timezone</p>
                    <p className="mt-1 truncate text-[13px] text-nx-muted">{prefs.timezone}</p>
                    {prefs.timezone !== browserTimezone() && (
                      <button
                        type="button"
                        onClick={() =>
                          update({ timezone: browserTimezone() }, "Timezone updated.")
                        }
                        className="mt-1 text-[11px] text-nx-cyan underline-offset-2 hover:underline focus:outline-none focus-visible:nx-focus"
                      >
                        Use {browserTimezone()}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* --- volume ---------------------------------------------------- */}
            <Card
              title="How much"
              description="Caps apply across every category. New episodes of shows you follow are exempt — you asked for those by name."
            >
              <Row
                label="Most pushes per day"
                control={
                  <Choice
                    value={prefs.maxPushPerDay}
                    options={DAY_LIMITS.map((value) => ({ value, label: String(value) }))}
                    disabled={saving}
                    label="Maximum pushes per day"
                    onChange={(value) => update({ maxPushPerDay: value })}
                  />
                }
              />
              <Row
                label="Minimum gap between pushes"
                control={
                  <Choice
                    value={prefs.minPushGapMinutes}
                    options={GAP_OPTIONS.map((value) => ({
                      value,
                      label: value === 0 ? "None" : `${value}m`,
                    }))}
                    disabled={saving}
                    label="Minimum gap between pushes"
                    onChange={(value) => update({ minPushGapMinutes: value })}
                  />
                }
              />
              <Row
                label="One weekly summary instead"
                hint="Replaces recommendation and reminder pushes with a single roundup. Shows you follow still arrive as they happen."
                control={
                  <Switch
                    checked={prefs.digest}
                    disabled={saving}
                    label="Weekly summary instead of individual pushes"
                    onChange={(value) =>
                      update(
                        // The digest category has to be on for the summary to be
                        // deliverable; switching the mode on without it would
                        // silence the individual pushes and send nothing instead.
                        value
                          ? { digest: true, categories: { ...prefs.categories, digest: true } }
                          : { digest: false },
                        value ? "You'll get one summary a week." : "Back to individual notifications."
                      )
                    }
                  />
                }
              />
            </Card>

            {payload?.stats?.global && (
              <p className="px-1 text-[11px] leading-relaxed text-nx-dim">
                {payload.stats.global.pushesToday} of {prefs.maxPushPerDay} pushes used today.{" "}
                {payload.stats.global.created} notifications received in total,{" "}
                {payload.stats.global.opened} opened.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// --- pieces ------------------------------------------------------------------

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.07] bg-nx-surface/60 p-4 sm:p-5">
      <h2 className="text-[14px] font-semibold text-nx-ink">{title}</h2>
      {description && (
        <p className="mt-1 text-[12px] leading-relaxed text-nx-muted">{description}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13px] text-nx-ink">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-nx-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function CategoryToggle({
  category,
  enabled,
  throttled,
  disabled,
  onChange,
}: {
  category: CategoryMeta;
  enabled: boolean;
  throttled: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13px] text-nx-ink">{category.label}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-nx-muted">{category.description}</p>
        {/* Disclosed rather than hidden: a category the server has quietly stopped
            pushing is otherwise indistinguishable from one that is broken. */}
        {throttled && enabled && (
          <p className="mt-1 text-[11px] text-amber-300/90">
            Pushes for these are paused because recent ones weren&apos;t opened. They still
            arrive in your inbox, and open one to resume them.
          </p>
        )}
      </div>

      {category.locked ? (
        <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-nx-dim">
          Always on
        </span>
      ) : (
        <Switch checked={enabled} disabled={disabled} label={category.label} onChange={onChange} />
      )}
    </li>
  );
}

function DeviceControl({
  state,
  enabled,
  available,
  busy,
  onEnable,
  onDisable,
}: {
  state: PushState;
  enabled: boolean;
  available: boolean;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  if (!available || state === "unconfigured") {
    return (
      <p className="text-[12px] text-nx-muted">
        Push isn&apos;t configured on this deployment. Your inbox still works.
      </p>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="text-[12px] text-nx-muted">
        This browser can&apos;t receive push notifications. Your inbox still works.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-[12px] leading-relaxed text-nx-muted">
        Notifications are blocked for this site. Allow them from the padlock icon in your
        browser&apos;s address bar, then reload this page.
      </p>
    );
  }

  if (enabled && state === "granted") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[12px] text-emerald-300">
          <FaCheck className="text-[10px]" aria-hidden />
          This device is receiving push notifications.
        </p>
        <button
          type="button"
          onClick={onDisable}
          disabled={busy}
          className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] font-medium text-nx-muted transition hover:border-white/25 hover:text-nx-ink disabled:opacity-50 focus:outline-none focus-visible:nx-focus"
        >
          {busy ? "Turning off…" : "Turn off"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEnable}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-full bg-nx-accent px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-nx-accent-soft disabled:opacity-50 focus:outline-none focus-visible:nx-focus"
    >
      <FaBell className="text-[11px]" aria-hidden />
      {busy ? "Setting up…" : "Turn on push notifications"}
    </button>
  );
}

/** A checkbox styled as a switch, so it keeps the native semantics for free. */
function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        className={cn(
          "h-5 w-9 rounded-full border transition-colors",
          "peer-focus-visible:nx-focus",
          checked ? "border-nx-accent bg-nx-accent" : "border-white/15 bg-white/[0.08]",
          disabled && "opacity-50"
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
          checked && "translate-x-4"
        )}
      />
    </label>
  );
}

/** A small segmented control. Native `select` for the a11y, styled minimally. */
function Choice({
  value,
  options,
  disabled,
  label,
  onChange,
}: {
  value: number;
  options: { value: number; label: string }[];
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
      className="rounded-lg border border-white/10 bg-nx-elevated px-2.5 py-1.5 text-[12px] text-nx-ink transition hover:border-white/25 disabled:opacity-50 focus:outline-none focus-visible:nx-focus"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * A time input that commits on blur, not on change.
 *
 * Every other control here saves the moment it is touched, which is right for a
 * switch. A time field is different: nudging the spinner from 22:00 to 23:00
 * fires an event per step, so change-to-save would issue a write per tick and
 * disable the rest of the form between each one. Local state holds the edit and
 * one save lands when the viewer is done.
 */
function TimeField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  // Re-sync when the server's value changes under us — a rejected or clamped
  // value must not leave the field showing what was typed.
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft && draft !== value) onChange(draft);
    else if (!draft) setDraft(value);
  };

  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-nx-dim">{label}</span>
      <input
        type="time"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="mt-1 rounded-lg border border-white/10 bg-nx-elevated px-2.5 py-1.5 text-[13px] text-nx-ink transition hover:border-white/25 disabled:opacity-50 focus:outline-none focus-visible:nx-focus"
      />
    </label>
  );
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "Chrome on Windows" out of a user-agent string, for the device list. */
function shortenAgent(userAgent: string): string {
  if (!userAgent) return "";
  const browser =
    /Edg\//.test(userAgent) ? "Edge"
    : /OPR\//.test(userAgent) ? "Opera"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Firefox\//.test(userAgent) ? "Firefox"
    : /Safari\//.test(userAgent) ? "Safari"
    : "Browser";
  const os =
    /Windows/.test(userAgent) ? "Windows"
    : /Android/.test(userAgent) ? "Android"
    : /iPhone|iPad/.test(userAgent) ? "iOS"
    : /Mac OS X/.test(userAgent) ? "macOS"
    : /Linux/.test(userAgent) ? "Linux"
    : "";
  return os ? `${browser} on ${os}` : browser;
}
