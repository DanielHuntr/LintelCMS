import { describe, expect, it } from "vitest";
import {
  addWidget,
  defaultLayout,
  moveWidget,
  removeWidget,
  resizeWidget,
  splitLayout,
  type PlaceableWidget,
} from "./dashboardLayout.js";

const welcome: PlaceableWidget = {
  fullId: "core:welcome",
  defaultSize: "large",
  onDefaultDashboard: true,
};
const recent: PlaceableWidget = {
  fullId: "core:recent-edits",
  defaultSize: "medium",
  onDefaultDashboard: true,
};
const media: PlaceableWidget = {
  fullId: "core:media-usage",
  defaultSize: "small",
  onDefaultDashboard: false,
};

const layout = [
  { widget: "core:welcome", size: "large" as const },
  { widget: "core:recent-edits", size: "medium" as const },
  { widget: "bookings:today", size: "small" as const },
];

describe("dashboard layouts", () => {
  it("start from every widget marked for the default dashboard, at its own size", () => {
    expect(defaultLayout([welcome, recent, media])).toEqual([
      { widget: "core:welcome", size: "large" },
      { widget: "core:recent-edits", size: "medium" },
    ]);
  });

  it("keep widgets the person can't see right now apart, so saving doesn't lose them", () => {
    expect(splitLayout(layout, [welcome, recent])).toEqual({
      visible: layout.slice(0, 2),
      hidden: [layout[2]],
    });
  });

  it("move, resize, remove and add widgets", () => {
    expect(moveWidget(layout, "bookings:today", 0).map(({ widget }) => widget)).toEqual([
      "bookings:today",
      "core:welcome",
      "core:recent-edits",
    ]);
    expect(moveWidget(layout, "core:welcome", 5)).toEqual(layout);
    expect(resizeWidget(layout, "core:welcome", "small")[0]).toEqual({
      widget: "core:welcome",
      size: "small",
    });
    expect(removeWidget(layout, "core:welcome")).toHaveLength(2);
    expect(addWidget(layout, media).at(-1)).toEqual({ widget: "core:media-usage", size: "small" });
    expect(addWidget(layout, welcome)).toEqual(layout);
  });
});
