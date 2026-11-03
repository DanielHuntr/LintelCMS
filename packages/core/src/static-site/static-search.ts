import type { PageView } from "@lintel/site-components";

/**
 * Search for a site published as files: a JSON index of every page made at export time,
 * and a small script that searches it in the visitor's browser. No server is asked.
 */

export const SEARCH_PATH = "/search";
export const SEARCH_INDEX_FILE = "_lintel/search-index.json";
export const SEARCH_SCRIPT_FILE = "_lintel/search.js";

export interface SearchRecord {
  title: string;
  url: string;
  text: string;
}

const TEXT_LENGTH = 600;

/** What the index keeps of a page: its title and the start of its main text. */
export function searchRecordFor(html: string, url: string): SearchRecord {
  const title =
    decodeEntities(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "").split(" | ")[0] ?? "";
  const main = /<main[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1] ?? "";
  const text = decodeEntities(
    main
      .replace(/<(script|style|form)[\s\S]*?<\/\1>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).slice(0, TEXT_LENGTH);
  return { title, url, text };
}

export function buildSearchIndex(records: readonly SearchRecord[]): string {
  return JSON.stringify({ pages: records });
}

/** The search page: a labelled search box and a place for results, in the page layout. */
export function searchPageView(): PageView {
  return {
    kind: "page",
    title: "Search",
    summary: "",
    heroImage: null,
    sections: [],
    design: null,
    body: [
      '<form role="search" class="lintel-site-search" data-lintel-search action="/search/" method="get">',
      '<label for="lintel-search-box">Search this site</label> ',
      '<input id="lintel-search-box" type="search" name="q" autocomplete="off"> ',
      '<button type="submit" class="lintel-button lintel-button--primary">Search</button>',
      "</form>",
      '<div data-lintel-search-results aria-live="polite"></div>',
      `<script src="/${SEARCH_SCRIPT_FILE}" defer></script>`,
    ].join(""),
  };
}

/** Plain ES5: loads the index once, then shows pages containing every word typed. */
export const searchScript = `(function () {
  "use strict";
  var form = document.querySelector("[data-lintel-search]");
  var results = document.querySelector("[data-lintel-search-results]");
  if (!form || !results) return;
  var box = form.querySelector("input[name=q]");
  var index = null;
  function load() {
    if (index) return Promise.resolve(index);
    return fetch("/${SEARCH_INDEX_FILE}").then(function (response) { return response.json(); })
      .then(function (data) { index = data.pages || []; return index; });
  }
  function show(query) {
    var words = query.toLowerCase().split(/\\s+/).filter(Boolean);
    results.textContent = "";
    if (words.length === 0) return;
    load().then(function (pages) {
      var found = pages.filter(function (page) {
        var haystack = (page.title + " " + page.text).toLowerCase();
        return words.every(function (word) { return haystack.indexOf(word) !== -1; });
      });
      var heading = document.createElement("p");
      heading.textContent = found.length === 0 ? "Nothing matches “" + query + "”." :
        found.length + (found.length === 1 ? " page matches." : " pages match.");
      results.appendChild(heading);
      var list = document.createElement("ul");
      found.slice(0, 50).forEach(function (page) {
        var item = document.createElement("li");
        var link = document.createElement("a");
        link.href = page.url;
        link.textContent = page.title || page.url;
        var text = document.createElement("p");
        text.textContent = page.text.slice(0, 160);
        item.appendChild(link);
        item.appendChild(text);
        list.appendChild(item);
      });
      results.appendChild(list);
    });
  }
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    history.replaceState(null, "", "?q=" + encodeURIComponent(box.value));
    show(box.value);
  });
  var start = new URLSearchParams(location.search).get("q");
  if (start) { box.value = start; show(start); }
})();
`;

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
