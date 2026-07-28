"use client";

import { useEffect, useState } from "react";

/**
 * Delays a fast-changing value.
 *
 * The show list re-queried the API on every keystroke, so typing "breaking bad"
 * fired twelve requests and rendered whichever one happened to land last.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export default useDebouncedValue;
