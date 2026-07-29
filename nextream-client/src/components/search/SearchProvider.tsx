"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import SearchCommand from "./SearchCommand";

interface SearchContextValue {
  open: boolean;
  /** `seed` pre-fills the box — the results page opens it with its own query. */
  openSearch: (seed?: string) => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * Owns the search palette for the whole app.
 *
 * Mounted once at the root rather than inside the navbar, for two reasons: the
 * navbar is `fixed` with its own stacking context, so a dialog rendered inside
 * it inherits that context and can be clipped by it; and the palette should
 * outlive any one page's chrome — ⌘K has to work on the player, which has no
 * navbar at all.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState("");

  const openSearch = useCallback((value = "") => {
    setSeed(value);
    setOpen(true);
  }, []);

  const closeSearch = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSeed("");
        setOpen((value) => !value);
        return;
      }

      // "/" is the other muscle memory for search, but only when the viewer is
      // not already typing somewhere — otherwise it eats the character.
      if (event.key === "/" && !meta && !isTyping(event.target)) {
        event.preventDefault();
        setSeed("");
        setOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({ open, openSearch, closeSearch }),
    [open, openSearch, closeSearch]
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
      <SearchCommand open={open} onClose={closeSearch} initialQuery={seed} />
    </SearchContext.Provider>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    element.isContentEditable === true
  );
}

export function useSearchPalette(): SearchContextValue {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearchPalette must be used within a SearchProvider");
  }
  return context;
}
