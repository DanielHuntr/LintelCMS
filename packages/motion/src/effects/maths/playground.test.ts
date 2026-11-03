import { describe, expect, it } from "vitest";
import {
  capThrow,
  createBody,
  fastestThrow,
  playgroundFeels,
  type PlaygroundWorld,
  separate,
  stepWorld,
} from "./playground.js";

const world = (feel: keyof typeof playgroundFeels, bodies = [createBody(10, 10, 50, 50)]) =>
  ({ width: 400, height: 300, ...playgroundFeels[feel]!, bodies }) satisfies PlaygroundWorld;

/** Steps until everything settles (or two simulated seconds pass); returns the steps taken. */
function settle(playground: PlaygroundWorld, seconds = 2): number {
  let steps = 0;
  let quiet = 0;
  while (steps < seconds * 60 && quiet < 20) {
    quiet = stepWorld(playground, 1 / 60) ? 0 : quiet + 1;
    steps += 1;
  }
  return steps;
}

describe("the playground's physics", () => {
  it("lets things fall to the floor and rest there when they fall", () => {
    const playground = world("fall");
    settle(playground);
    const body = playground.bodies[0]!;
    expect(body.top).toBeCloseTo(250, 0);
    expect(Math.abs(body.velocityY)).toBeLessThan(30);
  });

  it("leaves things where they are when they float, until thrown", () => {
    const playground = world("drift");
    expect(stepWorld(playground, 1 / 60)).toBe(false);
    expect(playground.bodies[0]!.top).toBe(10);
    playground.bodies[0]!.velocityX = 800;
    settle(playground);
    // Thrown right: it slows down in the air and stays inside the walls.
    expect(playground.bodies[0]!.left).toBeGreaterThan(100);
    expect(playground.bodies[0]!.left).toBeLessThanOrEqual(350);
  });

  it("bounces off the walls, keeping some of its speed", () => {
    const playground = world("drift", [createBody(340, 10, 50, 50)]);
    playground.bodies[0]!.velocityX = 1200;
    stepWorld(playground, 1 / 30);
    expect(playground.bodies[0]!.left).toBe(350);
    expect(playground.bodies[0]!.velocityX).toBeLessThan(0);
  });

  it("pushes overlapping things apart, the lighter one moving further", () => {
    const small = createBody(0, 0, 20, 20);
    const big = createBody(10, 0, 100, 100);
    const playground = world("drift", [small, big]);
    expect(separate(playground, small, big)).toBe(true);
    expect(small.left + small.width).toBeCloseTo(big.left, 5);
    expect(Math.abs(small.left)).toBeGreaterThan(Math.abs(big.left - 10));
  });

  it("never moves a held or pinned body, which pushes the others instead", () => {
    const held = { ...createBody(0, 0, 50, 50), held: true };
    const loose = createBody(30, 0, 50, 50);
    const playground = world("fall", [held, loose]);
    stepWorld(playground, 1 / 60);
    expect(held.left).toBe(0);
    expect(held.top).toBe(0);
    expect(loose.left).toBeGreaterThanOrEqual(50);
  });

  it("stacks things in a pile rather than letting them pass through each other", () => {
    const playground = world("fall", [createBody(100, 0, 60, 60), createBody(110, 100, 60, 60)]);
    settle(playground, 4);
    const [upper, lower] = playground.bodies;
    const overlapX =
      Math.min(upper!.left + 60, lower!.left + 60) - Math.max(upper!.left, lower!.left);
    const overlapY = Math.min(upper!.top + 60, lower!.top + 60) - Math.max(upper!.top, lower!.top);
    expect(overlapX <= 1 || overlapY <= 1).toBe(true);
  });

  it("leans a thrown thing into its flight and straightens it again", () => {
    const playground = world("drift");
    playground.bodies[0]!.velocityX = 600;
    stepWorld(playground, 1 / 60);
    expect(playground.bodies[0]!.tilt).toBeGreaterThan(0);
    settle(playground, 6);
    expect(Math.abs(playground.bodies[0]!.tilt)).toBeLessThan(1);
  });

  it("slows the wildest throws to a speed people can follow", () => {
    const [x, y] = capThrow(9000, 0);
    expect(x).toBe(fastestThrow);
    expect(y).toBe(0);
    expect(capThrow(100, 200)).toEqual([100, 200]);
  });
});
