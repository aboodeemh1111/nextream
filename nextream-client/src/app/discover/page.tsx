"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaMicrochip } from "react-icons/fa";
import Navbar from "@/components/Navbar";
import ModelInsight from "@/components/discover/ModelInsight";
import NeuralRow from "@/components/discover/NeuralRow";
import SemanticSearch from "@/components/discover/SemanticSearch";
import { GUTTER } from "@/components/series/Bits";
import { useAuth } from "@/context/AuthContext";
import { useDiscovery } from "@/context/DiscoveryContext";
import { cn } from "@/lib/cn";

/**
 * Discover — the recommender, on its own page.
 *
 * Everything here is ranked in the browser. No row on this page issues a
 * request; the catalogue was downloaded once, decomposed once, and every
 * ordering below is a matrix multiply against weights that were trained on this
 * device from this device's own history.
 *
 * The page exists as its own thing rather than being folded into the home feed
 * for a reason that is partly editorial. A recommender that can explain itself
 * deserves somewhere it can do that at length — and a viewer who wants to know
 * what a system decided about them should not have to find it inside a settings
 * page three levels down.
 *
 * The rows are ordered by how much they need: the first works from the first
 * interaction, the sequence row needs a session, and the interest rows need
 * enough history to have clustered. They appear as they become meaningful,
 * rather than sitting empty waiting.
 */
export default function DiscoverPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { status, ready, personalised, introspect } = useDiscovery();

  const [interests, setInterests] = useState<Array<{ label: string; titles: string[] }>>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  // Re-read after each training pass: the clusters move as the model learns,
  // and a row headed "More horror" that no longer reflects a real interest is
  // worse than no row.
  useEffect(() => {
    if (!ready) return;
    const read = () => {
      const snapshot = introspect();
      setInterests(
        snapshot.interests
          .filter((interest) => interest.label && interest.titles.length)
          .slice(0, 3)
          .map((interest) => ({ label: interest.label, titles: interest.titles }))
      );
    };
    read();
  }, [ready, introspect, status.training.steps]);

  // Titles already placed above are excluded from the rows below, so the page
  // reads as a sequence of different answers rather than the same ranking
  // filtered four ways.
  const [exclude, setPlaced] = useState<string[]>([]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-nx-bg text-nx-ink">
      <Navbar />

      <div className={cn("pt-20", GUTTER)}>
        <header className="mb-6 max-w-3xl">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-nx-cyan/25 bg-nx-cyan/[0.07] px-3 py-1 text-[11px] font-semibold text-nx-cyan">
            <FaMicrochip className="text-[10px]" aria-hidden />
            Ranked on this device
          </span>

          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Discover</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-nx-muted">
            The catalogue, indexed and ranked in your browser. Search by what a title is about
            rather than what it is called, and every recommendation will tell you what put it
            there.
          </p>
        </header>

        <SemanticSearch />
      </div>

      <div className="mt-10 space-y-8 pb-24">
        <NeuralRow
          title={personalised ? "Picked for you" : "Start here"}
          subtitle={
            personalised
              ? undefined
              : "Nothing learned yet — watch something and this row starts ranking around you"
          }
          diagnostics
          refreshable
          onPlaced={setPlaced}
          options={{ limit: 20, surface: "discover" }}
        />

        {personalised && (
          <NeuralRow
            title="What usually follows"
            subtitle="From the order you watched things in, not just what you watched"
            options={{
              limit: 20,
              surface: "discover",
              explore: 0.05,
              diversity: 0.12,
              exclude,
            }}
          />
        )}

        <NeuralRow
          title="Further afield"
          subtitle="Deliberately less like what you already watch"
          diagnostics
          options={{ limit: 20, surface: "discover", explore: 0.9, diversity: 0.8, exclude }}
        />

        {interests.map((interest, index) => (
          <NeuralRow
            key={interest.label}
            title={`More ${interest.label}`}
            subtitle={`Because you watched ${interest.titles[0]}`}
            options={{
              limit: 20,
              surface: "discover",
              genre: interest.label,
              diversity: 0.2,
              exclude: index === 0 ? exclude : undefined,
            }}
          />
        ))}

        <div className={GUTTER}>
          <ModelInsight defaultOpen={!personalised} />
        </div>
      </div>
    </main>
  );
}
