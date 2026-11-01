import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigFileError } from "../lintel-config-file.js";
import { lintelBranding } from "./branding.schema.js";
import { readDeploymentBranding } from "./deployment-branding.js";

function configIn(contents: Record<string, unknown>) {
  const folder = mkdtempSync(join(tmpdir(), "lintel-branding-"));
  return { contents, folder };
}

describe("branding a deployment", () => {
  it("is Lintel's own look without a config file or environment variables", () => {
    expect(readDeploymentBranding(configIn({}), {})).toEqual({
      branding: lintelBranding,
      isCustomised: false,
    });
  });

  it("reads lintel.config.json, with environment variables on top", () => {
    const config = configIn({ branding: { productName: "Acme Studio", accentColour: "#0A7" } });
    const { branding, isCustomised } = readDeploymentBranding(config, {
      LINTEL_BRAND_PRODUCT_NAME: "Acme Client Portal",
      LINTEL_BRAND_HIDE_BUILT_WITH_LINTEL: "true",
    });
    expect(isCustomised).toBe(true);
    expect(branding).toMatchObject({
      productName: "Acme Client Portal",
      accentColour: "#00aa77",
      hideBuiltWithLintel: true,
      hideLintelHelp: false,
    });
  });

  it("reads pictures from files next to the config file", () => {
    const config = configIn({ branding: { logo: "./logo.svg" } });
    writeFileSync(join(config.folder, "logo.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
    const { branding } = readDeploymentBranding(config, {});
    expect(branding.logo).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("explains a mistake instead of starting with the wrong branding", () => {
    expect(() =>
      readDeploymentBranding(configIn({ branding: { accentColour: "teal" } }), {}),
    ).toThrow(ConfigFileError);
    expect(() => readDeploymentBranding(configIn({ branding: { colour: "#000" } }), {})).toThrow(
      /colour/,
    );
  });
});
