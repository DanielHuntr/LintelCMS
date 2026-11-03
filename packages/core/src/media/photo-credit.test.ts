import { describe, expect, it } from "vitest";
import { photoCreditFor } from "./photo-credit.js";

const byLicence = (licence: string, licenceName: string) => ({
  licence,
  licenceName,
  licenceUrl: `https://creativecommons.org/licenses/${licence}/2.0/`,
  creator: "Ian Sane",
  sourceUrl: "https://www.flickr.com/photos/example/1",
});

describe("photo credits on the website", () => {
  it("show a CC BY photo's credit in parts, so its creator and licence can link", () => {
    expect(
      photoCreditFor({
        credit: "“Bakery” by Ian Sane, CC BY 2.0",
        creditDetails: byLicence("by", "CC BY 2.0"),
      }),
    ).toEqual({
      text: "“Bakery” by Ian Sane, CC BY 2.0",
      creator: "Ian Sane",
      sourceUrl: "https://www.flickr.com/photos/example/1",
      licenceName: "CC BY 2.0",
      licenceUrl: "https://creativecommons.org/licenses/by/2.0/",
    });
  });

  it("show nothing for CC0 and Public Domain Mark photos, which ask for no credit", () => {
    expect(
      photoCreditFor({ credit: "Photo, CC0 1.0.", creditDetails: byLicence("cc0", "CC0 1.0") }),
    ).toBeNull();
    expect(
      photoCreditFor({
        credit: "Photo, Public Domain Mark.",
        creditDetails: byLicence("pdm", "Public Domain Mark"),
      }),
    ).toBeNull();
  });

  it("show a credit typed by hand as typed, and nothing without a credit", () => {
    expect(photoCreditFor({ credit: " Photo by Sam Baker ", creditDetails: null })).toEqual({
      text: "Photo by Sam Baker",
      creator: null,
      sourceUrl: null,
      licenceName: null,
      licenceUrl: null,
    });
    expect(photoCreditFor({ credit: "", creditDetails: byLicence("by", "CC BY 2.0") })).toBeNull();
  });
});
