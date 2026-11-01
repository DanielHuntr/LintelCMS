import { describe, expect, it } from "vitest";
import type { Revision } from "./content.types.js";
import { groupRevisionsByDay, revisionLabel } from "./revisionLabels.js";

function revision(changes: Partial<Revision>): Revision {
  return {
    id: "r1",
    kind: "edited",
    createdAt: "2026-11-02T14:00:00",
    updatedAt: "2026-11-02T14:05:00",
    restoredFromAt: null,
    author: { id: "u1", name: "Daniel" },
    ...changes,
  };
}

describe("History labels", () => {
  it("calls the newest edit the current draft, and older ones Edited", () => {
    expect(revisionLabel(revision({}), true)).toBe("Current draft");
    expect(revisionLabel(revision({}), false)).toBe("Edited");
    expect(revisionLabel(revision({ kind: "published" }), true)).toBe("Published");
    expect(revisionLabel(revision({ kind: "scheduled" }), false)).toBe("Scheduled");
  });

  it("says which version a restore brought back", () => {
    const restored = revision({ kind: "restored", restoredFromAt: "2026-11-02T14:05:00" });
    expect(revisionLabel(restored, false)).toBe("Restored from Nov 2, 2026, 2:05 PM");
  });

  it("groups by day as Today, Yesterday, then dates", () => {
    const now = new Date("2026-11-03T09:00:00").getTime();
    const days = groupRevisionsByDay(
      [
        revision({ id: "a", updatedAt: "2026-11-03T08:30:00" }),
        revision({ id: "b", updatedAt: "2026-11-03T08:00:00" }),
        revision({ id: "c", updatedAt: "2026-11-02T17:00:00" }),
        revision({ id: "d", updatedAt: "2026-10-28T10:00:00" }),
      ],
      now,
    );
    expect(days.map((day) => [day.label, day.revisions.map((item) => item.id)])).toEqual([
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
      ["Wed, Oct 28", ["d"]],
    ]);
  });
});
