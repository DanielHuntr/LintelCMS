import { describe, expect, it } from "vitest";
import { contrastRatio, normaliseHex, readableTextColour, slugForColour } from "./colours.js";
import {
  formatCoordinates,
  openStreetMapEmbedUrl,
  openStreetMapUrl,
  readCoordinatesFromLink,
} from "./coordinates.js";

describe("reading a place out of a map link", () => {
  it("reads OpenStreetMap links, by their pin first and their view otherwise", () => {
    expect(
      readCoordinatesFromLink(
        "https://www.openstreetmap.org/?mlat=51.50722&mlon=-0.12755#map=17/51.50722/-0.12755",
      ),
    ).toEqual({ latitude: 51.50722, longitude: -0.12755 });
    expect(
      readCoordinatesFromLink("https://www.openstreetmap.org/#map=16/53.4808/-2.2426"),
    ).toEqual({ latitude: 53.4808, longitude: -2.2426, zoom: 16 });
  });

  it("reads Google Maps links, preferring the place's pin to the middle of the view", () => {
    expect(readCoordinatesFromLink("https://www.google.com/maps/@55.9533,-3.1883,14z")).toEqual({
      latitude: 55.9533,
      longitude: -3.1883,
      zoom: 14,
    });
    expect(
      readCoordinatesFromLink(
        "https://www.google.com/maps/place/Bakery/@51.5,-0.1,15z/data=!3m1!4b1!4m6!3m5!3d51.50101!4d-0.14189",
      ),
    ).toEqual({ latitude: 51.50101, longitude: -0.14189 });
    expect(readCoordinatesFromLink("https://maps.google.com/?q=48.8584,2.2945")).toEqual({
      latitude: 48.8584,
      longitude: 2.2945,
    });
  });

  it("reads Apple Maps links and coordinates typed on their own", () => {
    expect(
      readCoordinatesFromLink(
        "https://maps.apple.com/?ll=40.6892,-74.0445&q=Statue%20of%20Liberty",
      ),
    ).toEqual({ latitude: 40.6892, longitude: -74.0445 });
    expect(
      readCoordinatesFromLink("https://maps.apple.com/place?coordinate=35.6586%2C139.7454"),
    ).toEqual({ latitude: 35.6586, longitude: 139.7454 });
    expect(readCoordinatesFromLink(" -33.8568, 151.2153 ")).toEqual({
      latitude: -33.8568,
      longitude: 151.2153,
    });
  });

  it("finds nothing in links without a place, or with one that isn't on the Earth", () => {
    expect(readCoordinatesFromLink("https://www.google.com/maps/place/Leeds")).toBeNull();
    expect(readCoordinatesFromLink("95.1, 10")).toBeNull();
    expect(readCoordinatesFromLink("")).toBeNull();
  });
});

describe("writing places out", () => {
  const london = { latitude: 51.5072, longitude: -0.1276 };

  it("writes coordinates the way people read them", () => {
    expect(formatCoordinates(london)).toBe("51.5072° N, 0.1276° W");
    expect(formatCoordinates({ latitude: -33.8568, longitude: 151.2153 })).toBe(
      "33.8568° S, 151.2153° E",
    );
  });

  it("links to OpenStreetMap and its embeddable map with the pin in the middle", () => {
    expect(openStreetMapUrl(london, 16)).toBe(
      "https://www.openstreetmap.org/?mlat=51.5072&mlon=-0.1276#map=16/51.5072/-0.1276",
    );
    const embed = new URL(openStreetMapEmbedUrl(london));
    expect(embed.hostname).toBe("www.openstreetmap.org");
    expect(embed.searchParams.get("marker")).toBe("51.5072,-0.1276");
  });
});

describe("colours", () => {
  it("tidies colour codes and refuses what isn't one", () => {
    expect(normaliseHex("#1A7F5A")).toBe("#1a7f5a");
    expect(normaliseHex("abc")).toBe("#aabbcc");
    expect(normaliseHex("red")).toBeNull();
  });

  it("works out contrast as WCAG does, and picks the text colour that reads", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
    expect(readableTextColour("#f4f1de")).toBe("#000000");
    expect(readableTextColour("#1a2b3c")).toBe("#ffffff");
    expect(readableTextColour("#f2c14e")).toBe("#000000");
  });

  it("makes names into CSS-friendly slugs", () => {
    expect(slugForColour("Forest green")).toBe("forest-green");
    expect(slugForColour("Crème brûlée!")).toBe("creme-brulee");
    expect(slugForColour("  ")).toBe("colour");
  });
});
