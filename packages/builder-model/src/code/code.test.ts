import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { createEmptyPage, type PageDocument } from "../document/page-document.schema.js";
import { createNode } from "../tree/create-node.js";
import { duplicateNode } from "../tree/tree-changes.js";
import { applyScriptRule, findChangedCode } from "./code-changes.js";
import { fillCodeMarkers, findCodeMarkers } from "./code-markers.js";
import { makeCssSafeToEmbed, removeScriptsFromHtml } from "./sanitise-code.js";

const html =
  '<div class="card"><h2 data-lintel-field="heading">Our story</h2><img data-lintel-image="photo" src="/team.jpg" alt="The team"></div>';

describe("code block markers", () => {
  it("finds the marked text and pictures", () => {
    expect(findCodeMarkers(html)).toEqual([
      { kind: "field", name: "heading", defaultText: "Our story", defaultImage: null },
      {
        kind: "image",
        name: "photo",
        defaultText: "",
        defaultImage: { src: "/team.jpg", alt: "The team", assetId: null },
      },
    ]);
  });

  it("fills in what people chose, escaped", () => {
    expect(
      fillCodeMarkers(
        html,
        { heading: "Fish <&> chips" },
        { photo: { src: "/new.jpg", alt: "New", assetId: "a1" } },
      ),
    ).toBe(
      '<div class="card"><h2 data-lintel-field="heading">Fish &lt;&amp;&gt; chips</h2><img data-lintel-image="photo" src="/new.jpg" alt="New"></div>',
    );
  });

  it("won’t fill in an unsafe picture address", () => {
    expect(
      fillCodeMarkers(html, {}, { photo: { src: "javascript:x", alt: "", assetId: null } }),
    ).toContain('src="/team.jpg"');
  });
});

describe("removing scripts", () => {
  it("takes out scripts, handlers and script links but keeps the rest", () => {
    expect(
      removeScriptsFromHtml(
        '<div onclick="x()"><script>x()</script><a href=" java\tscript:x()">a</a><a href="/ok">b</a><iframe srcdoc="<script>"></iframe></div>',
      ),
    ).toBe('<div><a>a</a><a href="/ok">b</a><iframe></iframe></div>');
  });

  it("stops CSS from closing its style element", () => {
    expect(makeCssSafeToEmbed("a{}</style><script>")).toBe("a{}<\\/style><script>");
  });
});

describe("code changes", () => {
  const createId = (() => {
    let count = 0;
    return () => `c${(count += 1)}`;
  })();
  const block = createNode(
    { type: "codeBlock", props: { html, js: "console.log(1)" } },
    standardCatalogue,
    createId,
  );
  const page: PageDocument = {
    ...createEmptyPage(),
    root: { ...createEmptyPage().root, children: [block] },
  };

  it("allows moving, duplicating and filling in code without new code", () => {
    const duplicated = { ...page, root: duplicateNode(page.root, block.id, createId).root };
    expect(findChangedCode(page, duplicated, standardCatalogue)).toEqual([]);
    const filled = {
      ...page,
      root: {
        ...page.root,
        children: [{ ...block, props: { ...block.props, fields: { heading: "Hi" } } }],
      },
    };
    expect(findChangedCode(page, filled, standardCatalogue)).toEqual([]);
  });

  it("names code blocks with new or changed code", () => {
    const changed = {
      ...page,
      root: { ...page.root, children: [{ ...block, props: { ...block.props, css: "a{}" } }] },
    };
    expect(findChangedCode(page, changed, standardCatalogue)).toEqual([block.id]);
    expect(findChangedCode(null, page, standardCatalogue)).toEqual([block.id]);
  });

  it("removes scripts under the default rule only", () => {
    expect(applyScriptRule(page, "removeScripts").root.children[0]?.props.js).toBe("");
    expect(applyScriptRule(page, "allowScripts")).toBe(page);
  });
});
