import { describe, expect, it, vi } from "vitest";
import type { Playback } from "../runtime/playback.js";
import { runScrollAction, scrollMoment } from "./inViewTrigger.js";

describe("scroll moments", () => {
  it("tells scrolling down from scrolling back up", () => {
    expect(scrollMoment(true, 400)).toBe("enter");
    expect(scrollMoment(true, -50)).toBe("enterBack");
    expect(scrollMoment(false, -300)).toBe("leave");
    expect(scrollMoment(false, 900)).toBe("leaveBack");
  });

  it("runs each action on the animation", () => {
    const playback = {
      playForward: vi.fn(),
      playBackward: vi.fn(),
      restart: vi.fn(),
      reset: vi.fn(),
      pause: vi.fn(),
      finish: vi.fn(),
    } as unknown as Playback;
    runScrollAction("reverse", playback);
    runScrollAction("restart", playback);
    runScrollAction("resume", playback);
    runScrollAction("none", playback);
    expect(playback.playBackward).toHaveBeenCalledTimes(1);
    expect(playback.restart).toHaveBeenCalledTimes(1);
    expect(playback.playForward).toHaveBeenCalledTimes(1);
  });
});
