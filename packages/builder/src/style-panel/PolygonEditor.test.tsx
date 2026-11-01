import type { ShapePoint } from "@lintel/builder-model";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { PolygonEditor } from "./PolygonEditor.js";

function Harness({ onPoints }: { onPoints: (points: ShapePoint[]) => void }) {
  const [points, setPoints] = useState<ShapePoint[]>([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]);
  return (
    <PolygonEditor
      label="Corners"
      points={points}
      onChange={(next) => {
        setPoints(next);
        onPoints(next);
      }}
    />
  );
}

function renderEditor() {
  let latest: ShapePoint[] = [];
  render(<Harness onPoints={(points) => (latest = points)} />);
  const area = screen.getByRole("group", { name: "Corners" });
  // jsdom has no layout: the editor is a 200 × 200 square at (10, 20).
  area.getBoundingClientRect = () =>
    ({ left: 10, top: 20, width: 200, height: 200, right: 210, bottom: 220 }) as DOMRect;
  return { points: () => latest };
}

describe("the polygon editor", () => {
  it("drags a corner to where the pointer is, in percent", () => {
    const { points } = renderEditor();
    const corner = screen.getByRole("button", { name: /Corner 2 of 4/ });
    corner.setPointerCapture = () => undefined;
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 210, clientY: 20 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 160, clientY: 70 });
    fireEvent.pointerUp(corner, { pointerId: 1 });
    expect(points()[1]).toEqual({ x: 75, y: 25 });
    // Off the edge stays on the edge.
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 160, clientY: 70 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 400, clientY: -50 });
    expect(points()[1]).toEqual({ x: 100, y: 0 });
  });

  it("moves, adds and removes corners from the keyboard", async () => {
    const person = userEvent.setup();
    const { points } = renderEditor();
    screen.getByRole("button", { name: /Corner 1 of 4/ }).focus();
    await person.keyboard("{ArrowRight}{ArrowRight}{Shift>}{ArrowDown}{/Shift}");
    expect(points()[0]).toEqual({ x: 2, y: 10 });
    expect(
      screen.getByRole("button", { name: /Corner 1 of 4: 2% across, 10% down/ }),
    ).toHaveFocus();

    await person.click(screen.getByRole("button", { name: "Add a corner" }));
    expect(points()).toHaveLength(5);
    expect(points()[1]).toEqual({ x: 51, y: 5 });

    screen.getByRole("button", { name: /Corner 2 of 5/ }).focus();
    await person.keyboard("{Delete}");
    expect(points()).toHaveLength(4);
    await person.click(screen.getByRole("button", { name: "Remove corner" }));
    expect(points()).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Remove corner" })).toBeDisabled();
  });
});
