/**
 * The beacon every published page loads while the Visitors plugin is on (see page-tag.ts),
 * about 1.5 KB. It keeps nothing in the browser (no cookies, no storage) and sends:
 *
 *   - "view" when the page opens: its path, the other site that sent the visitor, the
 *     window's width, any utm_source / utm_campaign, and the A/B test version the page shows
 *     (from its `<template data-lintel-test>` marker, see src/experiments);
 *   - "leave" once, when the page is hidden, closed or left, with how long it was in view;
 *   - "outbound" when a link to another website is followed;
 *   - "custom" for `lintelAnalytics.track("name")`, which a site's own code can call. It
 *     also fires `lintel:track` on document, so an A/B test can use the event as its goal.
 *
 * It sends nothing when the browser asks not to be tracked (Do Not Track, Global Privacy
 * Control) or is driven by a robot. With "Count visitors only after they accept" on
 * (`data-consent="required"`), it waits until the cookie notice allows "plugin:analytics"
 * (`window.lintelConsent.allows`, or the `lintel:consent` event on document), or until the
 * site's own code calls `lintelAnalytics.consent()`.
 */
export const analyticsScript = `(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || window.lintelAnalytics) return;
  var data = script.dataset;
  var endpoint = data.endpoint || "/_lintel/api/analytics/collect";
  var url = endpoint + (data.site ? "?site=" + encodeURIComponent(data.site) : "");
  var nav = navigator;
  var optedOut =
    nav.doNotTrack === "1" || window.doNotTrack === "1" || nav.globalPrivacyControl === true || nav.webdriver === true;
  var allowed = data.consent !== "required";
  var started = false;
  var visibleSince = document.visibilityState === "visible" ? Date.now() : 0;
  var visibleFor = 0;
  var left = false;

  function send(report) {
    if (optedOut || !allowed) return;
    report.path = location.pathname;
    report.host = location.host;
    var body = JSON.stringify(report);
    try {
      if (nav.sendBeacon && nav.sendBeacon(url, body)) return;
    } catch (error) {}
    try {
      fetch(url, { method: "POST", body: body, keepalive: true, credentials: "omit", headers: { "content-type": "text/plain" } });
    } catch (error) {}
  }

  function start() {
    if (started || optedOut || !allowed) return;
    started = true;
    var query = new URLSearchParams(location.search);
    // The A/B test version the server chose for this page, if one runs here (one per page).
    var test = document.querySelector("template[data-lintel-test]");
    send({
      kind: "view",
      referrer: document.referrer || undefined,
      width: window.innerWidth,
      source: query.get("utm_source") || undefined,
      campaign: query.get("utm_campaign") || undefined,
      experiment: (test && test.getAttribute("data-lintel-test")) || undefined,
      version: (test && test.getAttribute("data-lintel-version")) || undefined,
    });
  }

  function leave() {
    if (left || !started) return;
    left = true;
    if (visibleSince) visibleFor += Date.now() - visibleSince;
    visibleSince = 0;
    if (visibleFor > 0) send({ kind: "leave", durationMs: visibleFor });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      visibleSince = Date.now();
    } else {
      if (visibleSince) visibleFor += Date.now() - visibleSince;
      visibleSince = 0;
      // Phones often close a tab without "pagehide", so hiding the page ends the visit.
      leave();
    }
  });
  window.addEventListener("pagehide", leave);
  window.addEventListener("pageshow", function (event) {
    // Coming back through the back button is a new visit to the page.
    if (event.persisted) {
      started = false;
      left = false;
      visibleFor = 0;
      visibleSince = Date.now();
      start();
    }
  });

  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      var link = target && target.closest ? target.closest("a[href]") : null;
      if (!link) return;
      var to;
      try {
        to = new URL(link.href, location.href);
      } catch (error) {
        return;
      }
      if ((to.protocol === "http:" || to.protocol === "https:") && to.host !== location.host) {
        send({ kind: "outbound", name: to.href });
      }
    },
    true,
  );

  function consentAllows(allowedServices) {
    return Array.isArray(allowedServices) && allowedServices.indexOf("plugin:analytics") !== -1;
  }

  window.lintelAnalytics = {
    track: function (name) {
      if (typeof name !== "string" || !name) return;
      send({ kind: "custom", name: name.slice(0, 60) });
      // Lets the page's other scripts know, such as an A/B test whose goal is this event.
      try {
        document.dispatchEvent(new CustomEvent("lintel:track", { detail: { name: name.slice(0, 60) } }));
      } catch (error) {}
    },
    consent: function () {
      allowed = true;
      start();
    },
  };

  if (!allowed) {
    var notice = window.lintelConsent;
    if (notice && typeof notice.allows === "function" && notice.allows("plugin:analytics")) {
      allowed = true;
    }
    document.addEventListener("lintel:consent", function (event) {
      if (event.detail && consentAllows(event.detail.allowed)) window.lintelAnalytics.consent();
    });
    // The notice's script may load after this one, with a choice made on an earlier visit.
    window.addEventListener("load", function () {
      var later = window.lintelConsent;
      if (later && typeof later.allows === "function" && later.allows("plugin:analytics")) {
        window.lintelAnalytics.consent();
      }
    });
  }
  start();
})();
`;
