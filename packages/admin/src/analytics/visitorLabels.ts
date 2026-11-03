import { formatDate, formatNumber, formattingLocale } from "../i18n/formatting.js";
import { t } from "../i18n/strings.js";

/** Plain words for the figures: times, changes and the names of what was counted. */

export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return t("visitors.noTime");
  if (seconds < 60) return t("visitors.seconds", { seconds });
  return t("visitors.minutes", { minutes: Math.floor(seconds / 60), seconds: seconds % 60 });
}

export function formatPercent(value: number | null): string {
  return value === null ? t("visitors.noTime") : `${formatNumber(value)}%`;
}

export type ChangeDirection = "up" | "down" | "same" | "new";

/** How a figure compares with the period before, in words. */
export function describeChange(
  current: number,
  previous: number,
): { direction: ChangeDirection; text: string } {
  if (previous === 0) {
    return current === 0
      ? { direction: "same", text: t("visitors.change.same") }
      : { direction: "new", text: t("visitors.change.new") };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return { direction: "same", text: t("visitors.change.same") };
  return percent > 0
    ? { direction: "up", text: t("visitors.change.up", { percent }) }
    : { direction: "down", text: t("visitors.change.down", { percent: -percent }) };
}

export function pageLabel(key: string): string {
  return key === "/" ? t("visitors.homePage") : key;
}

export function sourceLabel(key: string): string {
  return key === "" ? t("visitors.direct") : key;
}

export function deviceLabel(key: string): string {
  if (key === "phone" || key === "tablet" || key === "desktop") return t(`visitors.device.${key}`);
  return t("visitors.unknown");
}

export function countryLabel(key: string): string {
  if (key === "") return t("visitors.unknown");
  try {
    return new Intl.DisplayNames([formattingLocale()], { type: "region" }).of(key) ?? key;
  } catch {
    return key;
  }
}

export function goalLabel(key: string): string {
  if (key === "order") return t("visitors.goal.order");
  if (key.startsWith("form:")) return t("visitors.goal.form", { form: key.slice(5) });
  return key;
}

export function dayLabel(day: string): string {
  return formatDate(`${day}T12:00:00Z`);
}
