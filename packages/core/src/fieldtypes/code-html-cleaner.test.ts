import { removeScriptsFromHtml } from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { removeScriptsFromCodeHtml } from "./code-html-cleaner.js";

/** HTML that browsers read differently from the builder's own parser. */
const readDifferentlyByBrowsers = [
  "<!--><img src=x onerror=alert(1)>-->",
  "<style>a{}</style/><img src=x onerror=alert(2)><style></style>",
  "<svg><style><img src=x onerror=alert(3)></style></svg>",
  '<svg><a><animate attributeName="href" values="javascript:alert(4)"/><text y="20">Go</text></a></svg>',
];

describe("cleaning a code block's HTML on the server", () => {
  it.each(readDifferentlyByBrowsers)("leaves nothing that runs in %s", (html) => {
    const cleaned = removeScriptsFromCodeHtml(html);

    expect(cleaned).not.toMatch(/onerror|javascript:/i);
  });

  it("is needed: the builder's own cleaner lets these through", () => {
    const missed = readDifferentlyByBrowsers.filter((html) =>
      /onerror|javascript:/i.test(removeScriptsFromHtml(html)),
    );

    expect(missed.length).toBeGreaterThan(0);
  });

  it("keeps the HTML people write: markers, classes, styles and embeds", () => {
    const html =
      '<div class="card" style="color: red"><h2 data-lintel-field="heading">Our story</h2>' +
      '<img data-lintel-image="photo" src="/team.jpg" alt="The team">' +
      '<a href="/about" target="_blank">More</a>' +
      '<iframe src="https://www.youtube.com/embed/abc" allowfullscreen=""></iframe></div>';

    expect(removeScriptsFromCodeHtml(html)).toBe(html);
  });

  it("takes out scripts, handlers, script links and frames' own HTML", () => {
    const cleaned = removeScriptsFromCodeHtml(
      '<p onclick="x()">Hi</p><script>x()</script><a href="javascript:x()">Go</a>' +
        '<iframe srcdoc="<script>x()</script>"></iframe><base href="https://evil.example">',
    );

    expect(cleaned).toBe("<p>Hi</p><a>Go</a><iframe></iframe>");
  });
});
