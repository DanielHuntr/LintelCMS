import {
  accordionComponent,
  accordionItemComponent,
  cardComponent,
  gridComponent,
  modalComponent,
  spacerComponent,
  stickyComponent,
  tabPanelComponent,
  tabsComponent,
} from "@lintel/builder-model";
import {
  Children,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import { drawsProps } from "../component-registry.js";
import { cx } from "./behaviour-types.js";

/**
 * Layout elements. Tabs, the accordion and the pop-up are plain HTML that works without
 * script (the accordion is `<details>`, the pop-up a `<dialog>` opened by a command button);
 * the elements script adds arrow keys to tabs and "one open at a time" to accordions.
 */

export function gridClasses(props: {
  columns: number;
  tabletColumns: number;
  phoneColumns: number;
}) {
  return cx(
    `lintel-grid--columns-${props.columns}`,
    `lintel-grid--tablet-${props.tabletColumns}`,
    `lintel-grid--phone-${props.phoneColumns}`,
  );
}

const Grid = drawsProps(gridComponent, ({ props, attributes, children }) => (
  <div
    {...attributes}
    className={cx(
      attributes.className,
      "lintel-grid",
      gridClasses(props),
      `lintel-grid--gap-${props.gap}`,
    )}
  >
    {children}
  </div>
));

const Spacer = drawsProps(spacerComponent, ({ props, attributes }) => (
  <div
    {...attributes}
    aria-hidden="true"
    className={cx(attributes.className, "lintel-spacer", `lintel-spacer--${props.size}`)}
  />
));

/**
 * A card that links somewhere is one link around everything in it, so the whole card is one
 * click target and screen readers hear its words as the link's name. (Put no other links or
 * buttons inside a linked card.)
 */
const Card = drawsProps(cardComponent, ({ props, attributes, children, mode }) => {
  const className = cx(attributes.className, "lintel-card", `lintel-card--${props.look}`);
  if (props.href) {
    return (
      <a
        {...attributes}
        className={cx(className, "lintel-card--linked")}
        href={mode === "canvas" ? undefined : props.href}
      >
        {children}
      </a>
    );
  }
  return (
    <article {...attributes} className={className}>
      {children}
    </article>
  );
});

const FirstTabContext = createContext<string | undefined>(undefined);

interface PanelInfo {
  id: string;
  label: string;
}

/** The label and id of each Tab inside the Tabs, read from the children's nodes. */
function tabPanels(children: ReactNode): PanelInfo[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const node = (
      child as ReactElement<{
        node?: { id: string; hidden: boolean; props: Record<string, unknown> };
      }>
    ).props.node;
    return node && !node.hidden ? [{ id: node.id, label: String(node.props.label ?? "") }] : [];
  });
}

const Tabs = drawsProps(tabsComponent, ({ props, attributes, children, node }) => {
  const panels = tabPanels(children);
  return (
    <div {...attributes} className={cx(attributes.className, "lintel-tabs")} data-behaviour="tabs">
      <div className="lintel-tabs__list" role="tablist" aria-label={props.label || undefined}>
        {panels.map((panel, index) => (
          <button
            key={panel.id}
            type="button"
            role="tab"
            className="lintel-tabs__tab"
            id={`tab-${panel.id}`}
            aria-controls={`panel-${panel.id}`}
            aria-selected={index === 0}
            tabIndex={index === 0 ? 0 : -1}
          >
            {panel.label || `Tab ${index + 1}`}
          </button>
        ))}
      </div>
      <FirstTabContext.Provider value={panels[0]?.id}>
        <div className="lintel-tabs__panels" data-tabs-for={node.id}>
          {children}
        </div>
      </FirstTabContext.Provider>
    </div>
  );
});

const TabPanel = drawsProps(tabPanelComponent, ({ attributes, children, node, mode }) => {
  // The first panel shows until the script changes it; the canvas shows them all.
  const isFirst = useContext(FirstTabContext) === node.id;
  return (
    <div
      {...attributes}
      className={cx(attributes.className, "lintel-tabs__panel")}
      role="tabpanel"
      id={`panel-${node.id}`}
      aria-labelledby={`tab-${node.id}`}
      tabIndex={0}
      hidden={mode === "site" && !isFirst ? true : undefined}
    >
      {children}
    </div>
  );
});

const Accordion = drawsProps(accordionComponent, ({ props, attributes, children, node }) => (
  <div
    {...attributes}
    className={cx(attributes.className, "lintel-accordion")}
    data-behaviour="accordion"
    data-one-open={props.onlyOneOpen ? "" : undefined}
    data-accordion={node.id}
  >
    {children}
  </div>
));

const AccordionItem = drawsProps(
  accordionItemComponent,
  ({ props, attributes, children, editableText, mode }) => (
    <details
      {...attributes}
      className={cx(attributes.className, "lintel-accordion__item")}
      open={props.startsOpen || mode === "canvas" || undefined}
    >
      <summary className="lintel-accordion__title">
        <span {...editableText("title")}>{props.title}</span>
      </summary>
      <div className="lintel-accordion__body">{children}</div>
    </details>
  ),
);

/**
 * A button and a `<dialog>`. The button uses the browser's own `command="show-modal"`, and
 * the elements script does the same for browsers without it. The dialog's close button
 * closes it with no script at all (`<form method="dialog">`).
 */
const Modal = drawsProps(
  modalComponent,
  ({ props, attributes, children, node, editableText, mode }) => {
    const dialogId = `dialog-${node.id}`;
    return (
      <div
        {...attributes}
        className={cx(attributes.className, "lintel-modal")}
        data-behaviour="modal"
      >
        <button
          type="button"
          className="lintel-modal__open lintel-button"
          {...({ command: "show-modal", commandfor: dialogId } as Record<string, string>)}
          aria-haspopup="dialog"
          {...editableText("buttonLabel")}
        >
          {props.buttonLabel}
        </button>
        {mode === "canvas" ? (
          <div className="lintel-modal__preview">{children}</div>
        ) : (
          <dialog
            id={dialogId}
            className={cx("lintel-modal__dialog", `lintel-modal__dialog--${props.size}`)}
            aria-labelledby={`${dialogId}-title`}
          >
            <div className="lintel-modal__header">
              <h2 className="lintel-modal__title" id={`${dialogId}-title`}>
                {props.title}
              </h2>
              <form method="dialog">
                <button type="submit" className="lintel-modal__close" aria-label="Close">
                  <span aria-hidden="true">×</span>
                </button>
              </form>
            </div>
            <div className="lintel-modal__body">{children}</div>
          </dialog>
        )}
      </div>
    );
  },
);

const Sticky = drawsProps(stickyComponent, ({ props, attributes, children }) => (
  <div
    {...attributes}
    className={cx(
      attributes.className,
      "lintel-sticky",
      `lintel-sticky--${props.edge}`,
      `lintel-sticky--offset-${props.offset}`,
    )}
  >
    {children}
  </div>
));

export const layoutRenders = {
  grid: Grid,
  spacer: Spacer,
  card: Card,
  tabs: Tabs,
  tabPanel: TabPanel,
  accordion: Accordion,
  accordionItem: AccordionItem,
  modal: Modal,
  sticky: Sticky,
};
