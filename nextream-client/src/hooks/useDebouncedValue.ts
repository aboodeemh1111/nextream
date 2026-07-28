import { useEffect, useState } from "react";

/**
 * Trails `value` by `delay` ms.
 *
 * Used for the series search box so a query fires once the viewer stops typing
 * instead of once per keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
