import {
  lottieAnimationComponent,
  pathTextComponent,
  pathTextGeometry,
  riveAnimationComponent,
  stickerPlaygroundComponent,
} from "@lintel/builder-model";
import { drawsProps, type RenderMode } from "../component-registry.js";
import { cx } from "./behaviour-types.js";

/**
 * The creative pack's drawings (decision 0055). Text on a path is an SVG whose words follow
 * a circle, an arc or a wave; screen readers get the words once, as ordinary text, and the
 * drawing is hidden from them. It is sized in em, so the Style panel's text size (and the
 * site's text styles) set how big it is, and its colour and font come from the text too.
 * Turning is CSS only, and stops for people who ask for less motion.
 *
 * The Lottie and Rive elements draw a box with their still picture; their players (effect
 * modules, see `impliedAnimationEffect`) add the animation over it.
 */

/**
 * Round a circle the words' end meets their start, and spaces at either end of SVG text
 * vanish: a dot (unless they already end with one) and fixed spaces keep the two apart.
 */
export function circleWords(text: string): string {
  const trimmed = text.trim();
  const space = String.fromCharCode(0xa0);
  return /[·•|*✦/–—-]$/.test(trimmed) ? `${trimmed}${space}` : `${trimmed}${space}·${space}`;
}

const PathText = drawsProps(pathTextComponent, ({ props, attributes, node }) => {
  const geometry = pathTextGeometry(props.shape);
  const pathId = `lintel-path-${node.id}`;
  const circle = props.shape === "circle";
  return (
    <div
      {...attributes}
      className={cx(
        attributes.className,
        "lintel-path-text",
        `lintel-path-text--${props.shape}`,
        circle && props.turn !== "off" && `lintel-path-text--turn-${props.turn}`,
      )}
    >
      <span className="lintel-visually-hidden">{props.text}</span>
      <svg
        aria-hidden="true"
        focusable="false"
        className="lintel-path-text__drawing"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      >
        <path id={pathId} d={geometry.path} fill="none" />
        <text className="lintel-path-text__words">
          <textPath
            href={`#${pathId}`}
            {...(geometry.length
              ? { textLength: geometry.length, lengthAdjust: "spacing" }
              : { startOffset: "50%", textAnchor: "middle" })}
          >
            {circle ? circleWords(props.text) : props.text.trim()}
          </textPath>
        </text>
      </svg>
    </div>
  );
});

/**
 * On the canvas, an animation with no still picture shows a quiet stand-in until it is
 * selected and plays, so it never looks like an empty box.
 */
const StandIn = ({ mode, poster }: { mode: RenderMode; poster: string }) =>
  poster ? (
    <img className="lintel-animation__poster" src={poster} alt="" />
  ) : mode === "canvas" ? (
    <span className="lintel-animation__stand-in" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="28"
        height="28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M10 8.5v7l5.5-3.5z" fill="currentColor" stroke="none" />
      </svg>
    </span>
  ) : null;

/** A label makes it a picture screen readers describe; without one it is decoration. */
const describedBy = (label: string) =>
  label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };

const LottieAnimation = drawsProps(lottieAnimationComponent, ({ props, attributes, mode }) => (
  <div
    {...attributes}
    {...describedBy(props.label)}
    className={cx(attributes.className, "lintel-animation")}
  >
    <StandIn mode={mode} poster={props.poster} />
  </div>
));

// One that responds to a click starts as a picture too: its player makes it a button once the
// animation can answer, so nobody reaches a button that does nothing.
const RiveAnimation = drawsProps(riveAnimationComponent, ({ props, attributes, mode }) => (
  <div
    {...attributes}
    {...describedBy(props.label)}
    className={cx(attributes.className, "lintel-animation")}
  >
    <StandIn mode={mode} poster={props.poster} />
  </div>
));

const StickerPlayground = drawsProps(
  stickerPlaygroundComponent,
  ({ props, attributes, children }) => (
    <div
      {...attributes}
      role="group"
      aria-label={props.label || undefined}
      className={cx(attributes.className, "lintel-sticker-playground")}
    >
      {children}
    </div>
  ),
);

export const creativeRenders = {
  pathText: PathText,
  lottieAnimation: LottieAnimation,
  riveAnimation: RiveAnimation,
  stickerPlayground: StickerPlayground,
};

const turn = "@keyframes lintel-path-turn { to { rotate: 1turn; } }";

export const creativeElementsStylesheet = `
:where(.lintel-path-text) { display: inline-block; max-width: 100%; line-height: 1; }
:where(.lintel-path-text__drawing) { display: block; max-width: 100%; height: auto; overflow: visible; }
:where(.lintel-path-text--circle) :where(.lintel-path-text__drawing) { width: 10em; }
:where(.lintel-path-text--arc) :where(.lintel-path-text__drawing) { width: 24em; }
:where(.lintel-path-text--wave) :where(.lintel-path-text__drawing) { width: 24em; }
:where(.lintel-path-text__words) { font-size: 1px; fill: currentColor; }
${turn}
@media (prefers-reduced-motion: no-preference) {
  :where(.lintel-path-text--turn-slowly) :where(.lintel-path-text__drawing) { animation: lintel-path-turn 24s linear infinite; }
  @supports (animation-timeline: scroll()) {
    :where(.lintel-path-text--turn-scroll) :where(.lintel-path-text__drawing) { animation: lintel-path-turn linear both; animation-timeline: scroll(root); }
  }
}
:where(.lintel-animation) { position: relative; display: block; overflow: hidden; }
:where(.lintel-animation__poster, .lintel-animation__stage) { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; display: block; }
:where(.lintel-animation__stage) :where(svg) { display: block; }
:where(.lintel-animation__stand-in) { position: absolute; inset: 0; display: grid; place-items: center; border-radius: inherit; background: var(--lintel-color-surface); color: var(--lintel-color-text-secondary); }
:where(.lintel-animation[data-playing]) > :where(.lintel-animation__stand-in) { display: none; }
:where(.lintel-sticker-playground) { position: relative; }
`;
