import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query; updates when viewport crosses the breakpoint.
 */
export function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind `md` breakpoint (768px): below is mobile compact layout. */
export function useIsMobileStudioLayout(): boolean {
  return useMatchMedia('(max-width: 767px)');
}
