import { describe, expect, it } from "vitest";
import { defineMotion, motionSpecSchema, type MotionSpecInput } from "./motion.schema.js";

const fadeUp = {
  trigger: { type: "inView" as const },
  tracks: [
    {
      property: "opacity",
      keyframes: [
        { offset: 0, value: 0 },
        { offset: 1, value: 1 },
      ],
    },
    {
      property: "translateY",
      keyframes: [
        { offset: 0, value: 24 },
        { offset: 1, value: 0 },
      ],
    },
  ],
} satisfies MotionSpecInput;

function messagesFor(input: unknown): string[] {
  const result = motionSpecSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("the animation spec", () => {
  it("fills in friendly defaults", () => {
    const spec = defineMotion(fadeUp);
    expect(spec).toMatchObject({
      version: 1,
      trigger: { type: "inView", threshold: 0.25, rootMargin: "0px", onLeave: "stay" },
      targets: { type: "self" },
      stagger: { each: 0, from: "first" },
      duration: 600,
      delay: 0,
      repeat: { times: 0, yoyo: false },
      easing: "easeOut",
      reducedMotion: "fade",
    });
  });

  it("accepts every kind of easing", () => {
    const easings = [
      "easeOutBack",
      { type: "cubicBezier", x1: 0.2, y1: 1.4, x2: 0.3, y2: 1 },
      { type: "spring" },
      { type: "steps", count: 4 },
    ];
    for (const easing of easings) expect(messagesFor({ ...fadeUp, easing })).toEqual([]);
  });

  it("accepts CSS variables, with an optional type", () => {
    const track = {
      property: "--glow",
      variableSyntax: "<length>",
      keyframes: [
        { offset: 0, value: "0px" },
        { offset: 1, value: "8px" },
      ],
    };
    expect(messagesFor({ ...fadeUp, tracks: [track] })).toEqual([]);
  });

  it("explains a property it doesn't know", () => {
    const tracks = [{ property: "width", keyframes: fadeUp.tracks[0]?.keyframes }];
    expect(messagesFor({ ...fadeUp, tracks })[0]).toContain("CSS variable like --glow");
  });

  it("refuses two tracks for one property", () => {
    const tracks = [fadeUp.tracks[0], fadeUp.tracks[0]];
    expect(messagesFor({ ...fadeUp, tracks })).toContain(
      "opacity has two tracks. Put all its keyframes in one track.",
    );
  });

  it("refuses mixed units and units that don't fit", () => {
    const mixed = [
      {
        property: "translateX",
        keyframes: [
          { offset: 0, value: "10%" },
          { offset: 1, value: "4px" },
        ],
      },
    ];
    expect(messagesFor({ ...fadeUp, tracks: mixed })[0]).toContain("mixes units");
    const degreesForOpacity = [
      {
        property: "opacity",
        keyframes: [
          { offset: 0, value: "1deg" },
          { offset: 1, value: 1 },
        ],
      },
    ];
    expect(messagesFor({ ...fadeUp, tracks: degreesForOpacity })[0]).toContain(
      "opacity needs numbers",
    );
  });

  it("allows a bare zero beside any unit", () => {
    const tracks = [
      {
        property: "translateX",
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 1, value: "-75%" },
        ],
      },
    ];
    expect(messagesFor({ ...fadeUp, tracks })).toEqual([]);
  });

  it("needs keyframes in time order", () => {
    const tracks = [
      {
        property: "opacity",
        keyframes: [
          { offset: 1, value: 0 },
          { offset: 0, value: 1 },
        ],
      },
    ];
    expect(messagesFor({ ...fadeUp, tracks })).toContain("Keyframes must be in time order.");
  });

  it("needs pointer tracks to say which way they follow", () => {
    expect(messagesFor({ ...fadeUp, trigger: { type: "pointer" } })).toContain(
      "Pointer animations need number tracks that follow x or y.",
    );
  });

  it("doesn't let scroll scenes repeat", () => {
    const spec = { ...fadeUp, trigger: { type: "scroll" }, repeat: { times: 2 } };
    expect(messagesFor(spec)).toContain(
      "Scroll animations follow the scroll position, so they can't repeat.",
    );
  });

  it("checks custom event names and root margins", () => {
    expect(messagesFor({ ...fadeUp, trigger: { type: "event", name: "has spaces" } })).toHaveLength(
      1,
    );
    expect(messagesFor({ ...fadeUp, trigger: { type: "inView", rootMargin: "10px -5%" } })).toEqual(
      [],
    );
    expect(
      messagesFor({ ...fadeUp, trigger: { type: "inView", rootMargin: "lots" } }),
    ).toHaveLength(1);
  });

  it("round-trips through JSON unchanged", () => {
    const spec = defineMotion({ ...fadeUp, repeat: { times: "forever", yoyo: true } });
    expect(motionSpecSchema.parse(JSON.parse(JSON.stringify(spec)))).toEqual(spec);
  });
});
