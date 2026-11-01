import { useEffect, useState } from "react";

/** `value`, but only once it has stopped changing for `delay` ms: one search per pause in typing. */
export function useDebouncedValue<Value>(value: Value, delay: number): Value {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
