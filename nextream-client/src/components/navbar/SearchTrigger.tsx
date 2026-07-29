"use client";

import { useEffect, useState } from "react";
import { FaSearch } from "react-icons/fa";
import { useSearchPalette } from "@/components/search/SearchProvider";
import { Kbd } from "@/components/search/Bits";
import { cn } from "@/lib/cn";

/**
 * The thing that used to be the search input.
 *
 * It is a button now, not a field. The old navbar carried a live 192px input
 * whose dropdown had to fit under it, which is why the results were eight lines
 * of 12px text — and it was only reachable with the mouse. A trigger costs the
 * same pixels, advertises the shortcut, and hands the query to a panel with room
 * to answer it properly.
 */
export default function SearchTrigger({ className }: { className?: string }) {
  const { openSearch } = useSearchPalette();
  const [hint, setHint] = useState<string | null>(null);

  // Rendered after mount: the modifier depends on the platform, and printing
  // "⌘K" into the server HTML would hydrate-mismatch on every Windows machine.
  useEffect(() => {
    const apple = /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
    setHint(apple ? "⌘K" : "Ctrl K");
  }, []);

  return (
    <button
      type="button"
      onClick={() => openSearch()}
      aria-label="Search"
      aria-keyshortcuts="Control+K Meta+K"
      className={cn(
        "group flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.06] py-2 pl-3.5 pr-2 text-left text-nx-dim transition-colors duration-200 hover:border-white/25 hover:bg-white/10 hover:text-nx-muted focus:outline-none focus-visible:nx-focus",
        className
      )}
    >
      <FaSearch className="shrink-0 text-[13px] transition-colors group-hover:text-nx-ink" aria-hidden />
      <span className="hidden min-w-0 flex-1 truncate text-[13px] lg:block">
        Search titles, genres…
      </span>
      {/* The breakpoint lives on a wrapper, not on the Kbd. `cn` concatenates
          rather than resolving conflicts, and Kbd already sets `inline-flex` —
          passing `hidden` to it is a coin toss on stylesheet order, and this
          build loses it, so the chip rendered inside the 36px mobile button. */}
      {hint && (
        <span className="hidden lg:block">
          <Kbd>{hint}</Kbd>
        </span>
      )}
    </button>
  );
}
