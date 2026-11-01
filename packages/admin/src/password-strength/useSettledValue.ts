import { useEffect, useState } from "react";

/**
 * `value`, but only once it has stopped changing for `delay` milliseconds. Used for screen
 * reader announcements, so the strength is read out when typing pauses, not on every key.
 */
export function useSettledValue<Value>(value: Value, delay: number): Value {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
