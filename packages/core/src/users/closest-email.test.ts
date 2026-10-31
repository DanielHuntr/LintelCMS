import { describe, expect, it } from "vitest";
import { findClosestEmail } from "./closest-email.js";

describe("findClosestEmail", () => {
  const emails = ["ana@example.com", "ben@example.org", "carla.ruiz@example.com"];

  it("suggests the email that is a likely typo away", () => {
    expect(findClosestEmail("ana@exmaple.com", emails)).toBe("ana@example.com");
    expect(findClosestEmail("carla.ruis@example.com", emails)).toBe("carla.ruiz@example.com");
  });

  it("suggests nothing when no email is close", () => {
    expect(findClosestEmail("someone.else@another.net", emails)).toBeUndefined();
    expect(findClosestEmail("ana@example.com", [])).toBeUndefined();
  });
});
