import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and lets the last conflicting Tailwind utility win, so a
 * `className` prop passed to a primitive can override its defaults without
 * needing `!important` or a variant for every combination.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
