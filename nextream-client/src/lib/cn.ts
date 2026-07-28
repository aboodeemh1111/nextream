/** Joins class names, dropping falsy entries so conditionals read inline. */
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
