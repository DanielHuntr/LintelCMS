import { Search, Settings } from "lucide-react";
import { describe, expect, it } from "vitest";
import { arrangeSettings, searchSettings, type SettingsGroup } from "./settingsGroups.js";

const row = (key: string, label: string, description = "") => ({
  key,
  icon: Settings,
  label,
  description,
  to: `/settings/${key}`,
});

const groups: SettingsGroup[] = [
  { header: "Site", entries: [row("site", "Your website", "Template, colours and logo")] },
  { header: "Developers", entries: [row("api", "API access", "Tokens for apps")] },
  { header: "Empty", entries: [] },
];

describe("arranging Settings", () => {
  // "Search engines" was a group header over a single row of the same name.
  it("puts a plugin's lone row in the first group, and keeps a bigger plugin group", () => {
    const arranged = arrangeSettings(groups, [
      { ...row("seo", "Search engines"), icon: Search, group: "Search engines" },
      { ...row("bookings", "Bookings"), group: "Bookings" },
      { ...row("services", "Services"), group: "Bookings" },
    ]);

    expect(arranged.map((group) => group.header)).toEqual(["Site", "Bookings", "Developers"]);
    expect(arranged[0]?.entries.map((entry) => entry.key)).toEqual(["site", "seo"]);
  });

  it("finds rows by any words in their name, description or group", () => {
    expect(searchSettings(groups, "logo").map((group) => group.header)).toEqual(["Site"]);
    expect(searchSettings(groups, "developers tokens")[0]?.entries[0]?.key).toBe("api");
    expect(searchSettings(groups, "nothing like this")).toEqual([]);
  });
});
