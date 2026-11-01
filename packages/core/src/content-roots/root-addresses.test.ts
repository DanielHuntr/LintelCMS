import { describe, expect, it } from "vitest";
import {
  addressUnderRoot,
  findAddressClash,
  matchRootForPath,
  normalizeHostname,
  normalizePathPrefix,
  pathOfAddress,
  placeSiteStarts,
  removePathPrefix,
} from "./root-addresses.js";

const home = { entryId: "home", slug: "home", address: null };
const shop = { entryId: "shop", slug: "shop", address: null };
const blog = { entryId: "blog", slug: "journal", address: null };

describe("site start addresses", () => {
  it("makes a single site start the site's /, with its children straight under it", () => {
    const [root] = placeSiteStarts([home]);

    expect(root).toEqual({
      entryId: "home",
      hostname: "",
      pathPrefix: "",
      isDefault: true,
      isAssigned: false,
    });
    expect(addressUnderRoot(root!, "/")).toBe("/");
    expect(addressUnderRoot(root!, "/about")).toBe("/about");
  });

  it("gives the first of several site starts /, and the others their own slug", () => {
    const roots = placeSiteStarts([home, shop, blog]);

    expect(roots.map((root) => addressUnderRoot(root, "/"))).toEqual(["/", "/shop", "/journal"]);
    expect(addressUnderRoot(roots[1]!, "/about")).toBe("/shop/about");
    expect(roots.map((root) => root.isDefault)).toEqual([true, false, false]);
  });

  it("uses the domain and path given in Hostnames", () => {
    const roots = placeSiteStarts([
      { ...home, address: { hostname: "shop.example.com", pathPrefix: "" } },
      shop,
      { ...blog, address: { hostname: "", pathPrefix: "/news" } },
    ]);

    // The first has a domain of its own, so the next without an address is "/".
    expect(roots.map((root) => addressUnderRoot(root, "/about"))).toEqual([
      "https://shop.example.com/about",
      "/about",
      "/news/about",
    ]);
    expect(addressUnderRoot(roots[0]!, "/")).toBe("https://shop.example.com/");
    expect(addressUnderRoot(roots[2]!, "/")).toBe("/news");
  });

  it("lets a later site start claim / on purpose, moving the first under its slug", () => {
    const roots = placeSiteStarts([home, { ...shop, address: { hostname: "", pathPrefix: "" } }]);

    expect(roots.map((root) => addressUnderRoot(root, "/"))).toEqual(["/home", "/"]);
  });

  it("finds which site start a path belongs to, the longest prefix first", () => {
    const roots = placeSiteStarts([
      home,
      shop,
      { ...blog, address: { hostname: "", pathPrefix: "/shop/journal" } },
      { entryId: "elsewhere", slug: "elsewhere", address: { hostname: "x.com", pathPrefix: "" } },
    ]);

    expect(matchRootForPath(roots, "/")?.entryId).toBe("home");
    expect(matchRootForPath(roots, "/about")?.entryId).toBe("home");
    expect(matchRootForPath(roots, "/shop")?.entryId).toBe("shop");
    expect(matchRootForPath(roots, "/Shop/boots")?.entryId).toBe("shop");
    expect(matchRootForPath(roots, "/shop/journal/day-one")?.entryId).toBe("blog");
    expect(matchRootForPath(roots, "/shopping")?.entryId).toBe("home");
    expect(removePathPrefix("/shop", "/shop/boots")).toBe("/boots");
    expect(removePathPrefix("/shop", "/shop")).toBe("/");
  });

  it("tidies domains and paths, and refuses what isn't one", () => {
    expect(normalizeHostname(" https://Shop.Example.com/about ")).toBe("shop.example.com");
    expect(normalizeHostname("localhost:3000")).toBe("localhost:3000");
    expect(normalizeHostname("")).toBe("");
    expect(normalizeHostname("not a domain")).toBeNull();
    expect(normalizePathPrefix("Shop/")).toBe("/shop");
    expect(normalizePathPrefix("/")).toBe("");
    expect(normalizePathPrefix("/my shop")).toBeNull();
  });

  it("spots two site starts on the same domain and path", () => {
    const roots = placeSiteStarts([home, shop]);

    expect(findAddressClash({ hostname: "", pathPrefix: "/shop" }, roots)?.entryId).toBe("shop");
    expect(findAddressClash({ hostname: "", pathPrefix: "/news" }, roots)).toBeUndefined();
    expect(pathOfAddress("https://shop.example.com/about")).toBe("/about");
    expect(pathOfAddress("/about")).toBe("/about");
  });
});
