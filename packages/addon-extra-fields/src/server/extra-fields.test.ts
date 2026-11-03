import { type PluginTestServer, startPluginTestServer } from "@lintel/core/plugin-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import addon from "./index.js";
import { OPEN_STREET_MAP_CONSENT } from "./map-embed.js";

type SignedInRequest = Awaited<ReturnType<PluginTestServer["signInWith"]>>;

const place = {
  latitude: 51.507221,
  longitude: -0.127551,
  label: "The Corner Bakery",
  address: "1 Flour Street, London",
};

/** The Extra fields add-on on a real Lintel: its fields saved, checked and delivered. */
describe("the Extra fields add-on", () => {
  let lintel: PluginTestServer;
  let asOwner: SignedInRequest;

  beforeAll(async () => {
    lintel = await startPluginTestServer({ plugins: [addon] });
    asOwner = await lintel.signInWith(["*"]);
    const blueprint = await asOwner({
      method: "POST",
      url: "/blueprints",
      payload: {
        handle: "shop",
        name: "Shop",
        fields: [
          { handle: "title", label: "Title", type: "text", required: true },
          { handle: "place", label: "Where", type: "extra-fields.location", options: { zoom: 17 } },
          {
            handle: "brand",
            label: "Brand colours",
            type: "extra-fields.palette",
            options: { maxColours: 3 },
          },
        ],
      },
    });
    expect(blueprint.statusCode, blueprint.body).toBe(201);
    const collection = await asOwner({
      method: "POST",
      url: "/collections",
      payload: { handle: "shops", name: "Shops", blueprintHandle: "shop", structure: "flat" },
    });
    expect(collection.statusCode, collection.body).toBe(201);
  });

  afterAll(() => lintel.close());

  beforeEach(() => lintel.setEnabledPlugins(["extra-fields"]));

  async function saveShop(data: Record<string, unknown>) {
    return asOwner({ method: "POST", url: "/collections/shops/entries", payload: { data } });
  }

  it("offers both fields in the list of fieldtypes", async () => {
    const response = await asOwner({ method: "GET", url: "/fieldtypes" });
    const types = (response.json() as { fieldtypes: Array<{ type: string }> }).fieldtypes.map(
      (fieldtype) => fieldtype.type,
    );
    expect(types).toEqual(
      expect.arrayContaining(["extra-fields.location", "extra-fields.palette"]),
    );
  });

  it("keeps a place and a palette, and delivers them ready to show", async () => {
    const saved = await saveShop({
      title: "Corner",
      place,
      brand: [["Forest", "#1A7F5A"], { name: "Butter", hex: "f2c14e" }],
    });
    expect(saved.statusCode, saved.body).toBe(201);
    const entry = saved.json() as { id: string; slug: string; data: Record<string, unknown> };
    expect(entry.data.place).toEqual({ ...place, latitude: 51.50722, longitude: -0.12755 });
    expect(entry.data.brand).toEqual([
      ["Forest", "#1a7f5a"],
      ["Butter", "#f2c14e"],
    ]);

    await asOwner({ method: "POST", url: `/entries/${entry.id}/publish` });
    const delivered = await lintel.server.inject({
      method: "GET",
      url: `/delivery/shops/${entry.slug}`,
    });
    expect(delivered.statusCode, delivered.body).toBe(200);
    const data = (delivered.json() as { data: Record<string, unknown> }).data;
    expect(data.place).toEqual({
      latitude: 51.50722,
      longitude: -0.12755,
      label: "The Corner Bakery",
      address: "1 Flour Street, London",
      coordinates: "51.5072° N, 0.1275° W",
      zoom: 17,
      openStreetMapUrl:
        "https://www.openstreetmap.org/?mlat=51.50722&mlon=-0.12755#map=17/51.50722/-0.12755",
    });
    expect(data.brand).toEqual([
      { name: "Forest", hex: "#1a7f5a", slug: "forest", textColour: "#ffffff" },
      { name: "Butter", hex: "#f2c14e", slug: "butter", textColour: "#000000" },
    ]);
  });

  it("explains places that aren't on the Earth and palettes that break the field's rules", async () => {
    const response = await saveShop({
      title: "Nowhere",
      place: { latitude: 120, longitude: 0 },
      brand: [
        ["Red", "#ff0000"],
        ["Green", "#00ff00"],
        ["Blue", "#0000ff"],
        ["Black", "#000000"],
      ],
    });
    expect(response.statusCode).toBe(400);
    const { fields } = response.json() as { fields: Record<string, string> };
    expect(fields.place).toContain("latitude should be between -90 and 90");
    expect(fields.brand).toBe("Brand colours can have at most 3 colours");

    const unnamed = await saveShop({ title: "Unnamed", brand: [["", "nope"]] });
    expect(unnamed.statusCode).toBe(400);
    expect((unnamed.json() as { fields: Record<string, string> }).fields.brand).toContain(
      "Give every colour in Brand colours a name",
    );
  });

  it("links to a place and writes its coordinates in templates", async () => {
    const html = await lintel.renderLiquid(
      "{{ place | extra_fields_map_link }}|{{ place | extra_fields_coordinates }}",
      { place: { ...place, label: 'Tea & "cake"' } },
    );
    expect(html).toBe(
      '<a class="extra-fields-map-link" href="https://www.openstreetmap.org/?mlat=51.50722&amp;mlon=-0.12755#map=15/51.50722/-0.12755" rel="noopener" target="_blank">Tea &amp; &quot;cake&quot;</a>|51.5072° N, 0.1276° W',
    );
  });

  it("draws a map that loads nothing from OpenStreetMap until it is allowed", async () => {
    const html = await lintel.renderLiquid(
      '{% extra_fields_map place zoom: 12 show_label: "Kaart tonen" %}',
      {
        place,
      },
    );
    expect(html).toContain('data-extra-fields-map data-latitude="51.50722"');
    expect(html).toContain('data-zoom="12"');
    expect(html).toContain(">Kaart tonen</button>");
    expect(html).toContain("1 Flour Street, London");
    // The embed's address is only made by the script, once allowed or asked for.
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain('src="https://www.openstreetmap.org');
    expect(html).toContain(JSON.stringify(OPEN_STREET_MAP_CONSENT));
    expect(html).toContain("lintel:consent");
    expect(await lintel.renderLiquid("{% extra_fields_map empty %}", { empty: null })).toBe("");
  });

  it("draws a palette as named chips and as CSS variables", async () => {
    const brand = [
      ["Forest green", "#1a7f5a"],
      ["Butter", "#f2c14e"],
      ["Butter", "#fff1b8"],
      ["<b>Bold</b>", "#000000"],
    ];
    const chips = await lintel.renderLiquid("{{ brand | extra_fields_swatches }}", { brand });
    expect(chips).toContain('<ul class="extra-fields-swatches" role="list"');
    expect(chips).toContain("background:#1a7f5a;color:#ffffff");
    expect(chips).toContain("&lt;b&gt;Bold&lt;/b&gt;");
    expect(chips).not.toContain("<b>");

    const variables = await lintel.renderLiquid(
      '{{ brand | extra_fields_css_variables: "brand" }}',
      {
        brand,
      },
    );
    expect(variables).toBe(
      "--brand-forest-green: #1a7f5a; --brand-butter: #f2c14e; --brand-butter-2: #fff1b8; --brand-b-bold-b: #000000;",
    );
  });

  it("asks visitors about OpenStreetMap while it is on", async () => {
    const plugins = await asOwner({ method: "GET", url: "/plugins" });
    expect(plugins.statusCode).toBe(200);
    expect(addon.consentServices).toEqual([{ handle: "openstreetmap", name: "OpenStreetMap" }]);
    const notice = await asOwner({ method: "GET", url: "/website/cookie-notice" });
    expect(notice.statusCode, notice.body).toBe(200);
    expect((notice.json() as { services: unknown[] }).services).toContainEqual({
      id: OPEN_STREET_MAP_CONSENT,
      name: "OpenStreetMap",
    });

    await lintel.setEnabledPlugins([]);
    const whileOff = await asOwner({ method: "GET", url: "/website/cookie-notice" });
    expect((whileOff.json() as { services: unknown[] }).services).not.toContainEqual(
      expect.objectContaining({ id: OPEN_STREET_MAP_CONSENT }),
    );
  });

  it("offers a Map element for the builder", () => {
    const block = addon.blocks?.[0];
    expect(block?.handle).toBe("extra_fields_map");
    expect(typeof block?.render === "string" && block.render).toContain("{{latitude}}");
  });
});
