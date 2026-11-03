import { eachBehaviour } from "./behaviour-helpers.js";

/**
 * Live clocks: each shows the time in its place, in the page's language, and changes on the
 * minute. Nothing is announced to screen readers as it ticks; the time is simply there when
 * they reach it. Kept free of imports so the elements script stays small; it reads the time
 * as `formatClockTime` in `@lintel/builder-model` does (a test checks they agree).
 */
export function clockText(date: Date, zone: string, hours: string, locale: string): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: hours === "12" ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: hours === "12",
  };
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      ...options,
      timeZone: zone === "local" ? undefined : zone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
}

export function setUpClocks(root: ParentNode): void {
  eachBehaviour(root, "clock", (clock) => {
    const time = clock.querySelector<HTMLTimeElement>(".lintel-clock__time");
    if (!time) return;
    const zone = clock.dataset.zone ?? "local";
    const hours = clock.dataset.hours ?? "24";
    const locale = clock.closest("[lang]")?.getAttribute("lang") ?? "";
    const tick = () => {
      if (!clock.isConnected) return;
      const now = new Date();
      time.textContent = clockText(now, zone, hours, locale);
      time.dateTime = now.toISOString();
      window.setTimeout(tick, 60_000 - (now.getTime() % 60_000) + 50);
    };
    tick();
  });
}
