import { useEffect, useState } from 'react';

/** Delays a fast-changing value — used to keep search from hammering AniList. */
export function useDebounce<T>(value: T, delay = 320): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
