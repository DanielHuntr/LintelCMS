import { Plus } from "lucide-react";
import { useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { inputClassName, Labelled } from "../ui/controls.js";
import { useDesignTools } from "./design-tools.js";
import { type FontChoice, fontChoiceGroups, useSiteFonts } from "./font-choices.js";
import { overrideNoteFor, useStyleEditing, useStyleField } from "./style-field.js";

/**
 * The element's font, from one list: the theme's two fonts, the site's fonts (uploaded,
 * from Google Fonts or Adobe Fonts), any font this page uploaded on its own, and the fonts
 * that come with Lintel. "Add a font" opens the site's fonts, where new ones are added for
 * every page. A font only this page has can be moved to the whole site.
 */
export function FontPicker() {
  const text = useBuilderText();
  const tools = useDesignTools();
  const siteFonts = useSiteFonts();
  const { target } = useStyleEditing();
  const field = useStyleField("fontFamily", text("pageBuilder.style.font"));
  const groups = fontChoiceGroups(siteFonts.fonts, tools.pageFonts, {
    heading: text("pageBuilder.design.themeHeadingFont"),
    body: text("pageBuilder.design.themeBodyFont"),
  });
  const choices = groups.flatMap((group) => group.choices);
  const current = choices.find((choice) => choice.value === field.value);

  const choose = (value: string) => {
    const choice = choices.find((candidate) => candidate.value === value);
    const pageFont = choice?.pageFont;
    if (choice && pageFont?.source === "catalogue") {
      const alreadyThere = tools.pageFonts.some(
        (existing) => existing.source === "catalogue" && existing.id === pageFont.id,
      );
      // An included font is declared on the page too, so it also works where the site's
      // stylesheet isn't (a block's preview), and the website can preload it.
      if (!alreadyThere) {
        tools.changePageFonts(
          [...tools.pageFonts, pageFont],
          text("pageBuilder.design.fontAdded", { name: choice.label }),
        );
      }
    }
    field.set(value || undefined);
  };

  return (
    <div className="flex flex-col gap-2">
      <Labelled
        label={text("pageBuilder.style.font")}
        overridden={field.isOverridden ? text(overrideNoteFor(target)) : undefined}
        onReset={field.reset}
        resetLabel={text("pageBuilder.style.reset")}
      >
        {(id) => (
          <div className="flex gap-1">
            <select
              id={id}
              value={field.value ?? ""}
              onChange={(event) => choose(event.target.value)}
              className={inputClassName}
            >
              <option value="">{text("pageBuilder.style.notSet")}</option>
              {!current && field.value && <option value={field.value}>{field.value}</option>}
              {groups.map((group) => (
                <optgroup key={group.id} label={text(`pageBuilder.design.fontGroup.${group.id}`)}>
                  {group.choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {siteFonts.addFont && (
              <button
                type="button"
                onClick={siteFonts.addFont}
                className="flex h-8 shrink-0 items-center gap-1 rounded-control bg-fill px-2 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                {text("pageBuilder.design.addFont")}
              </button>
            )}
          </div>
        )}
      </Labelled>
      {current?.uploadedToPage && <PageOnlyFont choice={current} />}
    </div>
  );
}

/** A font uploaded to this page alone, before fonts were kept for the whole site. */
function PageOnlyFont({ choice }: { choice: FontChoice }) {
  const text = useBuilderText();
  const tools = useDesignTools();
  const { moveToSite } = useSiteFonts();
  const [isMoving, setIsMoving] = useState(false);
  const font = choice.uploadedToPage;
  if (!font) return null;

  const move = async () => {
    if (!moveToSite) return;
    setIsMoving(true);
    const moved = await moveToSite(font).finally(() => setIsMoving(false));
    // The site's font has the same name, so every element using it keeps its look.
    if (moved) {
      tools.changePageFonts(
        tools.pageFonts.filter((existing) => existing !== font),
        text("pageBuilder.design.fontMoved", { name: font.family }),
      );
    }
  };

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-label-secondary">
      {text("pageBuilder.design.fontPageOnly")}
      {moveToSite && (
        <button
          type="button"
          disabled={isMoving}
          onClick={() => void move()}
          className="font-medium text-accent hover:underline focus-visible:focus-ring disabled:opacity-60"
        >
          {text("pageBuilder.design.fontMoveToSite")}
        </button>
      )}
    </p>
  );
}
