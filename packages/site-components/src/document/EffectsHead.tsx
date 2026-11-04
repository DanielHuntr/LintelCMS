import type { PageDesign, SiteEffectsHead } from "../templates/view.types.js";
import { scriptSafeJson } from "./DesignHead.js";

/**
 * The `<head>` additions for the Effects library: the site-wide effects' CSS (page
 * transitions run from it, with no script), the list of the page's effects and the
 * address of each module they need, and the motion runtime when nothing else loaded it.
 * A page whose code block uses `window.lintelMotion` gets the runtime too. A page with no
 * effects and a site with none switched on gets nothing at all.
 */
export function EffectsHead({
  design,
  siteEffects,
  effectModuleUrls,
  customShaders,
  motionScriptUrl,
}: {
  design: PageDesign | null;
  siteEffects: SiteEffectsHead | undefined;
  effectModuleUrls: Readonly<Record<string, string>>;
  /** The site's own shaders' code, by id. Only those this page's layers name are written. */
  customShaders?: Readonly<Record<string, string>>;
  motionScriptUrl: string | undefined;
}) {
  const bindings = design?.effects ?? [];
  const runsSomething =
    bindings.length > 0 || (siteEffects?.modules.length ?? 0) > 0 || design?.usesMotionApi === true;
  if (!runsSomething && !siteEffects?.css) return null;
  const used = new Set([
    ...bindings.map((binding) => binding.module),
    ...(siteEffects?.modules ?? []),
  ]);
  const modules = Object.fromEntries(
    Object.entries(effectModuleUrls).filter(([name]) => used.has(name)),
  );
  const plans = bindings.map((binding) => String(binding.params.plan ?? "")).join("");
  const shaders = Object.entries(customShaders ?? {}).filter(([id]) =>
    plans.includes(`"shader":"${id}"`),
  );
  // DesignHead already loads the runtime for pages with animations.
  const runtimeLoaded = (design?.animations.length ?? 0) > 0;
  return (
    <>
      {siteEffects?.css && <style dangerouslySetInnerHTML={{ __html: siteEffects.css }} />}
      {siteEffects?.headScript && (
        <script dangerouslySetInnerHTML={{ __html: siteEffects.headScript }} />
      )}
      {runsSomething && motionScriptUrl && (
        <>
          <script
            type="application/json"
            id="lintel-effects"
            dangerouslySetInnerHTML={{
              __html: scriptSafeJson({
                modules,
                bindings,
                site: siteEffects?.settings,
                ...(shaders.length > 0 ? { shaders: Object.fromEntries(shaders) } : {}),
              }),
            }}
          />
          {!runtimeLoaded && <script src={motionScriptUrl} defer />}
        </>
      )}
    </>
  );
}
