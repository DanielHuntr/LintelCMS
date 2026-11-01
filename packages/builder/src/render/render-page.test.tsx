import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findSectionTemplate,
  formatHtml,
  type PageDocument,
  type PageNode,
  standardCatalogue,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { renderPage } from "./render-page.js";
import { standardRegistry } from "./stand-in-components.js";

function pageOf(...children: PageNode[]): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children } };
}

function templatePage(...templateIds: string[]): PageDocument {
  const createId = createCountingNodeIds();
  return pageOf(
    ...templateIds.map((id) =>
      createNode(findSectionTemplate(id)!.blueprint, standardCatalogue, createId),
    ),
  );
}

describe("rendering a page", () => {
  it("prints clean, semantic HTML and a readable stylesheet", () => {
    const page = templatePage("hero", "features", "testimonial");
    const { html, css } = renderPage(page, standardRegistry);
    expect(formatHtml(html)).toMatchSnapshot("html");
    expect(css).toMatchSnapshot("css");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("data-lintel");
  });

  it("gives the same output for the same page", () => {
    const page = templatePage("text-and-picture", "call-to-action", "questions");
    expect(renderPage(page, standardRegistry)).toEqual(renderPage(page, standardRegistry));
  });

  it("marks elements and editable text on the canvas", () => {
    const { html } = renderPage(templatePage("hero"), standardRegistry, { mode: "canvas" });
    expect(html).toContain('<h1 class="hero-title" data-lintel-node="n3" data-lintel-text="text">');
  });

  it("leaves hidden elements out, with their styles", () => {
    const createId = createCountingNodeIds();
    const hidden = { ...createNode({ type: "button" }, standardCatalogue, createId), hidden: true };
    const result = renderPage(pageOf(hidden), standardRegistry);
    expect(result).toEqual({
      html: '<div class="page"></div>',
      css: "",
      usesBehaviours: false,
      animations: [],
      effects: [],
      fontPreloads: [],
      script: "",
    });
  });

  it("draws pictures with alt text, in a figure when they have a caption", () => {
    const createId = createCountingNodeIds();
    const plain = createNode(
      { type: "image", props: { src: "/a.jpg", alt: "A cat" } },
      standardCatalogue,
      createId,
    );
    const captioned = createNode(
      { type: "image", props: { src: "/b.jpg", alt: "A dog", caption: "Rex" } },
      standardCatalogue,
      createId,
    );
    const { html } = renderPage(pageOf(plain, captioned), standardRegistry);
    expect(html).toContain('<img class="picture" src="/a.jpg" alt="A cat"/>');
    expect(html).toContain(
      '<figure class="picture-2"><img src="/b.jpg" alt="A dog"/><figcaption>Rex</figcaption></figure>',
    );
  });

  it("fills in code block markers, and keeps scripts off the canvas", () => {
    const createId = createCountingNodeIds();
    const code = createNode(
      {
        type: "codeBlock",
        props: {
          html: '<p data-lintel-field="note">Old</p><script>run()</script>',
          css: ".custom { color: red; }",
          js: "start()",
          fields: { note: "New" },
        },
      },
      standardCatalogue,
      createId,
    );
    const page = pageOf(code);
    const site = renderPage(page, standardRegistry);
    expect(site.html).toBe(
      '<div class="page"><div class="code"><p data-lintel-field="note">New</p><script>run()</script></div><script>start()</script></div>',
    );
    expect(site.css).toContain(".custom { color: red; }");
    const canvas = renderPage(page, standardRegistry, { mode: "canvas" });
    expect(canvas.html).not.toContain("<script");
  });

  it("draws one element on its own for the code view", () => {
    const page = templatePage("hero");
    const { html, css } = renderPage(page, standardRegistry, { nodeId: "n3" });
    expect(html).toBe('<h1 class="hero-title">Good things, made well</h1>');
    expect(css).toMatch(/^\.hero-title \{\n {2}font-size: clamp/);
  });

  it("draws the site’s blocks with @lintel/site-components, inside the element’s own class", () => {
    const createId = createCountingNodeIds();
    const hero = createNode(
      { type: "heroBlock", props: { heading: "Fresh bread", buttonHref: "/order" } },
      standardCatalogue,
      createId,
    );
    const text = createNode(
      { type: "textBlock", props: { heading: "", text: "One <b>\n\nTwo" } },
      standardCatalogue,
      createId,
    );
    const { html } = renderPage(pageOf(hero, text), standardRegistry);
    expect(html).toContain(
      '<div class="hero"><section class="lintel-section lintel-hero" aria-labelledby="hero-n1" data-lintel-component="hero">',
    );
    expect(html).toContain(
      '<h1 id="hero-n1" class="lintel-hero__heading" data-lintel-field="heading">Fresh bread</h1>',
    );
    expect(html).toContain(
      '<a class="lintel-button lintel-button--primary" href="/order" data-lintel-field="button">Get in touch</a>',
    );
    expect(html).toContain("<p>One &lt;b&gt;</p><p>Two</p>");
  });

  it("lists the page's animations and marks their elements for the motion runtime", () => {
    const page = templatePage("hero");
    const plain = renderPage(page, standardRegistry);
    expect(plain.html).not.toContain("data-node-id");
    const { html, animations } = renderPage(page, standardRegistry, { withMotion: true });
    const heading = animations[0];
    expect(heading?.nodeId).toBe("n3");
    expect(heading?.spec.targets).toEqual({ type: "text", split: "words" });
    expect(html).toContain('<h1 class="hero-title" data-node-id="n3" data-motion-cloak="">');
    // A press is played by a click, so the button is never hidden while it waits.
    expect(html).toMatch(/<a class="button" data-node-id="n\d+" href="\/contact">/);
  });

  it("leaves the animations of hidden elements out", () => {
    const createId = createCountingNodeIds();
    const hero = createNode(findSectionTemplate("hero")!.blueprint, standardCatalogue, createId);
    expect(renderPage(pageOf({ ...hero, hidden: true }), standardRegistry).animations).toEqual([]);
  });
});
