// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readPageAnimations, installSiteRuntime } from "./site-runtime.js";

describe("the site runtime", () => {
  it("reads the page's animations, and nothing when the list is missing or broken", () => {
    document.body.innerHTML = `<script type="application/json" id="lintel-motion">[{"nodeId":"a1","spec":{}}]</script>`;
    expect(readPageAnimations(document)).toEqual([{ nodeId: "a1", spec: {} }]);
    document.body.innerHTML = `<script type="application/json" id="lintel-motion">not json</script>`;
    expect(readPageAnimations(document)).toEqual([]);
    document.body.innerHTML = "";
    expect(readPageAnimations(document)).toEqual([]);
  });

  it("makes the runtime available to the builder's canvas", () => {
    installSiteRuntime(window);
    expect(typeof window.lintelMotion?.mountMotion).toBe("function");
  });
});
