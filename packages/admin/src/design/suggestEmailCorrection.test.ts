import { describe, expect, it } from "vitest";
import { editDistance, suggestEmailCorrection } from "./suggestEmailCorrection.js";

describe("suggestEmailCorrection", () => {
  it.each([
    ["daniel@gmai.com", "daniel@gmail.com"],
    ["daniel@gmial.com", "daniel@gmail.com"],
    ["daniel@gamil.com", "daniel@gmail.com"],
    ["daniel@gmail.co", "daniel@gmail.com"],
    ["daniel@gmail.con", "daniel@gmail.com"],
    ["daniel@gmail", "daniel@gmail.com"],
    ["daniel@hotmial.com", "daniel@hotmail.com"],
    ["daniel@yahooo.com", "daniel@yahoo.com"],
    ["daniel@outlok.com", "daniel@outlook.com"],
    ["daniel@icloud.co", "daniel@icloud.com"],
    ["daniel@hotmail.co.uj", "daniel@hotmail.co.uk"],
  ])("suggests %s → %s", (typed, suggestion) => {
    expect(suggestEmailCorrection(typed)).toBe(suggestion);
  });

  it("leaves correct addresses alone", () => {
    expect(suggestEmailCorrection("daniel@gmail.com")).toBeNull();
    expect(suggestEmailCorrection("daniel@hotmail.co.uk")).toBeNull();
    expect(suggestEmailCorrection("daniel@live.ca")).toBeNull();
  });

  it("leaves unusual domains alone, because they are probably someone's own", () => {
    expect(suggestEmailCorrection("studio@lintel.dev")).toBeNull();
    expect(suggestEmailCorrection("ada@acme.co.uk")).toBeNull();
    expect(suggestEmailCorrection("ada@company.com")).toBeNull();
    expect(suggestEmailCorrection("ada@school.edu")).toBeNull();
  });

  it("ignores letter case and surrounding spaces", () => {
    expect(suggestEmailCorrection("  Daniel@GMAI.COM ")).toBe("Daniel@gmail.com");
    expect(suggestEmailCorrection(" DANIEL@GMAIL.COM ")).toBeNull();
  });

  it("says nothing until there is an address to check", () => {
    expect(suggestEmailCorrection("")).toBeNull();
    expect(suggestEmailCorrection("daniel")).toBeNull();
    expect(suggestEmailCorrection("daniel@")).toBeNull();
    expect(suggestEmailCorrection("@gmai.com")).toBeNull();
  });
});

describe("editDistance", () => {
  it("counts additions, removals, changes and swaps as one edit each", () => {
    expect(editDistance("gmail.com", "gmail.com")).toBe(0);
    expect(editDistance("gmai.com", "gmail.com")).toBe(1);
    expect(editDistance("gmaill.com", "gmail.com")).toBe(1);
    expect(editDistance("gmsil.com", "gmail.com")).toBe(1);
    expect(editDistance("gmial.com", "gmail.com")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
  });
});
