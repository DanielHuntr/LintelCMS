import {
  type Breakpoint,
  type PageNode,
  setStyles,
  type SharedStyles,
  type StyleTarget,
  type TagStyleKind,
  tidyTagStyles,
} from "@lintel/builder-model";
import { ChevronLeft } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type { BuilderStringKey } from "../i18n/builder-strings.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { BordersSection } from "../style-panel/AppearanceSections.js";
import { BackgroundSection } from "../style-panel/BackgroundSection.js";
import { type DesignTools, DesignToolsContext } from "../style-panel/design-tools.js";
import { SpacingSection } from "../style-panel/SpacingSection.js";
import { type StyleEditing, StyleEditingContext } from "../style-panel/style-field.js";
import { TypographySection } from "../style-panel/TypographySection.js";
import { ChoiceGroup } from "../ui/controls.js";
import { useSiteDesign } from "./site-design-context.js";

/** What each kind is called, says and lets people change. */
export const tagStyleKindDetails: Record<
  TagStyleKind,
  {
    title: BuilderStringKey;
    note: BuilderStringKey;
    /** The element it's most like, for controls that change with the element's type. */
    elementType: string;
    sections: ReadonlyArray<"text" | "spacing" | "background" | "borders">;
    hasHover: boolean;
  }
> = {
  headings: {
    title: "pageBuilder.tagStyles.headings",
    note: "pageBuilder.tagStyles.headingsNote",
    elementType: "heading",
    sections: ["text", "spacing"],
    hasHover: false,
  },
  paragraphs: {
    title: "pageBuilder.tagStyles.paragraphs",
    note: "pageBuilder.tagStyles.paragraphsNote",
    elementType: "text",
    sections: ["text", "spacing"],
    hasHover: false,
  },
  links: {
    title: "pageBuilder.tagStyles.links",
    note: "pageBuilder.tagStyles.linksNote",
    elementType: "link",
    sections: ["text"],
    hasHover: true,
  },
  buttons: {
    title: "pageBuilder.tagStyles.buttons",
    note: "pageBuilder.tagStyles.buttonsNote",
    elementType: "button",
    sections: ["text", "spacing", "background", "borders"],
    hasHover: true,
  },
  pictures: {
    title: "pageBuilder.tagStyles.pictures",
    note: "pageBuilder.tagStyles.picturesNote",
    elementType: "image",
    sections: ["borders"],
    hasHover: false,
  },
};

const noChange = () => undefined;

/**
 * How every heading (or link, or button...) on the site looks, unless it says otherwise:
 * the same style controls as an element's, with Back to Site styles. Changes are saved for
 * the site and show on every page at once; an element's own styles and shared styles win.
 */
export function TagStyleEditor({
  kind,
  breakpoint,
  onBack,
}: {
  kind: TagStyleKind;
  breakpoint: Breakpoint;
  onBack: () => void;
}) {
  const text = useBuilderText();
  const { design, change } = useSiteDesign();
  const details = tagStyleKindDetails[kind];
  const [look, setLook] = useState<"none" | "hover">("none");
  const saved = design.tagStyles?.[kind];
  const styles = useMemo<SharedStyles>(() => saved ?? { base: {} }, [saved]);
  const target: StyleTarget = look === "hover" ? "hover" : breakpoint;
  const editing = useMemo<StyleEditing>(
    () => ({
      styles,
      target,
      change: (values) => {
        if (!change) return;
        const next = setStyles(styles, target, values);
        delete next.owners;
        change({
          ...design,
          tagStyles: tidyTagStyles({ ...design.tagStyles, [kind]: next }),
        });
      },
    }),
    [styles, target, change, design, kind],
  );
  // The controls ask about the element they're changing; here it's every one of a kind.
  const tools = useMemo<DesignTools>(() => {
    const node: PageNode = {
      id: `every-${kind}`,
      type: details.elementType,
      name: "",
      props: {},
      styles,
      children: [],
      hidden: false,
      locked: false,
    };
    return {
      node,
      parent: null,
      pageFonts: [],
      changePageFonts: noChange,
      setFreeLayout: noChange,
      setPlacedGrid: noChange,
      placeOnGrid: noChange,
      changeSharedStyle: noChange,
      setBackgroundVideo: noChange,
      restack: noChange,
    };
  }, [kind, details.elementType, styles]);

  const sections: Record<(typeof details.sections)[number], ReactNode> = {
    text: <TypographySection key="text" advanced={false} />,
    spacing: <SpacingSection key="spacing" advanced={false} />,
    background: <BackgroundSection key="background" advanced={false} />,
    borders: <BordersSection key="borders" advanced={false} />,
  };

  return (
    <section aria-labelledby="tag-style-title" className="flex flex-col">
      <div className="flex flex-col gap-3 hairline-bottom px-4 pt-3 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="-ms-1.5 flex h-8 items-center gap-0.5 self-start rounded-control pe-2 text-body font-medium text-label-secondary hover:bg-fill focus-visible:focus-ring"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {text("pageBuilder.siteStyles.title")}
        </button>
        <div className="flex flex-col gap-0.5">
          <h2 id="tag-style-title" className="text-headline font-semibold text-label">
            {text(details.title)}
          </h2>
          <p className="text-caption text-label-secondary">{text(details.note)}</p>
        </div>
        {details.hasHover && (
          <ChoiceGroup<"none" | "hover">
            label={text("pageBuilder.style.lookLabel")}
            value={look}
            onChange={setLook}
            choices={[
              { value: "none", label: text("pageBuilder.style.lookNormal") },
              { value: "hover", label: text("pageBuilder.style.lookHover") },
            ]}
          />
        )}
      </div>
      <fieldset disabled={!change} className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">{text(details.title)}</legend>
        <StyleEditingContext.Provider value={editing}>
          <DesignToolsContext.Provider value={tools}>
            <div className="flex flex-col">
              {details.sections.map((section) => sections[section])}
            </div>
          </DesignToolsContext.Provider>
        </StyleEditingContext.Provider>
      </fieldset>
    </section>
  );
}
