import { createHash } from "node:crypto";
import { STYLESHEET_FOLDER } from "../website/site-context.service.js";

/**
 * The small script pages carry while an A/B test runs. It counts each browser once as a
 * visitor of the version it saw, and once more if it then reaches the test's goal. To count
 * each browser only once it keeps one first-party localStorage key, `lintel-tests`, holding
 * just the test's id, the version letter and whether the goal was reached: nothing about the
 * person, nothing sent anywhere but this site. Browsers asking not to be tracked (Do Not
 * Track, Global Privacy Control) are never counted; the server doesn't send them the script
 * either. See docs/decisions/0044-ab-testing.md.
 *
 * Plain ES2017 with no imports, so it is served as it is.
 */
const code = `(() => {
  const settings = document.getElementById("lintel-tests");
  if (!settings) return;
  const navigatorPrivacy = navigator;
  if (navigatorPrivacy.doNotTrack === "1" || window.doNotTrack === "1" || navigatorPrivacy.globalPrivacyControl === true) return;
  let config;
  try { config = JSON.parse(settings.textContent || "{}"); } catch { return; }
  const tests = Array.isArray(config.tests) ? config.tests : [];
  const storageKey = "lintel-tests";
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(storageKey) || "{}") || {}; } catch { return; }
  const running = {};
  for (const test of tests) running[test.id] = test;
  for (const id of Object.keys(seen)) if (!running[id]) delete seen[id];
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(seen)); } catch {} };
  const send = (id, version, event) => {
    const body = JSON.stringify({ experiment: id, version, event });
    if (navigator.sendBeacon && navigator.sendBeacon(config.endpoint, new Blob([body], { type: "text/plain" }))) return;
    fetch(config.endpoint, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
  };
  for (const marker of document.querySelectorAll("template[data-lintel-test]")) {
    const id = marker.getAttribute("data-lintel-test");
    const version = marker.getAttribute("data-lintel-version");
    if (running[id] && version && !seen[id]) {
      seen[id] = { v: version };
      send(id, version, "visit");
    }
  }
  save();
  const convert = (test) => {
    const entry = seen[test.id];
    if (!entry || entry.c) return;
    entry.c = 1;
    save();
    send(test.id, entry.v, "conversion");
  };
  const here = location.pathname.replace(/\\/+$/, "") || "/";
  for (const test of tests) {
    const goal = test.goal || {};
    if (goal.kind === "page" && goal.path && (goal.path.replace(/\\/+$/, "") || "/") === here) convert(test);
    if (goal.kind === "order" && /\\/order-confirmation$/.test(here)) convert(test);
  }
  const sameLink = (link, target) => {
    try {
      const clicked = new URL(link.href, location.href);
      const wanted = new URL(target, location.href);
      return clicked.href === wanted.href || (clicked.origin === wanted.origin && clicked.pathname === wanted.pathname && clicked.search === wanted.search);
    } catch { return false; }
  };
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link) return;
    for (const test of tests) if (test.goal && test.goal.kind === "click" && sameLink(link, test.goal.target)) convert(test);
  }, true);
  document.addEventListener("lintel:form-sent", () => {
    for (const test of tests) if (test.goal && test.goal.kind === "form") convert(test);
  });
})();
`;

const fingerprint = createHash("sha256").update(code).digest("hex").slice(0, 12);

export const testsScript = { code, path: `${STYLESHEET_FOLDER}/tests-${fingerprint}.js` };

/** Where the script reports visits and conversions, on the website's own address. */
export const TESTS_ENDPOINT = `${STYLESHEET_FOLDER}/tests`;
