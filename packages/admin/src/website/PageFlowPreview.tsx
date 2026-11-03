import {
  INTRO_SHORTEST_MILLISECONDS,
  introCount,
  introLeavingKeyframes,
  pageTransitionLooks,
} from "@lintel/motion/effects";
import { Play } from "lucide-react";
import { forwardRef, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import type { PageFlow } from "./PageFlowSettings.js";

/**
 * A small stand-in website that plays the chosen intro and page change with the very
 * keyframes the published site uses (from @lintel/motion/effects). It plays when a choice
 * changes, unless the person's device asks for less motion; "Play again" always plays.
 */

interface PageFlowPreviewProps {
  value: PageFlow;
  siteName: string;
  logoUrl: string | null;
}

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const prefersLessMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Frames = ReadonlyArray<Readonly<Record<string, string | number>>>;

/** Element.animate, where the browser has it (test environments don't). */
function animate(element: HTMLElement | null, frames: Frames, options: KeyframeAnimationOptions) {
  if (!element || typeof element.animate !== "function") return Promise.resolve();
  return element
    .animate(frames as Keyframe[], options)
    .finished.then(() => undefined)
    .catch(() => undefined);
}

function stopAnimations(...elements: Array<HTMLElement | null>) {
  for (const element of elements) {
    if (element && typeof element.getAnimations === "function") {
      element.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    }
  }
}

export function PageFlowPreview({ value, siteName, logoUrl }: PageFlowPreviewProps) {
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const introMiddle = useRef<HTMLSpanElement>(null);
  const run = useRef(0);
  const [showing, setShowing] = useState<"first" | "intro" | "both">("first");
  const [count, setCount] = useState(0);
  const { pageTransition, intro: introSettings } = value;
  const anythingOn = pageTransition.style !== "none" || introSettings.style !== "none";

  const play = useCallback(async () => {
    const thisRun = ++run.current;
    const stillPlaying = () => run.current === thisRun;
    stopAnimations(first.current, second.current, intro.current);
    setCount(0);
    if (introSettings.style !== "none") {
      setShowing("intro");
      await wait(20);
      void animate(introMiddle.current, introEntrance[introSettings.style], {
        duration: 900,
        easing: "cubic-bezier(.22,1,.36,1)",
        fill: "both",
      });
      const started = performance.now();
      while (stillPlaying() && performance.now() - started < INTRO_SHORTEST_MILLISECONDS) {
        setCount(introCount((performance.now() - started) / INTRO_SHORTEST_MILLISECONDS));
        await wait(40);
      }
      if (!stillPlaying()) return;
      setCount(100);
      await animate(intro.current, introLeavingKeyframes[introSettings.style], {
        duration: 600,
        easing: "cubic-bezier(.76,0,.24,1)",
        fill: "forwards",
      });
      if (!stillPlaying()) return;
      setShowing("first");
      stopAnimations(intro.current);
    }
    if (pageTransition.style === "none") return;
    await wait(introSettings.style === "none" ? 150 : 500);
    if (!stillPlaying()) return;
    setShowing("both");
    const look = pageTransitionLooks[pageTransition.style];
    const timing = {
      duration: pageTransition.duration,
      easing: look.easing,
      fill: "both" as const,
    };
    await Promise.all([
      animate(first.current, look.leave, timing),
      animate(second.current, look.enter, timing),
    ]);
    await wait(1400);
    if (!stillPlaying()) return;
    stopAnimations(first.current, second.current);
    setShowing("first");
  }, [pageTransition.style, pageTransition.duration, introSettings.style]);

  // Plays when a choice changes (not when the page opens), so the effect of each is clear.
  const choices = `${pageTransition.style} ${pageTransition.duration} ${introSettings.style}`;
  const playedFor = useRef(choices);
  useEffect(() => {
    if (playedFor.current === choices) return;
    if (anythingOn && !prefersLessMotion()) {
      // A moment later, so a quick run of changes (arrow keys through a list) plays once.
      const timer = window.setTimeout(() => {
        playedFor.current = choices;
        void play();
      }, 120);
      return () => window.clearTimeout(timer);
    }
    playedFor.current = choices;
    // Stops whatever was playing; with nothing on, the still page shows (see `shown`).
    run.current += 1;
    stopAnimations(first.current, second.current, intro.current);
  }, [play, anythingOn, choices]);

  useEffect(
    () => () => {
      run.current += 1;
    },
    [],
  );

  const shown = anythingOn ? showing : "first";
  const words = introSettings.text.trim() || siteName;
  const layered =
    pageTransition.style !== "none" && pageTransitionLooks[pageTransition.style].layered;

  return (
    <figure className="flex w-full max-w-xs flex-col gap-2 justify-self-center sm:justify-self-stretch">
      {/* A website stays a light page here whatever the admin's own appearance. */}
      <div
        aria-hidden="true"
        className="relative isolate aspect-[4/3] overflow-hidden rounded-[0.625rem] border border-separator"
        style={{ background: mockPageColours.background }}
      >
        <MockPage ref={first} kind="home" siteName={siteName} />
        <MockPage
          ref={second}
          kind="about"
          siteName={siteName}
          style={{
            visibility: shown === "both" ? "visible" : "hidden",
            zIndex: layered ? 1 : undefined,
          }}
        />
        <div
          ref={intro}
          className="absolute inset-0 z-10 grid place-items-center px-4 text-center"
          style={{
            visibility: shown === "intro" ? "visible" : "hidden",
            background: introSettings.background,
            color: introSettings.colour,
          }}
        >
          <span ref={introMiddle} className="block overflow-hidden">
            {introSettings.style === "counter" && (
              <span className="text-[2.5rem] leading-none font-semibold tabular-nums">{count}</span>
            )}
            {(introSettings.style === "name" || (introSettings.style === "logo" && !logoUrl)) && (
              <span className="block text-[1.4rem] leading-tight font-semibold">{words}</span>
            )}
            {introSettings.style === "logo" && logoUrl && (
              <img src={logoUrl} alt="" className="max-h-16 max-w-32 object-contain" />
            )}
            {introSettings.style === "curtain" && (
              <span className="block h-0.5 w-28 origin-left bg-current" />
            )}
          </span>
        </div>
      </div>
      <figcaption className="flex min-h-9 items-center justify-between gap-3">
        <span className="text-footnote text-label-secondary">
          {anythingOn ? t("pageFlow.preview") : t("pageFlow.previewStill")}
        </span>
        {anythingOn && (
          <Button type="button" variant="plain" size="small" onClick={() => void play()}>
            <Play aria-hidden="true" className="size-3.5" />
            {t("pageFlow.play")}
          </Button>
        )}
      </figcaption>
    </figure>
  );
}

/** How each intro's middle arrives, matching the published intro's CSS. */
const introEntrance: Record<Exclude<PageFlow["intro"]["style"], "none">, Frames> = {
  counter: [{ opacity: 1 }, { opacity: 1 }],
  name: [{ transform: "translateY(105%)" }, { transform: "translateY(0)" }],
  logo: [
    { opacity: 0, transform: "scale(.94)", filter: "blur(6px)" },
    { opacity: 1, transform: "scale(1)", filter: "blur(0)" },
  ],
  curtain: [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
};

const mockPageColours = { background: "#ffffff", text: "#1c1c1e" };

const MockPage = forwardRef<
  HTMLDivElement,
  { kind: "home" | "about"; siteName: string; style?: CSSProperties }
>(function MockPage({ kind, siteName, style }, ref) {
  return (
    <div
      ref={ref}
      style={{ background: mockPageColours.background, color: mockPageColours.text, ...style }}
      className="absolute inset-0 flex flex-col gap-2.5 p-3.5"
    >
      <div className="flex items-center justify-between">
        <span className="max-w-[60%] truncate text-[0.625rem] font-semibold">{siteName}</span>
        <span className="flex gap-1.5">
          <span className="h-1 w-5 rounded-full bg-[#d1d1d6]" />
          <span className="h-1 w-5 rounded-full bg-[#d1d1d6]" />
        </span>
      </div>
      <span className="text-[0.9375rem] leading-tight font-semibold">
        {kind === "home" ? t("pageFlow.previewPageOne") : t("pageFlow.previewPageTwo")}
      </span>
      {kind === "home" ? (
        <div className="grid flex-1 grid-cols-2 gap-2">
          <span className="rounded-md bg-[#e5e5ea]" />
          <span className="rounded-md bg-[#d1d1d6]" />
        </div>
      ) : (
        <span className="flex-1 rounded-md bg-[#e8dccb]" />
      )}
      <span className="h-1.5 w-4/5 rounded-full bg-[#e5e5ea]" />
      <span className="h-1.5 w-3/5 rounded-full bg-[#e5e5ea]" />
    </div>
  );
});
