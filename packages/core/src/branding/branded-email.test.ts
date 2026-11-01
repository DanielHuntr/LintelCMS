import { describe, expect, it } from "vitest";
import { lintelBranding } from "./branding.schema.js";
import { describePublicBranding } from "./branding.service.js";
import { renderBrandedEmail } from "./branded-email.js";

describe("branded emails", () => {
  it("carry the agency's name, colour and support address", () => {
    const branding = describePublicBranding(
      {
        ...lintelBranding,
        productName: "Acme <Studio>",
        accentColour: "#0b1f4d",
        supportEmail: "help@acme.example",
      },
      "https://api.example.com",
    );
    const email = renderBrandedEmail(branding, {
      subject: "Reset your password",
      heading: "Choose a new password",
      paragraphs: ["Someone asked to reset the password for your account."],
      action: { label: "Choose a new password", url: "https://admin.example.com/reset?token=1" },
    });

    expect(email.subject).toBe("Reset your password · Acme <Studio>");
    expect(email.fromName).toBe("Acme <Studio>");
    expect(email.html).toContain("Acme &lt;Studio&gt;");
    expect(email.html).toContain("background:#0b1f4d");
    expect(email.html).not.toContain("Lintel");
    expect(email.text).toContain("Questions? Email help@acme.example.");
  });
});
