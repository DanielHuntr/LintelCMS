import { defineBlock, definePlugin, number, text } from "@lintel/core/plugin";
import { DEFAULT_ZOOM } from "../shared/coordinates.js";
import { locationFieldtype, readLocation, renderCoordinates, renderMapLink } from "./location.js";
import { defaultMapWords, MAP_BLOCK_TEMPLATE, renderMap } from "./map-embed.js";
import { paletteFieldtype, renderCssVariables, renderSwatches } from "./palette.js";

/**
 * The server half of the Extra fields add-on: two kinds of field Lintel doesn't have on its
 * own (Map location and Colour palette), the Liquid filters and tag to show them, and a Map
 * element. Lintel already has Icon, Table and Colour fields, so this adds nothing for those.
 */
export default definePlugin({
  id: "extra-fields",
  name: "Extra fields",
  description: "Map locations and colour palettes for your content.",
  version: "0.1.0",

  fieldtypes: [locationFieldtype, paletteFieldtype],

  // Maps load from OpenStreetMap only after a visitor allows it, so the cookie notice asks.
  consentServices: [{ handle: "openstreetmap", name: "OpenStreetMap" }],

  // For Liquid templates:
  //   {{ entry.data.place | extra_fields_map_link }}       a link to the place on OpenStreetMap
  //   {{ entry.data.place | extra_fields_coordinates }}    "51.5072° N, 0.1276° W"
  //   {% extra_fields_map entry.data.place zoom: 16 %}     a map that asks before loading
  //   {{ entry.data.brand | extra_fields_swatches }}       the colours as named chips
  //   {{ entry.data.brand | extra_fields_css_variables }}  "--palette-forest: #1a7f5a; ..."
  liquid: {
    tags: [
      {
        name: "extra_fields_map",
        render: ({ value, options }) => {
          const location = readLocation(value);
          if (!location) return "";
          const zoom =
            typeof options.zoom === "number" && options.zoom >= 1 && options.zoom <= 19
              ? Math.round(options.zoom)
              : (location.zoom ?? DEFAULT_ZOOM);
          return renderMap(location, zoom, {
            showMap: wordOption(options.show_label, defaultMapWords.showMap),
            note: wordOption(options.note, defaultMapWords.note),
            openLink: wordOption(options.link_label, defaultMapWords.openLink),
          });
        },
      },
    ],
    filters: [
      { name: "extra_fields_map_link", html: true, apply: renderMapLink },
      { name: "extra_fields_coordinates", apply: renderCoordinates },
      { name: "extra_fields_swatches", html: true, apply: renderSwatches },
      // Only slugs, "#rrggbb" codes and punctuation, so it is safe as it is.
      { name: "extra_fields_css_variables", html: true, apply: renderCssVariables },
    ],
  },

  blocks: [
    defineBlock({
      handle: "extra_fields_map",
      name: "Map",
      icon: "map-pin",
      category: "Extra fields",
      description: "A place on a map, shown once a visitor allows OpenStreetMap.",
      properties: {
        label: text({ label: "Name of the place", maxLength: 120 }),
        address: text({ label: "Address", maxLength: 300 }),
        latitude: number({ required: true, min: -90, max: 90, helpText: "Such as 51.5072" }),
        longitude: number({ required: true, min: -180, max: 180, helpText: "Such as -0.1276" }),
        zoom: number({
          min: 1,
          max: 19,
          step: 1,
          default: DEFAULT_ZOOM,
          helpText: "1 shows the world, 19 a single building.",
        }),
      },
      render: MAP_BLOCK_TEMPLATE,
    }),
  ],
});

function wordOption(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}
