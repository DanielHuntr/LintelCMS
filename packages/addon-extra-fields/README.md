# Extra fields: map locations and colour palettes

A first-party Lintel add-on with two kinds of field Lintel doesn't have on its own. Lintel
already has Icon, Table and Colour (with suggested colours) fields, so this adds nothing for
those. Switch it on in Build → Add-ons, then pick the fields in a content type's "Add a field".

| Field              | Editors get                                                                    | Stored                                    | Websites get                                                                            |
| ------------------ | ------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| **Map location**   | Paste a map link (OpenStreetMap, Google or Apple Maps) or type the coordinates | `{ latitude, longitude, label, address }` | The same, plus `coordinates` ("51.5072° N, 0.1276° W"), `zoom` and `openStreetMapUrl`   |
| **Colour palette** | Named colours in order: add, rename, move up and down, remove                  | Rows of `[name, "#rrggbb"]`               | `[{ name, hex, slug, textColour }]`, `textColour` being black or white by WCAG contrast |

Options (set in a content model file or through the API; the admin uses the defaults):

- Map location: `zoom`, 1 (the world) to 19 (a building), 15 by default.
- Colour palette: `maxColours` (12 by default, at most 24) and `choices`, a fixed list of
  `{ name, hex }` editors pick from instead of any colour, such as the brand's own.

The API also accepts palette colours as `{ name, hex }` and short codes such as `"abc"`; they
are stored as rows with six-digit lowercase codes.

## In templates and the builder

```liquid
{{ entry.data.place | extra_fields_map_link }}          a link to the place on OpenStreetMap
{{ entry.data.place | extra_fields_map_link: "Find us" }}
{{ entry.data.place | extra_fields_coordinates }}       51.5072° N, 0.1276° W
{% extra_fields_map entry.data.place zoom: 16 %}        a map that asks first (see below)
{{ entry.data.brand | extra_fields_swatches }}          the colours as named chips
<style>:root { {{ entry.data.brand | extra_fields_css_variables: "brand" }} }</style>
                                                        --brand-forest: #1a7f5a; ...
```

`{% extra_fields_map %}` takes `show_label`, `note` and `link_label` for its words in another
language. The builder gets a **Map** element (Insert → Extra fields) with a name, address,
latitude, longitude and zoom, which works the same way.

## Privacy

Nothing here loads anything from another company by default.

- In the admin the location's preview is a card with the coordinates and a link. The map
  itself loads from OpenStreetMap only when the editor presses "Show map preview".
- On the website the map shows the place's name, address, a "Show map" button and a link.
  OpenStreetMap's map loads only once the visitor allows "OpenStreetMap" in the cookie notice
  (`plugin:extra-fields:openstreetmap`, declared with `consentServices`, so the notice names
  it while the add-on is on) or presses "Show map". Its frame sends no referrer.

## Building and testing

```bash
pnpm --filter @lintel/addon-extra-fields build   # dist/server.js and dist/admin.js
pnpm --filter @lintel/addon-extra-fields test
```

`src/server/extra-fields.test.ts` runs on a real Lintel with a database in memory
(`@lintel/core/plugin-testing`); `src/shared/shared.test.ts` covers reading map links,
writing coordinates and colour contrast.

## Files

| File                              | What it does                                                    |
| --------------------------------- | --------------------------------------------------------------- |
| `src/server/index.ts`             | The server half: `definePlugin`                                 |
| `src/server/location.ts`          | The Map location field, its delivery and its Liquid filters     |
| `src/server/map-embed.ts`         | The map that asks before loading, for the tag and the element   |
| `src/server/palette.ts`           | The Colour palette field, its delivery and its Liquid filters   |
| `src/server/extra-fields.test.ts` | Tests on a real Lintel                                          |
| `src/shared/coordinates.ts`       | Coordinates: checks, writing them out, OpenStreetMap, map links |
| `src/shared/colours.ts`           | Colour codes, WCAG contrast and slugs                           |
| `src/shared/shared.test.ts`       | Tests for both                                                  |
| `src/admin/index.tsx`             | The admin half: `defineAdminPlugin`                             |
| `src/admin/LocationEditor.tsx`    | The Map location field's editor                                 |
| `src/admin/PaletteEditor.tsx`     | The Colour palette field's editor                               |
| `src/admin/strings.ts`            | Its words                                                       |
