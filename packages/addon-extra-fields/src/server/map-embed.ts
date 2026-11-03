import { escapeHtml } from "@lintel/core/plugin";
import {
  DEFAULT_ZOOM,
  formatCoordinates,
  openStreetMapUrl,
  roundCoordinate,
} from "../shared/coordinates.js";
import type { StoredLocation } from "./location.js";

/**
 * A map of one place on a published page, which asks before loading anything from
 * OpenStreetMap. Until the visitor allows OpenStreetMap in the cookie notice, or presses
 * "Show map", the page shows the place's name, address and a link instead, and nothing is
 * fetched from another company. Used by `{% extra_fields_map %}` and the Map element.
 */

/** The cookie notice's id for OpenStreetMap while this add-on is on. */
export const OPEN_STREET_MAP_CONSENT = "plugin:extra-fields:openstreetmap";

/**
 * Finds every map on the page once, and loads each when allowed. Written as plain ES5 and
 * free of double braces, so it can sit inside a block template.
 */
const MAP_SCRIPT = `<script>
(function () {
  if (window.lintelExtraFieldsMaps) return;
  window.lintelExtraFieldsMaps = true;
  var consentId = ${JSON.stringify(OPEN_STREET_MAP_CONSENT)};
  function embedUrl(latitude, longitude, zoom) {
    var width = (360 / Math.pow(2, zoom)) * 2;
    var height = width * 0.6;
    var round = function (value) { return Number(value.toFixed(5)); };
    var box = [round(longitude - width / 2), round(latitude - height / 2), round(longitude + width / 2), round(latitude + height / 2)].join(",");
    return "https://www.openstreetmap.org/export/embed.html?bbox=" + encodeURIComponent(box) + "&layer=mapnik&marker=" + encodeURIComponent(round(latitude) + "," + round(longitude));
  }
  function load(map) {
    if (map.getAttribute("data-loaded")) return;
    var latitude = Number(map.getAttribute("data-latitude"));
    var longitude = Number(map.getAttribute("data-longitude"));
    var zoom = Number(map.getAttribute("data-zoom")) || ${DEFAULT_ZOOM};
    if (!isFinite(latitude) || !isFinite(longitude)) return;
    map.setAttribute("data-loaded", "true");
    var frame = document.createElement("iframe");
    frame.src = embedUrl(latitude, longitude, zoom);
    frame.title = map.getAttribute("data-title") || "Map";
    frame.loading = "lazy";
    frame.referrerPolicy = "no-referrer";
    frame.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0";
    var placeholder = map.querySelector("[data-map-placeholder]");
    if (placeholder) placeholder.hidden = true;
    map.querySelector("[data-map-frame]").appendChild(frame);
  }
  function maps() { return document.querySelectorAll("[data-extra-fields-map]"); }
  function allowed() {
    var notice = window.lintelConsent;
    return !!(notice && typeof notice.allows === "function" && notice.allows(consentId));
  }
  function setUp() {
    var all = maps();
    for (var index = 0; index < all.length; index++) {
      (function (map) {
        var button = map.querySelector("[data-map-show]");
        if (button) button.addEventListener("click", function () { load(map); });
        if (allowed()) load(map);
      })(all[index]);
    }
  }
  document.addEventListener("lintel:consent", function (event) {
    var list = event.detail && event.detail.allowed;
    if (!list || list.indexOf(consentId) === -1) return;
    var all = maps();
    for (var index = 0; index < all.length; index++) load(all[index]);
  });
  window.addEventListener("load", function () {
    if (!allowed()) return;
    var all = maps();
    for (var index = 0; index < all.length; index++) load(all[index]);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setUp);
  else setUp();
})();
</script>`;

const FIGURE_STYLE = "margin:0;display:flex;flex-direction:column;gap:0.5em";
const FRAME_STYLE =
  "position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:rgb(127 127 127 / 0.12)";
const PLACEHOLDER_STYLE =
  "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.6em;padding:1em;text-align:center";
const BUTTON_STYLE =
  "font:inherit;padding:0.5em 1.1em;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer";
const NOTE_STYLE = "margin:0;font-size:0.85em;opacity:0.75";

/** The words a map shows; a template can pass its own, in its own language. */
export interface MapWords {
  showMap: string;
  note: string;
  openLink: string;
}

export const defaultMapWords: MapWords = {
  showMap: "Show map",
  note: "The map comes from OpenStreetMap.",
  openLink: "Open in OpenStreetMap",
};

/** The map for `{% extra_fields_map place %}`, drawn on the server from a stored location. */
export function renderMap(location: StoredLocation, zoom: number, words = defaultMapWords) {
  const title = location.label || formatCoordinates(location);
  const caption = [
    location.label ? `<strong>${escapeHtml(location.label)}</strong>` : "",
    location.address ? `<span>${escapeHtml(location.address)}</span>` : "",
  ]
    .filter(Boolean)
    .join("<br>");
  return (
    `<figure class="extra-fields-map" data-extra-fields-map data-latitude="${roundCoordinate(location.latitude)}" data-longitude="${roundCoordinate(location.longitude)}" data-zoom="${zoom}" data-title="${escapeHtml(`Map of ${title}`)}" style="${FIGURE_STYLE}">` +
    `<div data-map-frame style="${FRAME_STYLE}">` +
    `<div data-map-placeholder style="${PLACEHOLDER_STYLE}">` +
    `<button type="button" data-map-show style="${BUTTON_STYLE}">${escapeHtml(words.showMap)}</button>` +
    `<p style="${NOTE_STYLE}">${escapeHtml(words.note)}</p>` +
    `</div></div>` +
    `<figcaption>${caption ? `${caption}<br>` : ""}<a href="${escapeHtml(openStreetMapUrl(location, zoom))}" rel="noopener" target="_blank">${escapeHtml(words.openLink)}</a></figcaption>` +
    `</figure>` +
    MAP_SCRIPT
  );
}

/**
 * The Map element's template: the same map, with the element's properties in its slots
 * (each value escaped by the builder). See block-template.ts in @lintel/builder-model.
 */
export const MAP_BLOCK_TEMPLATE =
  `<figure class="extra-fields-map" data-extra-fields-map data-latitude="{{latitude}}" data-longitude="{{longitude}}" data-zoom="{{zoom}}" data-title="Map of {{label}}" style="${FIGURE_STYLE}">` +
  `<div data-map-frame style="${FRAME_STYLE}">` +
  `<div data-map-placeholder style="${PLACEHOLDER_STYLE}">` +
  `<button type="button" data-map-show style="${BUTTON_STYLE}">${defaultMapWords.showMap}</button>` +
  `<p style="${NOTE_STYLE}">${defaultMapWords.note}</p>` +
  `</div></div>` +
  `<figcaption>{{#label}}<strong>{{label}}</strong><br>{{/label}}{{#address}}<span>{{address}}</span><br>{{/address}}` +
  `<a href="https://www.openstreetmap.org/?mlat={{latitude}}&amp;mlon={{longitude}}#map={{zoom}}/{{latitude}}/{{longitude}}" rel="noopener" target="_blank">${defaultMapWords.openLink}</a></figcaption>` +
  `</figure>` +
  MAP_SCRIPT;
