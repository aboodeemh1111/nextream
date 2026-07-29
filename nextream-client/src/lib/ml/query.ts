import { normalize } from "./text";
import type { ItemKind } from "./types";

/**
 * Reading a query before matching it.
 *
 * "horror series from the 90s" contains four words that no title contains, and a
 * search engine that matches them literally returns nothing — or worse, returns
 * whatever film has "horror" in its synopsis. Every word here is a *filter*, and
 * lifting them out before retrieval is the difference between a search box and a
 * text field.
 *
 * The rule throughout: a word is only read as intent if removing it leaves
 * something, or if the catalogue actually publishes it. "Drama" alone stays a
 * search for the word drama, because a viewer typing one word is naming a thing
 * far more often than filtering by it — and a filter that empties the results is
 * indistinguishable, from the outside, from a search box that is broken.
 */

export interface Understood {
  type: "kind" | "genre" | "year" | "decade" | "sort" | "status";
  value: string | number;
  label: string;
}

export interface ParsedQuery {
  /** What is left after the filters are removed — what actually gets matched. */
  text: string;
  raw: string;
  kind: ItemKind | null;
  genres: string[];
  year: number | null;
  decade: number | null;
  status: "ongoing" | "ended" | null;
  sort: "relevance" | "rating" | "popular" | "newest" | "year";
  understood: Understood[];
}

const KIND_WORDS: Array<[RegExp, ItemKind, string]> = [
  [/\b(tv ?)?(series|shows?|seasons?)\b/g, "show", "Series"],
  [/\b(films?|movies?)\b/g, "movie", "Films"],
];

const SORT_WORDS: Array<[RegExp, ParsedQuery["sort"], string]> = [
  [/\b(top|best|highest) ?rated\b/g, "rating", "Top rated"],
  [/\b(most )?(popular|watched|trending)\b/g, "popular", "Most watched"],
  [/\b(new|newest|latest|recent)(ly added)?\b/g, "newest", "Recently added"],
];

const STATUS_WORDS: Array<[RegExp, "ongoing" | "ended", string]> = [
  [/\b(finished|completed|complete|ended)\b/g, "ended", "Complete"],
  [/\b(ongoing|running|airing)\b/g, "ongoing", "Still airing"],
];

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/**
 * `genres` is the catalogue's own list, so a query is only read as a genre
 * filter when that genre exists — "anime" is intent in a catalogue that
 * publishes it and a search term in one that does not.
 */
export function parseQuery(raw: string, genres: string[]): ParsedQuery {
  let text = ` ${normalize(raw)} `;
  const understood: Understood[] = [];

  const parsed: ParsedQuery = {
    text: "",
    raw,
    kind: null,
    genres: [],
    year: null,
    decade: null,
    status: null,
    sort: "relevance",
    understood,
  };

  const consume = (pattern: RegExp): boolean => {
    pattern.lastIndex = 0;
    if (!pattern.test(text)) return false;
    pattern.lastIndex = 0;
    text = text.replace(pattern, " ");
    return true;
  };

  for (const [pattern, kind, label] of KIND_WORDS) {
    if (consume(pattern)) {
      parsed.kind = kind;
      understood.push({ type: "kind", value: kind, label });
      break;
    }
  }

  for (const [pattern, sort, label] of SORT_WORDS) {
    if (consume(pattern)) {
      parsed.sort = sort;
      understood.push({ type: "sort", value: sort, label });
      break;
    }
  }

  for (const [pattern, status, label] of STATUS_WORDS) {
    if (consume(pattern)) {
      parsed.status = status;
      understood.push({ type: "status", value: status, label });
      break;
    }
  }

  // Decades before years: "1990s" contains "1990", and matching the year first
  // would turn a decade filter into a filter for one specific year.
  const decade = text.match(/\b(19|20)(\d)0s\b/) || text.match(/\b(\d0)s\b/);
  if (decade) {
    const full = decade[0].replace(/s$/, "");
    const value = full.length === 2 ? (Number(full) >= 30 ? 1900 + Number(full) : 2000 + Number(full)) : Number(full);
    parsed.decade = Math.floor(value / 10) * 10;
    understood.push({ type: "decade", value: parsed.decade, label: `${parsed.decade}s` });
    text = text.replace(decade[0], " ");
  } else {
    const year = text.match(/\b(19\d{2}|20\d{2})\b/);
    if (year) {
      parsed.year = Number(year[1]);
      understood.push({ type: "year", value: parsed.year, label: String(parsed.year) });
      text = text.replace(year[0], " ");
    }
  }

  // Longest genres first, so "science fiction" is not consumed as "fiction".
  const sorted = [...genres].sort((a, b) => b.length - a.length);
  for (const genre of sorted) {
    const pattern = new RegExp(`\\b${genre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    if (!pattern.test(text)) continue;

    const remainder = text.replace(pattern, " ").trim();
    // A bare genre stays a search. Someone typing "horror" wants the horror
    // titles either way; someone typing "The Horror" wants that film, and only
    // the leftover text can tell the two apart.
    if (!remainder && !understood.length) continue;

    parsed.genres.push(genre);
    understood.push({ type: "genre", value: genre, label: titleCase(genre) });
    text = text.replace(pattern, " ");
  }

  parsed.text = text.replace(/\s+/g, " ").trim();
  return parsed;
}

/** True when a query is nothing but filters — a browse, not a search. */
export function isBrowse(parsed: ParsedQuery): boolean {
  return !parsed.text && parsed.understood.length > 0;
}
