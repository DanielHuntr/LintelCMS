import { describe, expect, it } from "vitest";
import {
  emptySiteDraft,
  newSiteFromDraft,
  renameDraft,
  siteChangesFromDraft,
  splitDomains,
} from "./siteForm.js";

describe("the site form", () => {
  it("makes the handle from the name until it is edited", () => {
    const named = renameDraft(emptySiteDraft(), "Acme France");
    expect(named.handle).toBe("acme_france");

    const edited = renameDraft({ ...named, handle: "fr", handleEdited: true }, "Acme FR");
    expect(edited.handle).toBe("fr");
  });

  it("reads domains separated by commas, spaces or lines", () => {
    expect(splitDomains("acme.fr, www.acme.fr\nshop.acme.fr  ")).toEqual([
      "acme.fr",
      "www.acme.fr",
      "shop.acme.fr",
    ]);
    expect(splitDomains("  ")).toEqual([]);
  });

  it("builds the requests, leaving the main language out of the extra ones", () => {
    const draft = {
      ...renameDraft(emptySiteDraft(), "Acme France"),
      domains: "acme.fr",
      defaultLocale: "fr-FR",
      extraLocales: ["fr-FR", "en-GB"],
      accentColor: "#ff6600",
    };

    expect(newSiteFromDraft(draft)).toEqual({
      handle: "acme_france",
      name: "Acme France",
      hostnames: ["acme.fr"],
      pathPrefix: "",
      siteUrl: "",
      defaultLocale: "fr-FR",
      extraLocales: ["en-GB"],
      branding: { accentColor: "#ff6600" },
    });
    expect(siteChangesFromDraft({ ...draft, accentColor: "" })).not.toHaveProperty("handle");
    expect(siteChangesFromDraft({ ...draft, accentColor: "" }).branding).toEqual({
      accentColor: null,
    });
  });
});
