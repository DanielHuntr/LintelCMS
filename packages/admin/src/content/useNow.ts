import { useEffect, useState } from "react";

/**
 * The current time, refreshed every minute, so "2 minutes ago" keeps up without
 * re-rendering the list every second.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return now;
}
