import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { importHtml } from "./html-import.js";
import { parseHtml, textContent } from "./html-parser.js";
import { formatHtml, writeHtml } from "./html-writer.js";

describe("reading and writing HTML", () => {
  it("parses elements, attributes, void elements, comments and references", () => {
    const nodes = parseHtml(
      '<p class=lead data-x="a &amp; b">Fish &amp; chips<br>today<!-- hi --></p><img src="/a.png" alt=\'A\'>',
    );
    expect(nodes).toMatchObject([
      {
        tag: "p",
        attributes: [
          ["class", "lead"],
          ["data-x", "a & b"],
        ],
        children: [
          { text: "Fish & chips" },
          { tag: "br" },
          { text: "today" },
          { kind: "comment", text: " hi " },
        ],
      },
      {
        tag: "img",
        attributes: [
          ["src", "/a.png"],
          ["alt", "A"],
        ],
        children: [],
      },
    ]);
    expect(textContent(nodes[0] as never)).toBe("Fish & chips\ntoday");
  });

  it("closes unclosed elements and ignores stray end tags", () => {
    expect(writeHtml(parseHtml("<div><p>One</span></div>Two"))).toBe("<div><p>One</p></div>Two");
  });

  it("keeps script and style text as written", () => {
    expect(writeHtml(parseHtml("<style>a > b { color: red }</style>"))).toBe(
      "<style>a > b { color: red }</style>",
    );
  });

  it("formats block elements one per line and keeps inline ones together", () => {
    expect(
      formatHtml(
        '<section class="hero"><h1>Hello <em>there</em></h1><div><img src="/a.png" alt=""><p>Text</p></div></section>',
      ),
    ).toBe(
      [
        '<section class="hero">',
        "  <h1>Hello <em>there</em></h1>",
        "  <div>",
        '    <img src="/a.png" alt="">',
        "    <p>Text</p>",
        "  </div>",
        "</section>",
      ].join("\n"),
    );
  });
});

describe("importing HTML", () => {
  const options = {
    catalogue: standardCatalogue,
    createId: createCountingNodeIds(),
    allowCode: true,
  };

  it("turns known tags into builder elements", () => {
    const { nodes, codeBlocks, skipped } = importHtml(
      `<header id="top"><nav aria-label="Main"><a href="/">Home</a><a href="javascript:x()">Bad</a></nav></header>
       <section><h2>Our <strong>menu</strong></h2><p>Fresh daily.</p><a class="btn" href="/order">Order</a>
       <figure><img src="/soup.jpg" alt="Soup"><figcaption>Soup of the day</figcaption></figure>
       <ol><li>One</li><li>Two</li></ol><blockquote><p>Lovely.</p><cite>— Sam</cite></blockquote><hr></section>
       <script>alert(1)</script>`,
      options,
    );
    expect(codeBlocks).toBe(0);
    expect(skipped).toBe(1);
    const describe = (node: (typeof nodes)[number]): unknown => [
      node.type,
      node.props,
      node.children.map(describe),
    ];
    expect(nodes.map(describe)).toEqual([
      [
        "section",
        { element: "header", anchor: "top" },
        [
          [
            "navigation",
            {
              menuSource: "custom",
              menuHandle: "main",
              label: "Main",
              links: [
                { label: "Home", href: "/" },
                { label: "Bad", href: "" },
              ],
            },
            [],
          ],
        ],
      ],
      [
        "section",
        { element: "section", anchor: "" },
        [
          ["heading", { text: "Our menu", level: 2 }, []],
          ["text", { text: "Fresh daily." }, []],
          ["button", { label: "Order", href: "/order", openInNewTab: false }, []],
          [
            "image",
            { src: "/soup.jpg", alt: "Soup", assetId: null, caption: "Soup of the day" },
            [],
          ],
          ["list", { items: ["One", "Two"], ordered: true }, []],
          ["quote", { text: "Lovely.", citation: "Sam" }, []],
          ["divider", {}, []],
        ],
      ],
    ]);
  });

  it("keeps what can’t be mapped as code, or leaves it out without the code permission", () => {
    const html = "<table><tr><td>1</td></tr></table><p>Read <a href='/x'>this</a></p>";
    const withCode = importHtml(html, options);
    expect(withCode.nodes.map((node) => [node.type, node.props.html])).toEqual([
      ["codeBlock", "<table><tr><td>1</td></tr></table>"],
      ["codeBlock", '<p>Read <a href="/x">this</a></p>'],
    ]);
    expect(importHtml(html, { ...options, allowCode: false })).toMatchObject({
      nodes: [],
      skipped: 2,
    });
  });

  it("brings back the styles of the page’s own classes", () => {
    const styles = { base: { color: "red" } };
    const { nodes } = importHtml('<h2 class="intro-title">Hi</h2>', {
      ...options,
      stylesByClass: new Map([["intro-title", { name: "Intro title", styles }]]),
    });
    expect(nodes[0]).toMatchObject({ name: "Intro title", styles });
  });
});
