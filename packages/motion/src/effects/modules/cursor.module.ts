import type { EffectBehaviour, EffectModule, EffectParams } from "../effect-types.js";
import {
  cursorPictureAddress,
  cursorWordVariables,
  lettersOnHex,
  safePictureAddress,
} from "../kit/cursor-look.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readColour, readNumber, readText } from "../kit/params.js";
import { isEmbeddedFrame, pointerOnFrame, watchEmbeddedFrames } from "../kit/pointer.js";
import { addStyleOnce } from "../kit/styles.js";
import { approach } from "../maths/smoothing.js";

/**
 * Custom cursors: the site-wide one picked in the builder's site settings (a ring, a dot or
 * the site's own picture), and what the pointer does over one element (a "View" label, a
 * trail of words, or a change to the site cursor).
 *
 * The runtime only starts the site cursor for a mouse or trackpad. Fields, text areas and
 * anything editable keep the normal cursor, so typing never loses its caret. Keyboard
 * focus rings are untouched. With less motion asked for, the cursor follows exactly,
 * changes size without easing and leaves no trail.
 *
 * Elements given a word on the Animate tab carry `data-lintel-cursor-word`: the site
 * cursor turns into a small label with that word over them, and without a site cursor the
 * word follows the pointer on its own. The word's look comes from custom properties: the
 * site's choice on `:root` (written by the server) and an element's own choice on top.
 *
 * Elements given another choice under "When the pointer is over it" carry
 * `data-lintel-cursor-over`: the site cursor grows, shows the element's picture, hides, or
 * steps aside for the normal pointer there.
 *
 * Over an embedded frame (a YouTube or Vimeo player) the page can't tell where the pointer
 * is, so the cursor and its word step aside for the frame's own cursor and come back when
 * the pointer returns to the page.
 */

const hiddenCursorClass = "lintel-custom-cursor";
const cursorWordAttribute = "data-lintel-cursor-word";
const cursorOverAttribute = "data-lintel-cursor-over";

interface CursorPictureShown {
  src: string;
  size: number;
  point: string;
}

/** An element's own word look and its own cursor picture, kept here for the site cursor. */
const wordLooks = new WeakMap<Element, Record<string, string>>();
const overPictures = new WeakMap<Element, CursorPictureShown>();

/** A colour as the canvas needs it: theme variables worked out to rgb(). */
function resolvedColour(colour: string): string {
  if (!colour.startsWith("var(")) return colour;
  const probe = document.createElement("span");
  probe.style.color = colour;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || "#111111";
}

/** Words on a label of this colour: the theme's background on its text colour, else black or white. */
function wordColourOn(colour: string): string {
  if (colour.includes("--lintel-color-text")) return "var(--lintel-color-background, #ffffff)";
  if (colour.includes("--lintel-color-brand")) return "var(--lintel-color-on-brand, #ffffff)";
  return lettersOnHex(colour);
}

function cursorStyles() {
  const custom = `.${hiddenCursorClass}`;
  const over = `[${cursorOverAttribute}`;
  addStyleOnce(
    "lintel-cursor-style",
    `${custom},${custom} *{cursor:none!important}
${custom} :is(input,textarea,select,[contenteditable]){cursor:auto!important}
${custom} ${over}=normal],${custom} ${over}=normal] *{cursor:auto!important}
${custom} ${over}=normal] :is(a[href],button,summary,label,[role=button]){cursor:pointer!important}
${over}=hide],${over}=hide] *{cursor:none}
${over}=picture]{cursor:var(--lintel-cursor-over-picture,auto)}
.lintel-cursor{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483646;border-radius:50%;transition:width .2s,height .2s,opacity .2s,background-color .2s}
.lintel-cursor-alone{transition:width .2s,height .2s,opacity .2s,background-color .2s,scale .2s}
.lintel-cursor-picture{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483646;display:block;height:auto;max-width:none;transition:opacity .2s,scale .2s}
.lintel-cursor-alone[data-grown],.lintel-cursor-picture[data-grown]{scale:1.6}
.lintel-cursor-label{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483646;box-sizing:border-box;display:grid;place-items:center;padding:.5em .9em;border-radius:var(--lintel-cursor-word-radius,999px);aspect-ratio:var(--lintel-cursor-word-ratio,auto);background:var(--lintel-cursor-word-background,var(--lintel-cursor-word-auto-background,var(--lintel-color-text,#111111)));color:var(--lintel-cursor-word-colour,var(--lintel-cursor-word-auto-colour,var(--lintel-color-background,#ffffff)));font:600 var(--lintel-cursor-word-size,.8rem)/1 system-ui,sans-serif;opacity:0;scale:.6;transition:opacity .2s,scale .2s}
.lintel-cursor-label[data-shown]{opacity:1;scale:1}
.lintel-cursor[data-hidden],.lintel-cursor-picture[data-hidden]{opacity:0!important}
@media (prefers-reduced-motion:reduce){.lintel-cursor,.lintel-cursor-alone,.lintel-cursor-picture,.lintel-cursor-label{transition:none}}`,
  );
}

/** Puts an element's own word look on a label, replacing the last element's. */
function setWordLook(label: HTMLElement, variables: Record<string, string> | undefined) {
  for (const name of Array.from(label.style)) {
    if (name.startsWith("--lintel-cursor-word-") && !name.includes("-auto-")) {
      label.style.removeProperty(name);
    }
  }
  for (const [name, value] of Object.entries(variables ?? {})) label.style.setProperty(name, value);
  // A background from the site's own colours, with letters left automatic: pick black or
  // white for it here, where the colour is known.
  const computed = getComputedStyle(label);
  const hasBackground = computed.getPropertyValue("--lintel-cursor-word-background").trim() !== "";
  const hasLetters = computed.getPropertyValue("--lintel-cursor-word-colour").trim() !== "";
  if (hasBackground && !hasLetters) {
    const [red = 0, green = 0, blue = 0] = (computed.backgroundColor.match(/[\d.]+/g) ?? []).map(
      Number,
    );
    label.style.setProperty(
      "--lintel-cursor-word-colour",
      red * 0.299 + green * 0.587 + blue * 0.114 > 160 ? "#111111" : "#ffffff",
    );
  }
}

/** The look an element's word asks for; parts left empty follow the site's choice. */
function wordLookFrom(params: EffectParams): Record<string, string> {
  const size = readText(params, "size", "");
  const shape = readText(params, "shape", "");
  return cursorWordVariables({
    background: readText(params, "background", "") || undefined,
    colour: readText(params, "colour", "") || undefined,
    size: size === "small" || size === "medium" || size === "large" ? size : undefined,
    shape: shape === "pill" || shape === "square" || shape === "circle" ? shape : undefined,
  });
}

function trailCanvas() {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "2147483645",
  });
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = innerWidth * ratio;
    canvas.height = innerHeight * ratio;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
  };
  resize();
  document.body.append(canvas);
  const stop = listen(window, { resize });
  return { canvas, ratio, remove: () => (stop(), canvas.remove()) };
}

type Point = { x: number; y: number; age: number };

function drawTrail(
  context: CanvasRenderingContext2D,
  points: Point[],
  kind: string,
  colour: string,
  size: number,
) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.fillStyle = colour;
  context.strokeStyle = colour;
  context.lineCap = "round";
  points.forEach((point, index) => {
    const life = 1 - point.age;
    if (life <= 0) return;
    context.globalAlpha = life * (kind === "comet" ? 0.6 : 0.45);
    if (kind === "line" || kind === "comet") {
      const previous = points[index - 1];
      if (!previous) return;
      context.lineWidth = kind === "comet" ? size * life : 2;
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    } else if (index % 3 === 0) {
      context.beginPath();
      context.arc(point.x, point.y, (size / 4) * life, 0, Math.PI * 2);
      context.fill();
    }
  });
  context.globalAlpha = 1;
}

/**
 * Where a cursor part goes: centred on the point. It's set with `translate`, which the
 * browser applies after `scale`, so a part shrinking on a click (or a word popping in)
 * shrinks in place instead of sliding towards the corner of the window.
 */
function centredAt(point: { x: number; y: number }): string {
  return `calc(${point.x}px - 50%) calc(${point.y}px - 50%)`;
}

/** Where a picture goes so that its point (the middle, or the top-left corner) is on the pointer. */
function pointedAt(point: { x: number; y: number }, corner: string): string {
  return corner === "top-left" ? `${point.x}px ${point.y}px` : centredAt(point);
}

function makePicture(): HTMLImageElement {
  const picture = document.createElement("img");
  picture.className = "lintel-cursor-picture";
  picture.alt = "";
  picture.decoding = "async";
  picture.setAttribute("aria-hidden", "true");
  picture.style.opacity = "0";
  document.body.append(picture);
  return picture;
}

const siteCursor: EffectBehaviour = (_body, params, context) => {
  const style = readText(params, "style", "ring-and-dot");
  const ownPicture: CursorPictureShown | undefined =
    style === "picture"
      ? {
          src: safePictureAddress(readText(params, "src", "")),
          size: readNumber(params, "size", 32),
          point: readText(params, "point", "centre"),
        }
      : undefined;
  // "Your own picture" with no picture chosen yet keeps the normal pointer.
  if (ownPicture && !ownPicture.src) return;
  cursorStyles();
  // A picture is the whole cursor: no trail behind it.
  const trail =
    context.reduced || context.lowPower || ownPicture ? "none" : readText(params, "trail", "none");
  const colour = readColour(params, "colour", "#111111");
  const size = readNumber(params, "size", 32);
  const make = (diameter: number, fill: boolean) => {
    const node = document.createElement("div");
    node.className = "lintel-cursor";
    node.setAttribute("aria-hidden", "true");
    Object.assign(node.style, {
      width: `${diameter}px`,
      height: `${diameter}px`,
      background: fill ? colour : "transparent",
      border: fill ? "none" : `1.5px solid ${colour}`,
      opacity: "0",
    });
    document.body.append(node);
    return node;
  };
  const blend = style === "blend";
  const ring =
    style === "ring" || style === "ring-and-dot" || blend ? make(size, blend) : undefined;
  const dot =
    style === "dot" || style === "ring-and-dot" ? make(Math.max(6, size / 5), true) : undefined;
  if (blend && ring) {
    ring.style.background = "#fff";
    ring.style.mixBlendMode = "difference";
  }
  // A dot on its own grows by scaling; a ring grows by getting wider.
  if (dot && !ring) dot.classList.add("lintel-cursor-alone");
  // The site's own picture, or an element's: one picture shows whichever applies.
  let picture: HTMLImageElement | undefined = ownPicture ? makePicture() : undefined;
  let shownPicture: CursorPictureShown | undefined = ownPicture;
  const showPicture = (next: CursorPictureShown | undefined) => {
    shownPicture = next;
    if (!next) return;
    picture ??= makePicture();
    if (picture.getAttribute("src") !== next.src) picture.src = next.src;
    picture.style.width = `${next.size}px`;
    picture.style.transformOrigin = next.point === "top-left" ? "0 0" : "50% 50%";
  };
  showPicture(ownPicture);
  document.documentElement.classList.add(hiddenCursorClass);
  const trailLayer = trail !== "none" ? trailCanvas() : undefined;
  const trailColour = trailLayer ? resolvedColour(colour) : colour;
  const word = document.createElement("div");
  word.className = "lintel-cursor-label";
  word.setAttribute("aria-hidden", "true");
  // With no look chosen, the word wears the cursor's colour.
  word.style.setProperty("--lintel-cursor-word-auto-background", colour);
  word.style.setProperty("--lintel-cursor-word-auto-colour", wordColourOn(colour));
  document.body.append(word);
  setWordLook(word, undefined);
  const drawing = trailLayer?.canvas.getContext("2d");
  const target = { x: -100, y: -100 };
  const eased = { x: -100, y: -100 };
  const points: Point[] = [];
  let hovering = false;
  const smoothing = context.reduced ? 0 : 0.8;
  const loop = createFrameLoop(document.documentElement, (elapsed) => {
    eased.x = approach(eased.x, target.x, smoothing, elapsed);
    eased.y = approach(eased.y, target.y, smoothing, elapsed);
    if (dot) dot.style.translate = centredAt(target);
    // A picture is a pointer: it stays exactly on the point, never trailing behind.
    if (picture) picture.style.translate = pointedAt(target, shownPicture?.point ?? "centre");
    word.style.translate = centredAt(eased);
    if (ring) {
      ring.style.translate = centredAt(eased);
      const grown = hovering ? size * 1.8 : size;
      ring.style.width = ring.style.height = `${grown}px`;
    }
    if (drawing && trailLayer) {
      points.forEach((point) => (point.age += elapsed / 450));
      while (points.length && (points[0]?.age ?? 0) >= 1) points.shift();
      drawing.setTransform(trailLayer.ratio, 0, 0, trailLayer.ratio, 0, 0);
      drawTrail(drawing, points, trail, trailColour, size / 2);
    }
    return eased.x !== target.x || eased.y !== target.y || points.length > 0;
  });
  const show = (shown: boolean) =>
    [ring, dot, picture].forEach((node) => node && (node.style.opacity = shown ? "1" : "0"));
  // What the pointer is over: an element with a word, one with "When the pointer is over
  // it", or neither (then the cursor grows over links and buttons, as it always has).
  let shownOver: Element | null = null;
  let shownMode = "";
  const setOver = (element: Element | null, overLink: boolean) => {
    const mode = !element
      ? ""
      : element.hasAttribute(cursorWordAttribute)
        ? "word"
        : (element.getAttribute(cursorOverAttribute) ?? "");
    hovering = mode === "grow" || (mode === "" && overLink);
    [dot, picture].forEach((node) => node?.toggleAttribute("data-grown", hovering));
    if (element === shownOver && mode === shownMode) return;
    shownOver = element;
    shownMode = mode;
    const wordText = mode === "word" ? (element?.getAttribute(cursorWordAttribute) ?? "") : "";
    if (wordText) {
      word.textContent = wordText;
      setWordLook(word, element ? wordLooks.get(element) : undefined);
    }
    word.toggleAttribute("data-shown", wordText !== "");
    const elementPicture = mode === "picture" && element ? overPictures.get(element) : undefined;
    showPicture(elementPicture ?? ownPicture);
    const hideAll = mode === "word" || mode === "hide" || mode === "normal";
    [ring, dot].forEach((node) =>
      node?.toggleAttribute("data-hidden", hideAll || elementPicture !== undefined),
    );
    picture?.toggleAttribute("data-hidden", hideAll || (!elementPicture && !ownPicture));
  };
  // Back from a frame, the cursor appears where the pointer is instead of gliding over.
  let jumpToPointer = false;
  return combine(
    watchEmbeddedFrames({
      onEnter: () => {
        show(false);
        setOver(null, false);
        points.length = 0;
        jumpToPointer = true;
      },
    }),
    listen(
      document,
      {
        pointermove: (event: PointerEvent) => {
          if (event.pointerType !== "mouse" || isEmbeddedFrame(event.target)) return;
          target.x = event.clientX;
          target.y = event.clientY;
          if (jumpToPointer) {
            jumpToPointer = false;
            eased.x = target.x;
            eased.y = target.y;
          }
          if (drawing) points.push({ x: target.x, y: target.y, age: 0 });
          const over = event.target instanceof Element ? event.target : null;
          setOver(
            over?.closest(`[${cursorWordAttribute}],[${cursorOverAttribute}]`) ?? null,
            over?.closest("a, button, [role='button'], label, summary") != null,
          );
          show(true);
          loop.wake();
        },
        pointerdown: () => ring?.style.setProperty("scale", "0.85"),
        pointerup: () => ring?.style.removeProperty("scale"),
      },
      { passive: true },
    ),
    listen(document.documentElement, {
      pointerleave: () => {
        show(false);
        setOver(null, false);
      },
    }),
    () => {
      loop.destroy();
      ring?.remove();
      dot?.remove();
      picture?.remove();
      word.remove();
      trailLayer?.remove();
      document.documentElement.classList.remove(hiddenCursorClass);
    },
  );
};

interface FollowingLabel {
  text: string;
  /** Set colours; without them the label wears the word look's custom properties. */
  background?: string;
  colour?: string;
  look?: Record<string, string>;
  hideNative: boolean;
  /** A word set on the element defers to the site cursor, which shows it itself. */
  deferToSiteCursor: boolean;
}

/** A label that follows the pointer while it is over the element. */
function followingLabel(element: HTMLElement, options: FollowingLabel, reduced: boolean) {
  cursorStyles();
  const label = document.createElement("div");
  label.className = "lintel-cursor-label";
  label.setAttribute("aria-hidden", "true");
  label.textContent = options.text;
  if (options.background) label.style.background = options.background;
  if (options.colour) label.style.color = options.colour;
  document.body.append(label);
  setWordLook(label, options.look);
  const target = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  const smoothing = reduced ? 0 : 0.75;
  const loop = createFrameLoop(element, (elapsed) => {
    eased.x = approach(eased.x, target.x, smoothing, elapsed);
    eased.y = approach(eased.y, target.y, smoothing, elapsed);
    label.style.translate = centredAt(eased);
    return eased.x !== target.x || eased.y !== target.y;
  });
  const showAt = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    if (
      options.deferToSiteCursor &&
      document.documentElement.classList.contains(hiddenCursorClass)
    ) {
      return;
    }
    eased.x = target.x = event.clientX;
    eased.y = target.y = event.clientY;
    label.toggleAttribute("data-shown", true);
    if (options.hideNative) element.style.cursor = "none";
    loop.wake();
  };
  return combine(
    // Over a video's frame the label would freeze where the pointer crossed onto it.
    watchEmbeddedFrames({
      onEnter: () => label.removeAttribute("data-shown"),
      onReturn: (event) => {
        if (event.target instanceof Node && element.contains(event.target)) showAt(event);
      },
    }),
    listen(element, {
      pointerenter: (event: PointerEvent) => {
        if (!pointerOnFrame(event)) showAt(event);
      },
      pointermove: (event: PointerEvent) => {
        target.x = event.clientX;
        target.y = event.clientY;
        loop.wake();
      },
      pointerleave: () => label.removeAttribute("data-shown"),
    }),
    () => {
      loop.destroy();
      label.remove();
      element.style.removeProperty("cursor");
    },
  );
}

/** A label ("View", "Drag", "Play") that follows the pointer while it is over the element. */
const cursorLabel: EffectBehaviour = (element, params, context) => {
  if (!context.finePointer) return;
  return followingLabel(
    element,
    {
      text: readText(params, "text", "View"),
      background: readColour(params, "background", "#111111"),
      colour: readColour(params, "colour", "#ffffff"),
      hideNative: readText(params, "native", "hide") === "hide",
      deferToSiteCursor: false,
    },
    context.reduced,
  );
};

/**
 * The word set on an element with "Word on the cursor". The site cursor shows it when there
 * is one; otherwise this shows it as a small label in the site's word look (the theme's
 * text colour, with the page's colour for the letters, unless the site chose otherwise).
 */
const cursorWord: EffectBehaviour = (element, params, context) => {
  const text = readText(params, "text", "").trim().slice(0, 16);
  if (!text) return;
  const look = wordLookFrom(params);
  element.setAttribute(cursorWordAttribute, text);
  wordLooks.set(element, look);
  const undoAttribute = () => {
    element.removeAttribute(cursorWordAttribute);
    wordLooks.delete(element);
  };
  if (!context.finePointer) return undoAttribute;
  const ownLabel = followingLabel(
    element,
    { text, look, hideNative: true, deferToSiteCursor: true },
    context.reduced,
  );
  return combine(undoAttribute, ownLabel);
};

/** A picture address as CSS `url()`, with nothing in it that could end the string. */
function cssUrl(address: string): string {
  return `url("${address.replace(/["\\\n\r]/g, (character) => encodeURIComponent(character))}")`;
}

/**
 * "When the pointer is over it": the site cursor grows, becomes a different picture, hides,
 * or steps aside for the normal pointer (over text people select, say). The site cursor
 * reads the element's `data-lintel-cursor-over`. Without a site cursor, a picture becomes
 * the browser's own cursor (sized for it, with its point where it was set) and "hide"
 * hides the pointer; growing and the normal pointer have nothing to change.
 */
const cursorOver: EffectBehaviour = (element, params, context) => {
  if (!context.finePointer) return;
  const mode = readText(params, "mode", "grow");
  if (!["grow", "picture", "hide", "normal"].includes(mode)) return;
  const size = Math.min(96, Math.max(16, readNumber(params, "size", 32)));
  const point = readText(params, "point", "centre") === "top-left" ? "top-left" : "centre";
  const source = readText(params, "src", "");
  if (mode === "picture" && !safePictureAddress(source)) return;
  cursorStyles();
  element.setAttribute(cursorOverAttribute, mode);
  if (mode === "picture") {
    overPictures.set(element, { src: cursorPictureAddress(source, size), size, point });
    // The browser's own cursor shows a picture at its real size: ask for it at that size.
    const native = cursorPictureAddress(source, size, 1);
    const sized = new Image();
    sized.onload = () => {
      if (element.getAttribute(cursorOverAttribute) !== "picture") return;
      const width = Math.min(size, sized.naturalWidth || size);
      const height = Math.round((sized.naturalHeight / (sized.naturalWidth || 1)) * width) || size;
      const hotspot =
        point === "top-left" ? "0 0" : `${Math.floor(width / 2)} ${Math.floor(height / 2)}`;
      element.style.setProperty(
        "--lintel-cursor-over-picture",
        `${cssUrl(native)} ${hotspot}, auto`,
      );
    };
    sized.src = native;
  }
  return () => {
    element.removeAttribute(cursorOverAttribute);
    element.style.removeProperty("--lintel-cursor-over-picture");
    overPictures.delete(element);
  };
};

/** Words or emoji left behind the pointer as it moves over the element, fading away. */
const cursorTrail: EffectBehaviour = (element, params, context) => {
  if (context.reduced || !context.finePointer) return;
  const items = readText(params, "items", "✦")
    .split(/\s*,\s*/)
    .filter(Boolean);
  const colour = readColour(params, "colour", "currentColor");
  const gap = readNumber(params, "spacing", 48);
  let last: { x: number; y: number } | undefined;
  let index = 0;
  return listen(element, {
    pointermove: (event: PointerEvent) => {
      if (last && Math.hypot(event.clientX - last.x, event.clientY - last.y) < gap) return;
      last = { x: event.clientX, y: event.clientY };
      const mark = document.createElement("span");
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = items[index++ % items.length] ?? "";
      Object.assign(mark.style, {
        position: "fixed",
        left: `${event.clientX}px`,
        top: `${event.clientY}px`,
        translate: "-50% -50%",
        pointerEvents: "none",
        color: colour,
        zIndex: "2147483645",
        font: "600 1rem system-ui, sans-serif",
      });
      document.body.append(mark);
      mark
        .animate(
          [
            { opacity: 1, transform: "scale(1)" },
            {
              opacity: 0,
              transform: `translateY(-24px) scale(0.6) rotate(${(index % 5) * 9 - 18}deg)`,
            },
          ],
          { duration: 900, easing: "ease-out" },
        )
        .finished.finally(() => mark.remove());
    },
    pointerleave: () => (last = undefined),
  });
};

export const behaviours = { siteCursor, cursorLabel, cursorWord, cursorOver, cursorTrail };
export default { behaviours } satisfies EffectModule;
