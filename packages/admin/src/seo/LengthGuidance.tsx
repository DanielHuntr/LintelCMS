import type { LengthAdvice } from "@lintel/core/seo-titles";
import { classNames } from "../design/classNames.js";
import { t, type StringKey } from "../i18n/strings.js";

interface LengthGuidanceProps {
  id: string;
  length: number;
  recommended: number;
  advice: LengthAdvice;
  /** What is being measured, for the advice: titles and descriptions say different things. */
  kind: "title" | "description";
}

const adviceKeys: Record<"title" | "description", Record<LengthAdvice, StringKey>> = {
  title: {
    missing: "seo.advice.title.missing",
    short: "seo.advice.title.short",
    good: "seo.advice.title.good",
    long: "seo.advice.title.long",
  },
  description: {
    missing: "seo.advice.description.missing",
    short: "seo.advice.description.short",
    good: "seo.advice.description.good",
    long: "seo.advice.description.long",
  },
};

/**
 * "48 of about 60 characters · A good length" under a title or description. Green when
 * it's a good length, orange when it'll be cut off or says too little. Not a hard limit:
 * search engines measure in pixels and change their minds.
 */
export function LengthGuidance({ id, length, recommended, advice, kind }: LengthGuidanceProps) {
  return (
    <p
      id={id}
      className={classNames(
        "text-caption",
        advice === "good"
          ? "text-success"
          : advice === "missing"
            ? "text-label-secondary"
            : "text-warning",
      )}
    >
      {t("seo.lengthCount", { length, recommended })} · {t(adviceKeys[kind][advice])}
    </p>
  );
}
