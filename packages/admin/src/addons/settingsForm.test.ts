import { describe, expect, it } from "vitest";
import { labelFromKey, readSettingsForm } from "./settingsForm.js";

describe("an add-on's settings form", () => {
  it("is read from simple settings: text, numbers, on/off and a choice", () => {
    const fields = readSettingsForm({
      type: "object",
      properties: {
        greeting: { type: "string", maxLength: 40 },
        defaultDurationMinutes: { type: "integer", minimum: 5, maximum: 480 },
        show_closed: { type: "boolean" },
        week_starts: { type: "string", enum: ["monday", "sunday"] },
      },
    });
    expect(fields).toEqual([
      { kind: "text", key: "greeting", label: "Greeting", maxLength: 40 },
      {
        kind: "number",
        key: "defaultDurationMinutes",
        label: "Default duration minutes",
        minimum: 5,
        maximum: 480,
        whole: true,
      },
      { kind: "toggle", key: "show_closed", label: "Show closed" },
      { kind: "choice", key: "week_starts", label: "Week starts", options: ["monday", "sunday"] },
    ]);
  });

  it("isn't drawn for settings too involved for one", () => {
    expect(
      readSettingsForm({ type: "object", properties: { days: { type: "array", items: {} } } }),
    ).toBeNull();
    expect(readSettingsForm(null)).toBeNull();
    expect(readSettingsForm({ type: "object", properties: {} })).toBeNull();
  });

  it("names fields from their keys", () => {
    expect(labelFromKey("openOnSundays")).toBe("Open on sundays");
  });
});
