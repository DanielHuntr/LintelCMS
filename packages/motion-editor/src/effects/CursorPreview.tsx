import {
  cursorIsOn,
  cursorPictureAddress,
  cursorWordVariables,
  defaultCursorWordLook,
  lettersOnHex,
  type CursorSettings,
} from "@lintel/motion/effects";
import { useState, type CSSProperties, type PointerEvent } from "react";
import { useTranslate } from "../strings/translate.js";

/**
 * A small sample of the site, where moving the mouse shows the cursor as it is set up:
 * its look, growing over a link and the word over a card. Nothing has to be published
 * to try a change. It draws the same parts as the site's cursor, from the same settings.
 */

type Zone = "card" | "link" | null;

function cursorColour(colour: string): string {
  if (colour === "text") return "var(--lintel-color-text, #111111)";
  if (colour === "brand") return "var(--lintel-color-brand, #111111)";
  return colour;
}

function lettersOn(colour: string): string {
  if (colour === "text") return "var(--lintel-color-background, #ffffff)";
  if (colour === "brand") return "var(--lintel-color-on-brand, #ffffff)";
  return lettersOnHex(colour);
}

export function CursorPreview({ cursor }: { cursor: CursorSettings }) {
  const t = useTranslate();
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [zone, setZone] = useState<Zone>(null);
  const on = cursorIsOn(cursor);
  const colour = cursorColour(cursor.colour);
  const grown = zone === "link";

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    const box = event.currentTarget.getBoundingClientRect();
    setPoint({ x: event.clientX - box.left, y: event.clientY - box.top });
    const over = event.target instanceof Element ? event.target.closest("[data-zone]") : null;
    setZone((over?.getAttribute("data-zone") as Zone) ?? null);
  };

  const at = (x: number, y: number, centred = true): CSSProperties => ({
    position: "absolute",
    left: 0,
    top: 0,
    pointerEvents: "none",
    translate: centred ? `calc(${x}px - 50%) calc(${y}px - 50%)` : `${x}px ${y}px`,
  });

  const wordStyle: CSSProperties | undefined = point
    ? ({
        ...at(point.x, point.y),
        ...cursorWordVariables(cursor.word ?? defaultCursorWordLook),
        display: "grid",
        placeItems: "center",
        boxSizing: "border-box",
        padding: ".5em .9em",
        borderRadius: "var(--lintel-cursor-word-radius, 999px)",
        aspectRatio: "var(--lintel-cursor-word-ratio, auto)",
        font: "600 var(--lintel-cursor-word-size, .8rem)/1 system-ui, sans-serif",
        background: `var(--lintel-cursor-word-background, ${on ? colour : "var(--lintel-color-text, #111111)"})`,
        color: `var(--lintel-cursor-word-colour, ${on ? lettersOn(cursor.colour) : "var(--lintel-color-background, #ffffff)"})`,
      } as CSSProperties)
    : undefined;

  const parts = () => {
    if (!point || !on || zone === "card") return null;
    const { style, size } = cursor;
    if (style === "picture" && cursor.picture) {
      const picture = cursor.picture;
      return (
        <img
          alt=""
          src={cursorPictureAddress(picture.src, picture.size)}
          style={{
            ...at(point.x, point.y, picture.point !== "top-left"),
            width: picture.size,
            maxWidth: "none",
            scale: grown ? "1.6" : "1",
            transformOrigin: picture.point === "top-left" ? "0 0" : "50% 50%",
          }}
        />
      );
    }
    const ringSize = grown ? size * 1.8 : size;
    const ring =
      style === "ring" || style === "ring-and-dot" || style === "blend" ? (
        <div
          style={{
            ...at(point.x, point.y),
            width: ringSize,
            height: ringSize,
            borderRadius: "50%",
            border: style === "blend" ? "none" : `1.5px solid ${colour}`,
            background: style === "blend" ? "#ffffff" : "transparent",
            mixBlendMode: style === "blend" ? "difference" : undefined,
          }}
        />
      ) : null;
    const dotSize = Math.max(6, size / 5);
    const dot =
      style === "dot" || style === "ring-and-dot" ? (
        <div
          style={{
            ...at(point.x, point.y),
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            background: colour,
            scale: grown && style === "dot" ? "1.6" : "1",
          }}
        />
      ) : null;
    return (
      <>
        {ring}
        {dot}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption font-medium text-label-secondary">
        {t("motionEditor.site.cursor.preview")}
      </span>
      <div
        data-testid="cursor-preview"
        onPointerMove={move}
        onPointerLeave={() => {
          setPoint(null);
          setZone(null);
        }}
        style={{
          background: "var(--lintel-color-background, #ffffff)",
          color: "var(--lintel-color-text, #111111)",
          cursor: on || zone === "card" ? "none" : "auto",
        }}
        className="relative flex h-36 items-end justify-between gap-3 overflow-hidden rounded-control p-3 hairline-ring select-none"
      >
        <span aria-hidden="true" className="absolute top-3 left-3 text-caption opacity-60">
          {t("motionEditor.site.cursor.preview.hint")}
        </span>
        <span
          aria-hidden="true"
          data-zone="link"
          className="text-footnote underline underline-offset-2"
        >
          {t("motionEditor.site.cursor.preview.link")}
        </span>
        <div
          aria-hidden="true"
          data-zone="card"
          style={{ background: "var(--lintel-color-surface, #f2f2f4)" }}
          className="flex h-20 w-32 items-end rounded-[10px] p-2 text-caption font-semibold"
        >
          {t("motionEditor.site.cursor.preview.card")}
        </div>
        {parts()}
        {point && zone === "card" && (
          <div aria-hidden="true" data-testid="cursor-preview-word" style={wordStyle}>
            {t("motionEditor.site.cursor.preview.word")}
          </div>
        )}
      </div>
    </div>
  );
}
