import { useRef, type KeyboardEvent } from "react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { type WorkspaceTab, workspaceTabLabels } from "./workspaceTabs.js";

interface WorkspaceTabListProps {
  idPrefix: string;
  title: string;
  tabs: readonly WorkspaceTab[];
  selected: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
}

/**
 * The workspace's tabs, following the ARIA tabs pattern: Tab moves into the row once, the
 * arrow keys (and Home and End) move between tabs, and the panel follows. The open tab is
 * in the address, so it can be linked to and survives a reload.
 */
export function WorkspaceTabList({
  idPrefix,
  title,
  tabs,
  selected,
  onSelect,
}: WorkspaceTabListProps) {
  const buttons = useRef(new Map<WorkspaceTab, HTMLButtonElement>());

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const target = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    const tab = target === undefined ? undefined : tabs[target];
    if (!tab) return;
    event.preventDefault();
    onSelect(tab);
    buttons.current.get(tab)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={t("workspace.tabs", { title })}
      className="flex gap-5 hairline-bottom"
    >
      {tabs.map((tab, index) => {
        const isSelected = tab === selected;
        return (
          <button
            key={tab}
            ref={(element) => {
              if (element) buttons.current.set(tab, element);
              else buttons.current.delete(tab);
            }}
            id={`${idPrefix}-${tab}`}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(tab)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={classNames(
              "-mb-px h-10 border-b-2 text-body transition-colors duration-150 ease-standard focus-visible:focus-ring",
              isSelected
                ? "border-accent font-medium text-label"
                : "border-transparent text-label-secondary hover:text-label",
            )}
          >
            {t(workspaceTabLabels[tab])}
          </button>
        );
      })}
    </div>
  );
}
