"use client";

import { useEffect, useState } from "react";
import { FaBrain, FaChevronDown, FaTrashAlt } from "react-icons/fa";
import { useDiscovery } from "@/context/DiscoveryContext";
import { cn } from "@/lib/cn";

/**
 * The model, opened up.
 *
 * A recommender is the part of an application people most often suspect of
 * working against them, and the usual response — a settings page with a
 * "personalised recommendations" toggle — answers none of the actual questions.
 * What has it decided I like? What is it doing with that? Can I take it back?
 *
 * Everything below is read straight out of the running engine, so it cannot
 * drift from what is actually ranking the page. The clusters are the ones the
 * rows score against, the strategy counts are the bandit's own, and the feature
 * weights are the ranker's — including the case where they say popularity
 * matters more to this device than anything the neural models produce, which is
 * a thing the panel should be able to admit.
 */

type Snapshot = ReturnType<ReturnType<typeof useDiscovery>["introspect"]>;

const STAGE_COPY: Record<string, string> = {
  idle: "Waiting",
  "loading-corpus": "Fetching the catalogue",
  indexing: "Building the search index",
  embedding: "Computing embeddings",
  "loading-models": "Loading model weights",
  training: "Training",
  ready: "Ready",
  failed: "Unavailable",
};

export default function ModelInsight({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { status, ready, introspect, forget, trainNow } = useDiscovery();
  const [open, setOpen] = useState(defaultOpen);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !ready) return;
    const read = () => setSnapshot(introspect());
    read();
    const timer = setInterval(read, 2000);
    return () => clearInterval(timer);
  }, [open, ready, introspect, status.training.steps]);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] focus:outline-none focus-visible:nx-focus sm:px-5"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nx-violet/15 text-xs text-nx-violet">
          <FaBrain aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-nx-ink">What your device has learned</span>
          <span className="block truncate text-[11px] text-nx-dim">
            {STAGE_COPY[status.stage] || status.stage}
            {ready && ` · ${status.items} titles · ${status.signals} signals`}
            {status.backend && ` · ${status.backend}`}
          </span>
        </span>

        <FaChevronDown
          className={cn("shrink-0 text-[11px] text-nx-dim transition", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="space-y-6 border-t border-white/[0.07] px-4 py-5 sm:px-5">
          {status.stage === "failed" && (
            <p className="text-[13px] text-amber-300/90">
              The on-device ranker could not start ({status.error || "unknown"}). The page is
              using the server&apos;s ranking instead.
            </p>
          )}

          {!ready && status.stage !== "failed" && (
            <p className="text-[13px] text-nx-muted">Still starting up.</p>
          )}

          {ready && snapshot && (
            <>
              <Block title="Model">
                <Facts
                  rows={[
                    ["Catalogue", `${snapshot.lexicon.items} titles`],
                    ["Index", `${snapshot.lexicon.terms.toLocaleString()} terms`],
                    ["Latent space", `${status.dimensions} dimensions`],
                    ["Backend", status.backend || "—"],
                    ["Training steps", status.training.steps.toLocaleString()],
                    [
                      "Last trained",
                      status.training.lastTrainedAt
                        ? relative(status.training.lastTrainedAt)
                        : "not yet",
                    ],
                  ]}
                />

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Loss label="Retrieval" value={status.training.loss.tower} />
                  <Loss label="Sequence" value={status.training.loss.sequence} />
                  <Loss label="Ranking" value={status.training.loss.ranker} />
                </div>

                {snapshot.spectrum.length > 1 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[10px] uppercase tracking-wider text-nx-dim">
                      Latent spectrum
                    </p>
                    <Spectrum values={snapshot.spectrum} />
                    <p className="mt-1.5 text-[11px] leading-relaxed text-nx-dim">
                      How much of the catalogue&apos;s variation each latent dimension explains. A
                      steep fall means a few themes account for most of it.
                    </p>
                  </div>
                )}
              </Block>

              {snapshot.interests.length > 0 && (
                <Block title="Tastes it found">
                  <p className="mb-3 text-[11px] leading-relaxed text-nx-dim">
                    Clusters in what you have watched. Recommendations score against the closest
                    one, not the average — so a minority taste is not averaged away.
                  </p>
                  <div className="space-y-2.5">
                    {snapshot.interests.map((interest, index) => (
                      <div key={index}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[13px] font-semibold capitalize text-nx-ink">
                            {interest.label || `Cluster ${index + 1}`}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-nx-dim">
                            {Math.round(interest.share * 100)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-nx-cyan to-nx-violet"
                            style={{ width: `${Math.round(interest.share * 100)}%` }}
                          />
                        </div>
                        {interest.titles.length > 0 && (
                          <p className="mt-1 truncate text-[11px] text-nx-dim">
                            {interest.titles.filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Block>
              )}

              {snapshot.genres.length > 0 && (
                <Block title="Genre mix">
                  <div className="flex flex-wrap gap-1.5">
                    {snapshot.genres.map((entry) => (
                      <span
                        key={entry.genre}
                        className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] capitalize text-nx-muted"
                      >
                        {entry.genre}
                        <span className="ml-1.5 tabular-nums text-nx-dim">
                          {Math.round(entry.share * 100)}%
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-nx-dim">
                    Rows are built to hold roughly this mix, so a taste you hold a fifth of the
                    time still gets about a fifth of the slots.
                  </p>
                </Block>
              )}

              {snapshot.arms.some((arm) => arm.pulls > 0) && (
                <Block title="Strategies tried">
                  <div className="space-y-1.5">
                    {snapshot.arms
                      .filter((arm) => arm.pulls > 0)
                      .sort((a, b) => b.averageReward - a.averageReward)
                      .map((arm) => (
                        <div key={arm.key} className="flex items-center gap-3 text-[12px]">
                          <span className="w-28 shrink-0 truncate text-nx-muted">{arm.label}</span>
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-emerald-400/80"
                              style={{ width: `${Math.round(arm.averageReward * 100)}%` }}
                            />
                          </div>
                          <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-nx-dim">
                            {arm.pulls} shown
                          </span>
                        </div>
                      ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-nx-dim">
                    Each row picks a strategy and is paid by whether you used it. Untried ones are
                    favoured until there is enough evidence to stop.
                  </p>
                </Block>
              )}

              {snapshot.importances.length > 0 && status.training.steps > 0 && (
                <Block title="What the ranker leans on">
                  <div className="space-y-1.5">
                    {snapshot.importances.slice(0, 6).map((entry) => (
                      <div key={entry.feature} className="flex items-center gap-3 text-[12px]">
                        <span className="w-24 shrink-0 truncate capitalize text-nx-muted">
                          {entry.feature}
                        </span>
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-nx-cyan/80"
                            style={{ width: `${Math.round(entry.weight * 320)}%` }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-nx-dim">
                          {Math.round(entry.weight * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </Block>
              )}

              <Block title="Your data">
                <p className="text-[11px] leading-relaxed text-nx-dim">
                  Everything above was computed in this browser and stored in it. The signals it
                  learned from — what was on screen, what you hovered, what you finished — were
                  never sent anywhere.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setBusy(true);
                      await trainNow();
                      setSnapshot(introspect());
                      setBusy(false);
                    }}
                    disabled={busy}
                    className="rounded-lg border border-white/15 px-3.5 py-2 text-[12px] font-semibold text-nx-ink transition hover:border-white/35 disabled:opacity-40 focus:outline-none focus-visible:nx-focus"
                  >
                    {busy ? "Training…" : "Train now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Forget everything this device learned about your taste?")) {
                        void forget();
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-400/25 px-3.5 py-2 text-[12px] font-semibold text-red-300/90 transition hover:border-red-400/50 focus:outline-none focus-visible:nx-focus"
                  >
                    <FaTrashAlt className="text-[10px]" aria-hidden />
                    Forget everything
                  </button>
                </div>
              </Block>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// --- pieces ------------------------------------------------------------------

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-nx-dim">{title}</h3>
      {children}
    </div>
  );
}

function Facts({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="truncate text-[10px] text-nx-dim">{label}</dt>
          <dd className="truncate text-[12px] font-semibold text-nx-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Loss({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
      <p className="text-[10px] text-nx-dim">{label} loss</p>
      <p className="text-[13px] font-bold tabular-nums text-nx-ink">
        {value > 0 ? value.toFixed(3) : "—"}
      </p>
    </div>
  );
}

/**
 * The singular values, as bars.
 *
 * Normalised against the largest rather than plotted absolutely — the numbers
 * themselves depend on catalogue size and mean nothing to a reader, while the
 * *shape* is the whole point: a cliff means the catalogue is a few strong
 * themes, a slope means it is many weak ones.
 */
function Spectrum({ values }: { values: number[] }) {
  const largest = Math.max(...values, 1e-6);
  return (
    <div className="flex h-10 items-end gap-[2px]" aria-hidden>
      {values.map((value, index) => (
        <span
          key={index}
          className="flex-1 rounded-sm bg-gradient-to-t from-nx-violet/40 to-nx-cyan/80"
          style={{ height: `${Math.max(4, (value / largest) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function relative(at: number): string {
  const seconds = Math.round((Date.now() - at) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
