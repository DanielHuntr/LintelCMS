import { splitText } from "../../targets/splitText.js";
import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { createFrameLoop } from "../kit/frames.js";
import { combine, listen } from "../kit/listen.js";
import { readColour, readList, readNumber, readText } from "../kit/params.js";
import { setStyles } from "../kit/styles.js";
import { approach, stepSpring, type SpringState } from "../maths/smoothing.js";

/**
 * Text effects: scramble, typewriter, letters pushed by the pointer, variable-font axes,
 * marker highlights, rotating words, counting up and waves. The words are in the page's
 * HTML, so they read without the script and search engines see them; screen readers get
 * the whole text once, never letter by letter (the moving copy is hidden from them).
 * Widths are held while letters change, so nothing around the text jumps.
 */

const visuallyHidden =
  "position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";

/** Replaces the element's text with a spoken copy and a visible one the effect may change. */
function speakingCopy(element: HTMLElement) {
  const original = Array.from(element.childNodes);
  const text = element.textContent ?? "";
  const spoken = document.createElement("span");
  spoken.setAttribute("style", visuallyHidden);
  spoken.textContent = text;
  const shown = document.createElement("span");
  shown.setAttribute("aria-hidden", "true");
  shown.textContent = text;
  element.replaceChildren(spoken, shown);
  return { text, shown, restore: () => element.replaceChildren(...original) };
}

function onceInView(element: Element, start: () => void, threshold = 0.4) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    },
    { threshold },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

const scrambleCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=?";

/** Letters shuffle through random characters before settling, left to right. */
const scramble: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const copy = speakingCopy(element);
  const duration = readNumber(params, "duration", 900);
  const characters = readText(params, "characters", scrambleCharacters) || scrambleCharacters;
  const restoreWidth = setStyles(copy.shown, {
    display: "inline-block",
    "min-width": `${copy.shown.offsetWidth}px`,
  });
  let started = 0;
  const loop = createFrameLoop(element, (_elapsed, now) => {
    if (!started) return false;
    const progress = Math.min(1, (now - started) / duration);
    const settled = Math.floor(progress * copy.text.length);
    copy.shown.textContent = Array.from(copy.text)
      .map((letter, index) =>
        index < settled || /\s/.test(letter)
          ? letter
          : characters[Math.floor(Math.random() * characters.length)],
      )
      .join("");
    return progress < 1;
  });
  const run = () => {
    started = performance.now();
    loop.wake();
  };
  const onHover = readText(params, "trigger", "view") === "hover";
  return combine(
    onHover ? listen(element, { pointerenter: run, focusin: run }) : onceInView(element, run),
    () => loop.destroy(),
    restoreWidth,
    copy.restore,
  );
};

/**
 * Types itself out, with a blinking caret. Given a list of phrases, it types each in turn,
 * deleting the last one first. The space for the longest phrase is kept from the start.
 */
const typewriter: EffectBehaviour = (element, params, context) => {
  const copy = speakingCopy(element);
  const phrases = readList(params, "phrases", "");
  const lines = phrases.length ? phrases : [copy.text];
  if (phrases.length) copy.shown.previousElementSibling!.textContent = lines.join(", ");
  if (context.reduced) {
    copy.shown.textContent = lines[0] ?? "";
    return copy.restore;
  }
  const speed = readNumber(params, "speed", 45);
  const pause = readNumber(params, "pause", 1600);
  const caret = document.createElement("span");
  caret.textContent = "|";
  caret.setAttribute("aria-hidden", "true");
  caret.style.marginInlineStart = "1px";
  const blink = caret.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 530,
    iterations: Infinity,
    direction: "alternate",
    easing: "steps(1)",
  });
  const text = document.createElement("span");
  copy.shown.replaceChildren(text, caret);
  let line = 0;
  let shown = 0;
  let deleting = false;
  let timer = 0;
  const tick = () => {
    const current = lines[line] ?? "";
    shown += deleting ? -1 : 1;
    text.textContent = current.slice(0, shown);
    let wait = deleting ? speed / 2 : speed * (0.6 + Math.random() * 0.8);
    if (!deleting && shown >= current.length) {
      if (lines.length === 1) return;
      deleting = true;
      wait = pause;
    } else if (deleting && shown <= 0) {
      deleting = false;
      line = (line + 1) % lines.length;
      wait = speed * 6;
    }
    timer = window.setTimeout(tick, wait);
  };
  return combine(
    onceInView(element, () => (timer = window.setTimeout(tick, 300))),
    () => window.clearTimeout(timer),
    () => blink.cancel(),
    copy.restore,
  );
};

/** Each letter is pushed away by the pointer and springs back. */
const letterPhysics: EffectBehaviour = (element, params, context) => {
  if (context.reduced || !context.finePointer) return;
  const split = splitText(element, "letters");
  const reach = readNumber(params, "reach", 90);
  const push = readNumber(params, "push", 26);
  const letters = split.pieces.map((piece) => ({
    piece,
    x: { value: 0, velocity: 0 } as SpringState,
    y: { value: 0, velocity: 0 } as SpringState,
  }));
  let pointer: { x: number; y: number } | undefined;
  const loop = createFrameLoop(element, (elapsed) => {
    let moving = false;
    for (const letter of letters) {
      let targetX = 0;
      let targetY = 0;
      if (pointer) {
        const box = letter.piece.getBoundingClientRect();
        const dx = box.left + box.width / 2 - letter.x.value - pointer.x;
        const dy = box.top + box.height / 2 - letter.y.value - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < reach && distance > 0) {
          const strength = (1 - distance / reach) * push;
          targetX = (dx / distance) * strength;
          targetY = (dy / distance) * strength;
        }
      }
      letter.x = stepSpring(letter.x, targetX, { stiffness: 220, damping: 14 }, elapsed);
      letter.y = stepSpring(letter.y, targetY, { stiffness: 220, damping: 14 }, elapsed);
      letter.piece.style.translate = `${letter.x.value}px ${letter.y.value}px`;
      moving ||=
        Math.abs(letter.x.value - targetX) +
          Math.abs(letter.y.value - targetY) +
          Math.abs(letter.x.velocity) +
          Math.abs(letter.y.velocity) >
        0.05;
    }
    return moving || pointer !== undefined;
  });
  return combine(
    listen(element, {
      pointermove: (event: PointerEvent) => (
        (pointer = { x: event.clientX, y: event.clientY }),
        loop.wake()
      ),
      pointerleave: () => ((pointer = undefined), loop.wake()),
    }),
    () => loop.destroy(),
    split.restore,
  );
};

/**
 * Animates a variable font's axes (weight, width, slant): on hover, as the pointer comes
 * near each letter, or in a gentle loop. Needs a variable font; others simply stay still.
 */
const variableAxis: EffectBehaviour = (element, params, context) => {
  const axis = readText(params, "axis", "wght").slice(0, 4);
  const from = readNumber(params, "from", 300);
  const to = readNumber(params, "to", 800);
  const mode = readText(params, "trigger", "hover");
  const set = (target: HTMLElement, value: number) =>
    (target.style.fontVariationSettings = `"${axis}" ${Math.round(value)}`);
  if (context.reduced) return;
  if (mode === "pointer") {
    const split = splitText(element, "letters");
    const values = split.pieces.map(() => from);
    let pointerX: number | undefined;
    const loop = createFrameLoop(element, (elapsed) => {
      let moving = false;
      split.pieces.forEach((piece, index) => {
        const box = piece.getBoundingClientRect();
        const near =
          pointerX === undefined
            ? 0
            : Math.max(0, 1 - Math.abs(box.left + box.width / 2 - pointerX) / 160);
        const next = approach(values[index]!, from + (to - from) * near, 0.8, elapsed);
        moving ||= next !== values[index];
        values[index] = next;
        set(piece, next);
      });
      return moving;
    });
    return combine(
      listen(element, {
        pointermove: (event: PointerEvent) => ((pointerX = event.clientX), loop.wake()),
        pointerleave: () => ((pointerX = undefined), loop.wake()),
      }),
      () => loop.destroy(),
      split.restore,
    );
  }
  set(element, from);
  const restore = setStyles(element, {
    transition: "font-variation-settings 500ms cubic-bezier(.2,.8,.2,1)",
  });
  if (mode === "loop") {
    const animation = element.animate(
      [
        { fontVariationSettings: `"${axis}" ${from}` },
        { fontVariationSettings: `"${axis}" ${to}` },
      ],
      {
        duration: readNumber(params, "duration", 2400),
        iterations: Infinity,
        direction: "alternate",
        easing: "ease-in-out",
      },
    );
    return combine(
      () => animation.cancel(),
      restore,
      () => element.style.removeProperty("font-variation-settings"),
    );
  }
  return combine(
    listen(element, {
      pointerenter: () => set(element, to),
      pointerleave: () => set(element, from),
      focusin: () => set(element, to),
      focusout: () => set(element, from),
    }),
    restore,
    () => element.style.removeProperty("font-variation-settings"),
  );
};

/** A marker stroke sweeps under (or behind) the text when it comes into view. */
const markerHighlight: EffectBehaviour = (element, params, context) => {
  const colour = readColour(params, "colour", "rgb(255 214 10 / 0.6)");
  const style = readText(params, "style", "underline");
  const size = style === "underline" ? "100% 0.35em" : "100% 100%";
  const base = setStyles(element, {
    "background-image": `linear-gradient(${colour}, ${colour})`,
    "background-repeat": "no-repeat",
    "background-position": style === "underline" ? "0 88%" : "0 50%",
    "background-size": context.reduced ? size : `0% ${size.split(" ")[1]}`,
    "-webkit-box-decoration-break": "clone",
    "box-decoration-break": "clone",
  });
  if (context.reduced) return base;
  return combine(
    onceInView(element, () => {
      element.style.transition = `background-size ${readNumber(params, "duration", 900)}ms cubic-bezier(.65,0,.35,1)`;
      element.style.backgroundSize = size;
    }),
    () => element.style.removeProperty("transition"),
    base,
  );
};

/** One word in the sentence swaps for the next in a list every few seconds. */
const rotatingWords: EffectBehaviour = (element, params, context) => {
  const words = readList(params, "words", "faster, simpler, friendlier");
  if (words.length < 2) return;
  const copy = speakingCopy(element);
  copy.shown.previousElementSibling!.textContent = `${copy.text} ${words.join(", ")}`;
  const word = document.createElement("span");
  const width = document.createElement("span");
  Object.assign(word.style, { display: "inline-block", whiteSpace: "nowrap" });
  copy.shown.append(" ", word);
  width.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
  copy.shown.append(width);
  const widest = Math.max(
    ...words.map((candidate) => ((width.textContent = candidate), width.offsetWidth)),
  );
  width.remove();
  word.style.minWidth = `${widest}px`;
  let index = 0;
  word.textContent = words[0]!;
  const every = readNumber(params, "every", 2200);
  const timer = window.setInterval(() => {
    index = (index + 1) % words.length;
    if (context.reduced) {
      word.textContent = words[index]!;
      return;
    }
    word
      .animate(
        [
          { transform: "translateY(0)", opacity: 1 },
          { transform: "translateY(-0.6em)", opacity: 0 },
        ],
        { duration: 220, easing: "ease-in" },
      )
      .finished.then(() => {
        word.textContent = words[index]!;
        word.animate(
          [
            { transform: "translateY(0.6em)", opacity: 0 },
            { transform: "translateY(0)", opacity: 1 },
          ],
          { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      });
  }, every);
  return combine(() => window.clearInterval(timer), copy.restore);
};

/**
 * Counts every number in the text up from zero when it comes into view, keeping its
 * separators and decimals ("1,250+", "4.9"). The digits use tabular figures, so the line
 * doesn't wobble while counting.
 */
const countUp: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const copy = speakingCopy(element);
  const parts = copy.text.split(/(\d[\d,.]*)/);
  const restoreFigures = setStyles(copy.shown, { "font-variant-numeric": "tabular-nums" });
  const duration = readNumber(params, "duration", 1800);
  const draw = (progress: number) => {
    const eased = 1 - Math.pow(1 - progress, 3);
    copy.shown.textContent = parts
      .map((part, index) => {
        if (index % 2 === 0) return part;
        const decimals = (part.split(".")[1] ?? "").length;
        const target = Number(part.replace(/,/g, ""));
        const value = (target * eased).toFixed(decimals);
        return part.includes(",")
          ? Number(value).toLocaleString("en", { minimumFractionDigits: decimals })
          : value;
      })
      .join("");
  };
  draw(0);
  let started = 0;
  const loop = createFrameLoop(element, (_elapsed, now) => {
    if (!started) return false;
    const progress = Math.min(1, (now - started) / duration);
    draw(progress);
    return progress < 1;
  });
  return combine(
    onceInView(element, () => ((started = performance.now()), loop.wake())),
    () => loop.destroy(),
    restoreFigures,
    copy.restore,
  );
};

/** The letters ride a gentle wave, on a loop or while hovered. */
const waveText: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const split = splitText(element, "letters");
  const height = readNumber(params, "height", 0.2);
  const onHover = readText(params, "trigger", "loop") === "hover";
  const animations = split.pieces.map((piece, index) =>
    piece.animate(
      [
        { transform: "translateY(0)" },
        { transform: `translateY(-${height}em)` },
        { transform: "translateY(0)" },
      ],
      {
        duration: 1200,
        delay: index * 60,
        iterations: onHover ? 1 : Infinity,
        easing: "ease-in-out",
      },
    ),
  );
  if (onHover) animations.forEach((animation) => animation.cancel());
  const replay = () => animations.forEach((animation) => animation.play());
  return combine(
    onHover ? listen(element, { pointerenter: replay, focusin: replay }) : undefined,
    () => animations.forEach((animation) => animation.cancel()),
    split.restore,
  );
};

/**
 * The words slide up out of sight while a copy rolls in from below, on hover and on keyboard
 * focus, and roll back when the pointer leaves. The original words stay where they were, so
 * screen readers hear them once; the copy is hidden from them. With less motion, nothing
 * moves.
 */
const rollUp: EffectBehaviour = (element, params, context) => {
  if (context.reduced) return;
  const original = Array.from(element.childNodes);
  const text = element.textContent ?? "";
  if (text.trim() === "") return;
  const frame = document.createElement("span");
  frame.setAttribute("data-lintel-roll", "");
  frame.setAttribute(
    "style",
    "display:inline-grid;overflow:hidden;vertical-align:top;line-height:inherit",
  );
  const words = document.createElement("span");
  words.append(...original);
  const copy = document.createElement("span");
  copy.setAttribute("aria-hidden", "true");
  copy.textContent = text;
  for (const layer of [words, copy]) {
    layer.style.gridArea = "1 / 1";
    layer.style.display = "block";
    layer.style.whiteSpace = "nowrap";
  }
  copy.style.transform = "translateY(100%)";
  frame.append(words, copy);
  element.replaceChildren(frame);
  const duration = readNumber(params, "duration", 420);
  const options: KeyframeAnimationOptions = {
    duration,
    easing: "cubic-bezier(.65,0,.35,1)",
    fill: "forwards",
  };
  let up = false;
  const roll = (toTop: boolean) => {
    if (up === toTop) return;
    up = toTop;
    words.animate(
      [
        { transform: `translateY(${toTop ? 0 : -100}%)` },
        { transform: `translateY(${toTop ? -100 : 0}%)` },
      ],
      options,
    );
    copy.animate(
      [
        { transform: `translateY(${toTop ? 100 : 0}%)` },
        { transform: `translateY(${toTop ? 0 : 100}%)` },
      ],
      options,
    );
  };
  return combine(
    listen(element, {
      pointerenter: () => roll(true),
      pointerleave: () => roll(element.matches(":focus-within")),
      focusin: () => roll(true),
      focusout: () => roll(element.matches(":hover")),
    }),
    () => element.replaceChildren(...original),
  );
};

export const behaviours = {
  scramble,
  typewriter,
  letterPhysics,
  variableAxis,
  markerHighlight,
  rotatingWords,
  countUp,
  waveText,
  rollUp,
};
export default { behaviours } satisfies EffectModule;
