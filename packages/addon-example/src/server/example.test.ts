import { type PluginTestServer, startPluginTestServer } from "@lintel/core/plugin-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import addon from "./index.js";
import { dayOf, describeToday, renderOpeningHoursTable } from "./opening-hours.js";
import { describeSwatch } from "./swatches.js";

/** The example add-on on a real Lintel: each of its parts, as a site would use them. */
describe("the example add-on", () => {
  let lintel: PluginTestServer;
  let asOwner: Awaited<ReturnType<PluginTestServer["signInWith"]>>;

  beforeAll(async () => {
    lintel = await startPluginTestServer({ plugins: [addon] });
    asOwner = await lintel.signInWith(["*"]);
  });

  afterAll(() => lintel.close());

  beforeEach(async () => {
    await lintel.setEnabledPlugins(["example"]);
    await asOwner({
      method: "PUT",
      url: "/plugins/example/settings",
      payload: {
        monday: "9:00–17:00",
        tuesday: "9:00–17:00",
        wednesday: "9:00–17:00",
        thursday: "9:00–17:00",
        friday: "9:00–17:00",
        saturday: "10:00–14:00",
        sunday: "",
        note: "Closed on bank holidays",
      },
    });
  });

  it("shows the opening hours in a template, with today marked", async () => {
    const html = await lintel.renderLiquid("{% example_opening_hours %}");
    expect(html).toContain('<th scope="row">Saturday</th><td>10:00–14:00</td>');
    expect(html).toContain('<th scope="row">Sunday</th><td>Closed</td>');
    expect(html).toContain('aria-current="date"');
    expect(html).toContain("Closed on bank holidays");
  });

  it("says whether it's open today", async () => {
    const text = describeToday(
      { ...(await asOwner({ method: "GET", url: "/plugins/example/settings" })).json() },
      dayOf(new Date()),
      "Open",
    );
    expect(await lintel.renderLiquid('{% example_open_today label: "Open" %}')).toBe(
      `<span class="example-open-today">${text}</span>`,
    );
  });

  it("names colours and draws a chip of one in templates", async () => {
    expect(await lintel.renderLiquid('{{ "#1e8c46" | example_colour_name }}')).toBe("Green");
    expect(await lintel.renderLiquid('{{ "#1e8c46" | example_swatch }}')).toBe(
      '<span class="example-swatch" style="background:#1e8c46;color:#ffffff">Green</span>',
    );
  });

  it("offers the Colour swatch field, checked against its palette", async () => {
    const fieldtypes = (await asOwner({ method: "GET", url: "/fieldtypes" })).json().fieldtypes;
    expect(fieldtypes.map((fieldtype: { type: string }) => fieldtype.type)).toContain(
      "example.swatch",
    );

    const [swatch] = addon.fieldtypes ?? [];
    const schema = swatch?.buildValueSchema({ palette: ["#1e8c46", "#ffffff"] }, "Colour");
    expect(schema?.safeParse("#1E8C46").success).toBe(true);
    expect(schema?.safeParse("#123456").error?.issues[0]?.message).toBe(
      "Colour should be one of the palette's colours",
    );
    expect(swatch?.deliver?.("#1e8c46", { palette: [] })).toEqual(describeSwatch("#1e8c46"));
  });

  it("offers the Colour swatch element in the builder, drawn with its values", async () => {
    const blocks = (await asOwner({ method: "GET", url: "/blocks" })).json().blocks;
    expect(blocks.map((block: { handle: string }) => block.handle)).toContain(
      "example_swatch_card",
    );
  });

  it("prints the week with its command", async () => {
    const { exitCode, output } = await lintel.runCommand("example:hours");
    expect(exitCode).toBe(0);
    expect(output[0]).toBe("Monday     9:00–17:00");
    expect(output[6]).toBe("Sunday     Closed");
    expect(output[7]).toBe("Closed on bank holidays");
  });

  it("keeps its settings within limits", async () => {
    const response = await asOwner({
      method: "PUT",
      url: "/plugins/example/settings",
      payload: { ...addon.settings?.defaults, monday: "x".repeat(61) },
    });
    expect(response.statusCode).toBe(400);
  });

  it("draws nothing in templates while it is switched off", async () => {
    await lintel.setEnabledPlugins([]);
    expect(await lintel.renderLiquid("[{% example_opening_hours %}]")).toBe("[]");
  });
});

describe("opening hours", () => {
  it("count the week from Monday", () => {
    expect(dayOf(new Date(2026, 10, 2))).toBe("monday");
    expect(dayOf(new Date(2026, 10, 8))).toBe("sunday");
  });

  it("escape what people type", () => {
    const html = renderOpeningHoursTable(
      {
        monday: "<b>9</b>",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
        saturday: "",
        sunday: "",
        note: "",
      },
      "monday",
    );
    expect(html).toContain("&lt;b&gt;9&lt;/b&gt;");
  });
});
