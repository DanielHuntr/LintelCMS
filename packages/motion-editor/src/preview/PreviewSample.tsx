import type { PreviewSample as SampleKind } from "@lintel/motion/presets";
import type { Ref } from "react";
import { useTranslate } from "../strings/translate.js";

/**
 * The stand-in elements previews animate: a card, a heading, a list and so on. They are
 * pictures, not controls, so they are hidden from screen readers; the preset's name and
 * description say what they show.
 */

interface PreviewSampleProps {
  sample: SampleKind;
  /** The element the animation is mounted on. */
  rootRef: Ref<HTMLElement>;
  size?: "small" | "large";
}

const surface = "rounded-card bg-surface shadow-float";

export function PreviewSample({ sample, rootRef, size = "small" }: PreviewSampleProps) {
  const t = useTranslate();
  const large = size === "large";
  switch (sample) {
    case "heading":
      return (
        <h3
          ref={rootRef as Ref<HTMLHeadingElement>}
          className={large ? "text-large-title text-label" : "text-title text-label"}
        >
          {t("motionEditor.sample.heading")}
        </h3>
      );
    case "button":
      return (
        <span
          ref={rootRef as Ref<HTMLSpanElement>}
          className="inline-flex h-9 items-center rounded-full bg-accent-fill px-5 text-body font-medium text-on-accent"
        >
          {t("motionEditor.sample.button")}
        </span>
      );
    case "image":
      return (
        <div
          ref={rootRef as Ref<HTMLDivElement>}
          className={large ? "h-40 w-64 rounded-card" : "h-20 w-32 rounded-card"}
          style={{
            background:
              "linear-gradient(135deg, var(--color-accent-fill), color-mix(in srgb, var(--color-accent-fill) 35%, #ffb36b))",
          }}
        />
      );
    case "list":
      return (
        <ul ref={rootRef as Ref<HTMLUListElement>} className="flex gap-2">
          {[0, 1, 2, 3].map((index) => (
            <li key={index} className={large ? `h-20 w-16 ${surface}` : `h-12 w-9 ${surface}`} />
          ))}
        </ul>
      );
    case "link":
      return (
        <span
          ref={rootRef as Ref<HTMLSpanElement>}
          className="text-headline text-accent"
          style={{
            backgroundImage: "linear-gradient(currentcolor, currentcolor)",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "left bottom",
            backgroundSize: "var(--underline, 0%) 2px",
            paddingBottom: 2,
          }}
        >
          {t("motionEditor.sample.link")}
        </span>
      );
    case "progress":
      return (
        <div className="h-2 w-40 overflow-hidden rounded-full bg-fill">
          <div
            ref={rootRef as Ref<HTMLDivElement>}
            className="h-full w-full rounded-full bg-accent-fill"
          />
        </div>
      );
    case "panels":
      return (
        <section
          ref={rootRef as Ref<HTMLElement>}
          className={
            large ? "w-72 overflow-hidden rounded-card" : "w-36 overflow-hidden rounded-card"
          }
        >
          <div>
            <div className="flex" style={{ width: "400%" }}>
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className={large ? "h-36 flex-1 p-2" : "h-16 flex-1 p-1"}>
                  <div
                    className="h-full rounded-control"
                    style={{
                      background: `color-mix(in srgb, var(--color-accent-fill) ${30 + index * 20}%, var(--color-surface))`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "page":
      return (
        <div
          ref={rootRef as Ref<HTMLDivElement>}
          className={`${surface} flex flex-col gap-1.5 p-3 ${large ? "h-44 w-64" : "h-20 w-32"}`}
        >
          <span className="h-2 w-1/2 rounded-full bg-label/70" />
          <span className="h-1.5 w-full rounded-full bg-fill-strong" />
          <span className="h-1.5 w-5/6 rounded-full bg-fill-strong" />
          <span className="mt-auto h-1/3 w-full rounded-control bg-accent/20" />
        </div>
      );
    case "card":
      return (
        <div
          ref={rootRef as Ref<HTMLDivElement>}
          className={`${surface} flex flex-col gap-1.5 p-3 ${large ? "h-36 w-56" : "h-16 w-28"}`}
        >
          <span className="h-6 w-6 rounded-full bg-accent/25" />
          <span className="h-1.5 w-3/4 rounded-full bg-label/60" />
          <span className="h-1.5 w-1/2 rounded-full bg-fill-strong" />
        </div>
      );
  }
}
