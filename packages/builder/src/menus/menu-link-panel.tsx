import {
  colourTokens,
  layerStyles,
  type NodeStyles,
  type PageNode,
  readMenuLinkSettings,
  setStyles,
  type StylePropertyName,
  type StyleTarget,
  tokenValue,
} from "@lintel/builder-model";
import { Check } from "lucide-react";
import { Fragment, useId } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { useSiteTokens } from "../site-design/site-design-context.js";
import { ChoiceGroup, Labelled } from "../ui/controls.js";

/**
 * The builder's side of a Menu's links (see menu-links/ in the model). The Menu link is the
 * look of every link; clicking one link on the canvas selects the Menu link with that link
 * in hand, and the Style panel then asks where changes go: every menu link, or only that
 * one. A link's own changes are kept on the Menu link by menu item id.
 */

/** The link last clicked on the canvas, while its Menu link is selected. */
export interface PickedMenuItem {
  nodeId: string;
  id: string;
  label: string;
}

export type MenuItemScope = "every" | "only";

/** A link's own changes, with nothing left empty. */
function tidyStyles(styles: NodeStyles): NodeStyles | null {
  const kept = Object.fromEntries(
    Object.entries(styles).filter(
      ([key, value]) =>
        key === "base" || (typeof value === "object" && Object.keys(value).length > 0),
    ),
  ) as NodeStyles;
  const hasAny = Object.values(kept).some(
    (value) => typeof value === "object" && Object.keys(value).length > 0,
  );
  return hasAny ? kept : null;
}

/** Links' own looks without one of them. */
export function withoutItem<Look>(
  looks: Readonly<Record<string, Look>>,
  itemId: string,
): Record<string, Look> {
  return Object.fromEntries(Object.entries(looks).filter(([id]) => id !== itemId));
}

/** The Menu link's links with their own looks, after one changes. */
export function changeItemStyles(
  node: PageNode,
  itemId: string,
  target: StyleTarget,
  values: Partial<Record<StylePropertyName, string | undefined>>,
): Record<string, NodeStyles> {
  const { itemStyles } = readMenuLinkSettings(node.props);
  const next = tidyStyles(setStyles(itemStyles[itemId] ?? { base: {} }, target, values));
  const others = withoutItem(itemStyles, itemId);
  return next ? { ...others, [itemId]: next } : others;
}

/** The look a link has in effect: the shared look with its own changes over it. */
export function itemLook(node: PageNode, itemId: string): NodeStyles {
  const own = readMenuLinkSettings(node.props).itemStyles[itemId];
  if (!own) return node.styles;
  return layerStyles(node.styles, own);
}

/** "Changes apply to: Every menu link / Only “Contact”", and going back to the shared look. */
export function MenuItemScopeBar({
  node,
  item,
  scope,
  onScopeChange,
  onUseShared,
  isLocked,
}: {
  node: PageNode;
  item: PickedMenuItem | null;
  scope: MenuItemScope;
  onScopeChange: (scope: MenuItemScope) => void;
  onUseShared: () => void;
  isLocked: boolean;
}) {
  const text = useBuilderText();
  if (!item) {
    return <p className="text-caption text-label-secondary">{text("pageBuilder.menu.linkNote")}</p>;
  }
  const hasOwnLook = readMenuLinkSettings(node.props).itemStyles[item.id] !== undefined;
  const name = item.label || item.id;
  return (
    <div className="flex flex-col gap-2">
      <ChoiceGroup<MenuItemScope>
        label={text("pageBuilder.shared.changesApply")}
        value={scope}
        onChange={onScopeChange}
        choices={[
          { value: "every", label: text("pageBuilder.menu.applyEvery") },
          { value: "only", label: text("pageBuilder.menu.applyOnly", { name }) },
        ]}
      />
      {hasOwnLook && (
        <p className="flex flex-wrap items-center gap-x-2 text-caption text-label-secondary">
          {text("pageBuilder.menu.ownLook", { name })}
          {!isLocked && (
            <button
              type="button"
              onClick={onUseShared}
              className="rounded-control font-medium text-accent hover:underline focus-visible:focus-ring"
            >
              {text("pageBuilder.menu.sharedAgain")}
            </button>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * The colour of a hover look (the line, the circle, the colour it fades to): the words' own
 * colour, the site's colours or the theme's, as swatches.
 */
export function MenuLookColourField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const text = useBuilderText();
  const labelId = useId();
  const siteColours = useSiteTokens("colour");
  const tokens = [...siteColours, ...colourTokens];
  const chosen = tokens.find((token) => tokenValue(token) === value);
  const swatch = (key: string, title: string, colour: string, isCurrent: boolean, set: string) => (
    <button
      key={key}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={isCurrent}
      onClick={() => onChange(set)}
      style={{ background: colour }}
      className="flex size-6 items-center justify-center rounded-full hairline-ring focus-visible:focus-ring"
    >
      {isCurrent && (
        <Check aria-hidden="true" className="size-3.5 text-white mix-blend-difference" />
      )}
    </button>
  );
  return (
    <Labelled label={label}>
      {() => (
        <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-1.5">
          <span id={labelId} className="sr-only">
            {label}
          </span>
          <button
            type="button"
            title={text("pageBuilder.menu.wordsColour")}
            aria-label={text("pageBuilder.menu.wordsColour")}
            aria-pressed={value === ""}
            onClick={() => onChange("")}
            className={`flex size-6 items-center justify-center rounded-full text-caption font-semibold text-label hairline-ring focus-visible:focus-ring ${value === "" ? "bg-fill-strong" : ""}`}
          >
            <span aria-hidden="true">A</span>
          </button>
          {tokens.map((token, index) => (
            <Fragment key={token.name}>
              {index === siteColours.length && index > 0 && (
                <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-separator" />
              )}
              {swatch(token.name, token.label, token.fallback, chosen === token, tokenValue(token))}
            </Fragment>
          ))}
          <span aria-hidden="true" className="basis-full text-caption text-label-secondary">
            {chosen ? chosen.label : value === "" ? text("pageBuilder.menu.wordsColour") : value}
          </span>
        </div>
      )}
    </Labelled>
  );
}
