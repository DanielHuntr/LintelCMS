import type { PageDesign } from "../templates/view.types.js";

/** Elements that animate in stay hidden until their animation is ready (see @lintel/motion). */
export const motionCloakCss = `@media (scripting: enabled) and (prefers-reduced-motion: no-preference) {
  [data-motion-cloak] { opacity: 0; animation: lintel-motion-uncloak 0s 2s forwards; }
}
@keyframes lintel-motion-uncloak { to { opacity: 1; } }`;

/** JSON that is safe inside a `<script>` element: no `<` can close it early. */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * The `<head>` additions of a page designed in the builder: its own stylesheet and, only
 * when something on it moves, the list of animations and the motion runtime that plays them.
 */
export function DesignHead({
  design,
  motionScriptUrl,
}: {
  design: PageDesign;
  motionScriptUrl: string | undefined;
}) {
  const animates = design.animations.length > 0 && motionScriptUrl !== undefined;
  const css = animates ? `${motionCloakCss}\n${design.css}` : design.css;
  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {animates && (
        <>
          <script
            type="application/json"
            id="lintel-motion"
            dangerouslySetInnerHTML={{ __html: scriptSafeJson(design.animations) }}
          />
          <script src={motionScriptUrl} defer />
        </>
      )}
    </>
  );
}
