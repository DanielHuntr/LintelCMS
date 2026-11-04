import { describe, expect, it } from "vitest";
import { testPaymentGonePage, testSessionBanner } from "./test-checkout-pages.js";

describe("the pages of a test session", () => {
  it("lifts the cookie notice above the test bar (LINTEL-UX-329)", () => {
    expect(testSessionBanner({ text: "Test order" })).toMatch(
      /\.lintel-cookie-notice\{inset-block-end:/,
    );
  });

  it("join a site's page transition, so it doesn't fail on the way in (LINTEL-UX-321)", () => {
    expect(testPaymentGonePage()).toContain("@view-transition{navigation:auto}");
  });
});
