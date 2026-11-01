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

/** A script's text ends at the first "</script", so any inside it are written another way. */
function scriptSafeCode(code: string): string {
  return code.replace(/<\/(script)/gi, "<\\/$1");
}

/**
 * The `<head>` additions of a page designed in the builder: preloads for its fonts, its own
 * stylesheet, the script its background videos need and, only when something on it moves,
 * the list of animations and the motion runtime that plays them, and, when it has sliders,
 * tabs, forms or the shop, the elements script.
 */
export function DesignHead({
  design,
  motionScriptUrl,
  elementsScriptUrl,
}: {
  design: PageDesign;
  motionScriptUrl: string | undefined;
  /** The elements script, loaded only when the design has elements that need it. */
  elementsScriptUrl?: string;
}) {
  const animates = design.animations.length > 0 && motionScriptUrl !== undefined;
  const css = animates ? `${motionCloakCss}\n${design.css}` : design.css;
  return (
    <>
      {(design.fontPreloads ?? []).map((href) => (
        <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />
      ))}
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {design.script && (
        <script dangerouslySetInnerHTML={{ __html: scriptSafeCode(design.script) }} />
      )}
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
      {design.usesBehaviours && elementsScriptUrl && <script src={elementsScriptUrl} defer />}
    </>
  );
}
