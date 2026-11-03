import {
  type DesignToken,
  familyValue,
  fontCatalogue,
  fontFamilyValue,
  fontTokens,
  type PageFont,
  pageFontFamily,
  type SiteFontChoice,
  tokenValue,
} from "@lintel/builder-model";
import { createContext, useContext } from "react";

/** A page font uploaded before fonts were kept for the whole site. */
export type UploadedPageFont = Extract<PageFont, { source: "upload" }>;

/**
 * The site's fonts, as the host knows them (the admin reads them with the canvas's site),
 * and what the host can do about them. Provided by PageBuilder.
 */
export interface SiteFontTools {
  fonts: readonly SiteFontChoice[];
  /** Opens the site's fonts to add one. Left out when the person may not change them. */
  addFont?: () => void;
  /** Makes a font uploaded to one page usable on every page; true when it was. */
  moveToSite?: (font: UploadedPageFont) => Promise<boolean>;
}

export const SiteFontsContext = createContext<SiteFontTools>({ fonts: [] });

export function useSiteFonts(): SiteFontTools {
  return useContext(SiteFontsContext);
}

export interface FontChoice {
  /** The CSS `font-family` value it sets. */
  value: string;
  label: string;
  /** For an included font: the page font that declares it, added when it is chosen. */
  pageFont?: PageFont;
  /** For a font uploaded to this page only: offered a move to the whole site. */
  uploadedToPage?: UploadedPageFont;
}

export interface FontChoiceGroup {
  id: "theme" | "site" | "page" | "included";
  choices: FontChoice[];
}

/**
 * Every font an element can use, grouped as the font list shows them: the theme's two
 * (with the site's font variables), the site's own, any this page added by itself, and the ones that come with Lintel. A font
 * appears once, in the first group that has it.
 */
export function fontChoiceGroups(
  siteFonts: readonly SiteFontChoice[],
  pageFonts: readonly PageFont[],
  themeLabels: { heading: string; body: string },
  /** The site's font design variables, listed with the theme's two. */
  variables: readonly DesignToken[] = [],
): FontChoiceGroup[] {
  const seen = new Set<string>();
  const keep = (choice: FontChoice) => {
    if (seen.has(choice.value)) return false;
    seen.add(choice.value);
    return true;
  };
  const [heading, body] = fontTokens;
  const groups: FontChoiceGroup[] = [
    {
      id: "theme",
      choices: [
        ...(heading ? [{ value: tokenValue(heading), label: themeLabels.heading }] : []),
        ...(body ? [{ value: tokenValue(body), label: themeLabels.body }] : []),
        ...variables.map((token) => ({ value: tokenValue(token), label: token.label })),
      ],
    },
    {
      id: "site",
      choices: siteFonts.map((font) => ({ value: familyValue(font), label: font.family })),
    },
    {
      id: "page",
      // Included fonts a page added are listed with the included ones.
      choices: pageFonts.flatMap((font) =>
        font.source === "upload"
          ? [{ value: fontFamilyValue(font), label: pageFontFamily(font), uploadedToPage: font }]
          : [],
      ),
    },
    {
      id: "included",
      choices: fontCatalogue.map((font) => ({
        value: familyValue(font),
        label: font.family,
        pageFont: { source: "catalogue", id: font.id },
      })),
    },
  ];
  return groups
    .map((group) => ({ ...group, choices: group.choices.filter(keep) }))
    .filter((group) => group.choices.length > 0);
}
