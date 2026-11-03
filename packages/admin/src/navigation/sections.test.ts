import { describe, expect, it } from "vitest";
import { CalendarDays } from "lucide-react";
import { defineAdminPlugin } from "../plugins/adminPlugin.js";
import { sections, visibleSections } from "./sections.js";

const allPlugins = ["blog", "commerce", "forms", "automations", "seo"];

function labelsFor(permissions: string[], enabledPlugins: string[]) {
  return visibleSections(permissions, enabledPlugins).map((section) => section.label);
}

describe("visibleSections", () => {
  it("shows a client editor only the sections they work in", () => {
    const editor = ["entries:*", "media:*"];

    expect(labelsFor(editor, allPlugins)).toEqual(["Dashboard", "Content", "Media", "Help"]);
  });

  it("shows a super admin every section when every plugin is on", () => {
    // Lintel's own sections, and the Forms plugin's.
    expect(visibleSections(["*"], allPlugins)).toHaveLength(sections.length + 1);
  });

  it("hides Shop and Forms on a blog", () => {
    expect(labelsFor(["*"], ["blog", "seo"])).toEqual([
      "Dashboard",
      "Content",
      "Design",
      "Media",
      "Users",
      "Settings",
      "Build",
      "Help",
    ]);
  });

  it("shows each plugin's section only once it is switched on", () => {
    expect(labelsFor(["*"], ["commerce"])).toContain("Shop");
    expect(labelsFor(["*"], ["commerce"])).not.toContain("Forms");
    expect(labelsFor(["*"], ["forms"])).toContain("Forms");
  });

  // Build is for whoever built the site: seeing settings or fields isn't enough.
  it("shows Build only to people who can change the site's structure", () => {
    expect(labelsFor(["settings:read", "blueprints:read", "entries:*"], allPlugins)).not.toContain(
      "Build",
    );
    expect(labelsFor(["blueprints:update"], allPlugins)).toContain("Build");
    expect(labelsFor(["content:transfer"], allPlugins)).toContain("Build");
  });

  it("still needs permission for a plugin's section", () => {
    expect(labelsFor(["entries:*"], allPlugins)).not.toContain("Shop");
  });
});

describe("sidebar items from plugins", () => {
  const bookings = defineAdminPlugin({
    id: "bookings",
    sidebarItems: [
      { path: "/bookings", label: "Bookings", icon: CalendarDays, permission: "bookings:read" },
    ],
  });

  it("come after Media, only while the plugin is on and only for people allowed", () => {
    const labels = (permissions: string[], enabled: string[]) =>
      visibleSections(permissions, enabled, [bookings]).map((section) => section.label);

    expect(labels(["*"], ["bookings"])).toEqual([
      "Dashboard",
      "Content",
      "Design",
      "Media",
      "Bookings",
      "Users",
      "Settings",
      "Build",
      "Help",
    ]);
    expect(labels(["*"], [])).not.toContain("Bookings");
    expect(labels(["media:read"], ["bookings"])).not.toContain("Bookings");
  });
});
