import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client.js";
import {
  errorsWithoutAField,
  fieldErrorsFrom,
  firstFieldWithError,
  focusField,
} from "./fieldErrors.js";

const onScreenOrder = ["title", "slug", "excerpt", "category"];

describe("field errors from the API", () => {
  it("are read from a validation error's `fields`", () => {
    const error = new ApiError(400, "INVALID_REQUEST", "Some fields need attention.", {
      category: "Choose a category.",
    });

    expect(fieldErrorsFrom(error)).toEqual({ category: "Choose a category." });
    expect(fieldErrorsFrom(new ApiError(500, "UNKNOWN", "Oops"))).toEqual({});
    expect(fieldErrorsFrom(new TypeError("Failed to fetch"))).toEqual({});
  });

  it("point to the first field on screen with a problem, not the API's order", () => {
    const errors = { category: "Choose a category.", excerpt: "Add an excerpt." };

    expect(firstFieldWithError(onScreenOrder, errors)).toBe("excerpt");
  });

  it("set aside messages about things that aren't fields, for the banner", () => {
    const errors = { excerpt: "Add an excerpt.", parentId: "That page no longer exists." };

    expect(errorsWithoutAField(onScreenOrder, errors)).toEqual(["That page no longer exists."]);
  });
});

describe("focusField", () => {
  it("moves focus to the field's control", () => {
    document.body.innerHTML = `
      <div data-field-handle="title"><input aria-label="Title" /></div>
      <div data-field-handle="excerpt"><label for="x">Excerpt</label><textarea id="x"></textarea></div>`;

    focusField(document.body, "excerpt");

    expect(document.activeElement).toBe(document.querySelector("textarea"));
  });

  it("focuses the field itself when it has no control of its own", () => {
    document.body.innerHTML = `<fieldset data-field-handle="hero_image"><legend>Hero</legend></fieldset>`;

    focusField(document.body, "hero_image");

    expect(document.activeElement).toBe(document.querySelector("fieldset"));
  });
});
