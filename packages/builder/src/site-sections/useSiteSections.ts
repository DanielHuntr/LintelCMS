import {
  asSiteSection,
  noSiteSections,
  type PageDocument,
  type SiteSections,
  type SiteSectionsChange,
  siteSectionSlotOf,
  siteSectionSlots,
  splitSiteSections,
  withSiteSections,
} from "@lintel/builder-model";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * The site's navigation and footer, as the builder gives them to the app. Left out, the
 * builder has no shared sections (a block's design), and the Navigation and Footer groups
 * add sections to the page like any other.
 */
export interface SiteSectionsSource {
  value: SiteSections;
  /** Saves a change for the whole site. Left out for people who may not change it: then they're locked. */
  onChange?: (change: SiteSectionsChange) => void;
}

/** How a slot is compared, so only real changes are sent to be saved. */
function signature(sections: SiteSections, slot: keyof SiteSections): string {
  const section = sections[slot];
  return section ? JSON.stringify(asSiteSection(section, slot)) : "null";
}

/**
 * The page the builder opens, with the site's sections in it, and the `onChange` that takes
 * them out again: the page goes to `onChange` without them, and a section that changed goes
 * to the source's `onChange`, on its own. Only slots that changed are sent, so a page opened
 * before another page added a navigation doesn't take it away.
 */
export function useSiteSections(
  source: SiteSectionsSource | undefined,
  initialDocument: PageDocument,
  onChange: (document: PageDocument) => void,
) {
  const [opened] = useState(() => {
    if (!source) return { document: initialDocument, had: noSiteSections };
    const locked = source.onChange === undefined;
    const sections: SiteSections = {
      navigation: source.value.navigation && { ...source.value.navigation, locked },
      footer: source.value.footer && { ...source.value.footer, locked },
    };
    const merged = withSiteSections(initialDocument, source.value);
    return {
      document: locked
        ? {
            ...merged,
            root: {
              ...merged.root,
              children: merged.root.children.map((child) =>
                (child.id === "site-navigation" && sections.navigation) ||
                (child.id === "site-footer" && sections.footer)
                  ? { ...child, locked: true }
                  : child,
              ),
            },
          }
        : merged,
      had: source.value,
    };
  });
  const latest = useRef({ source, onChange });
  useLayoutEffect(() => {
    latest.current = { source, onChange };
  });
  const known = useRef<Record<keyof SiteSections, string> | null>(null);
  if (known.current === null) {
    known.current = {
      navigation: signature(opened.had, "navigation"),
      footer: signature(opened.had, "footer"),
    };
  }

  const handleChange = useCallback((document: PageDocument) => {
    const { source: current, onChange: changePage } = latest.current;
    if (!current) return changePage(document);
    const split = splitSiteSections(document);
    changePage(split.document);
    if (!current.onChange || !known.current) return;
    const change: SiteSectionsChange = {};
    for (const slot of siteSectionSlots) {
      const now = signature(split.sections, slot);
      if (now === known.current[slot]) continue;
      known.current[slot] = now;
      change[slot] = split.sections[slot];
    }
    if (Object.keys(change).length > 0) current.onChange(change);
  }, []);

  /** A page from elsewhere, with the sections as they are on screen now. */
  const dressIncoming = useCallback((page: PageDocument, current: PageDocument) => {
    if (!latest.current.source) return page;
    const dressed = withSiteSections(page, splitSiteSections(current).sections);
    const isLocked = (id: string) => current.root.children.find((each) => each.id === id)?.locked;
    return {
      ...dressed,
      root: {
        ...dressed.root,
        children: dressed.root.children.map((child) =>
          siteSectionSlotOf(child.id) && isLocked(child.id) ? { ...child, locked: true } : child,
        ),
      },
    };
  }, []);

  return {
    initialDocument: opened.document,
    onChange: handleChange,
    dressIncoming,
    /** What the site had when the page was opened, for the note when that changes. */
    had: { navigation: opened.had.navigation !== null, footer: opened.had.footer !== null },
  };
}
