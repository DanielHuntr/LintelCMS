import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./contentSecurityPolicy.js";

describe("the admin's Content-Security-Policy", () => {
  it("runs only the admin's own scripts and talks only to itself and the API", () => {
    const policy = contentSecurityPolicy("https://api.example.com/");

    expect(policy).toContain("script-src 'self'");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).toContain("connect-src 'self' https://api.example.com");
    expect(policy).toContain("object-src 'none'");
    // A <meta> policy can't say who may frame the page; the header does.
    expect(policy).not.toContain("frame-ancestors");
  });

  it("keeps the admin out of other sites' frames when sent as a header", () => {
    const headers = securityHeaders("http://localhost:4000");

    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });
});
