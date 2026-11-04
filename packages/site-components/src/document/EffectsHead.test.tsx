import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PageDesign } from "../templates/view.types.js";
import { EffectsHead } from "./EffectsHead.js";

const design = (plan: string) =>
  ({
    html: "",
    css: "",
    animations: [],
    effects: [{ nodeId: "a", module: "shader-stack", behaviour: "shaderStack", params: { plan } }],
  }) as unknown as PageDesign;

const draw = (plan: string, customShaders: Record<string, string>) =>
  renderToStaticMarkup(
    <EffectsHead
      design={design(plan)}
      siteEffects={undefined}
      effectModuleUrls={{ "shader-stack": "/stack.js" }}
      customShaders={customShaders}
      motionScriptUrl="/motion.js"
    />,
  );

describe("custom shaders in the page's list", () => {
  it("carries only the shaders the page uses", () => {
    const html = draw(`{"layers":[{"shader":"rings"}]}`, {
      rings: "void main(){}",
      other: "secret code",
    });
    expect(html).toContain("void main(){}");
    expect(html).not.toContain("secret code");
  });

  it("can't be broken out of by code that closes the script", () => {
    const html = draw(`{"layers":[{"shader":"rings"}]}`, {
      rings: "</script><script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>alert");
  });

  it("adds nothing to a page without them", () => {
    expect(draw(`{"layers":[]}`, { rings: "x" })).not.toContain("shaders");
  });
});
