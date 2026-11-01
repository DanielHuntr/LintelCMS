import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { classNames } from "../design/classNames.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { useVisibleContributions } from "./AdminPluginsContext.js";

interface SectionTabsProps {
  /** The section's path, which plugins name in their `dashboardTabs`: "/" or "/content". */
  section: string;
  /** The section's own screen: always the first tab, "Overview". */
  children: ReactNode;
}

/**
 * A section's landing screen with the tabs plugins add to it. Without any, it is just the
 * section's own screen. The tabs follow the ARIA tabs pattern: Tab moves into the row once,
 * the arrow keys (and Home and End) move between tabs, and the panel follows.
 */
export function SectionTabs({ section, children }: SectionTabsProps) {
  const pluginTabs = useVisibleContributions("dashboardTabs").filter(
    (tab) => tab.section === section,
  );
  const [selectedKey, setSelectedKey] = useState("overview");
  const baseId = useId();
  const tabElements = useRef(new Map<string, HTMLButtonElement>());

  if (pluginTabs.length === 0) return children;

  const tabs = [
    { key: "overview", label: t("plugins.overviewTab") },
    ...pluginTabs.map((tab) => ({ key: `${tab.pluginId}:${tab.id}`, label: tab.label })),
  ];
  const selected = tabs.some((tab) => tab.key === selectedKey) ? selectedKey : "overview";
  const selectedPluginTab = pluginTabs.find((tab) => `${tab.pluginId}:${tab.id}` === selected);

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
    setSelectedKey(tab.key);
    tabElements.current.get(tab.key)?.focus();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label={t("plugins.sectionTabsLabel")}
        className="mb-6 flex w-fit gap-1 rounded-full bg-fill/70 p-1"
      >
        {tabs.map((tab, index) => {
          const isSelected = tab.key === selected;
          return (
            <button
              key={tab.key}
              ref={(element) => {
                if (element) tabElements.current.set(tab.key, element);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${index}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelectedKey(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={classNames(
                "h-8 rounded-full px-4 text-footnote font-medium transition-colors duration-150 ease-standard focus-visible:focus-ring",
                isSelected
                  ? "bg-segment text-label shadow-thumb"
                  : "text-label-secondary hover:text-label",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${tabs.findIndex((tab) => tab.key === selected)}`}
      >
        {selectedPluginTab ? (
          <>
            <LargeTitle title={selectedPluginTab.label} />
            <selectedPluginTab.component />
          </>
        ) : (
          children
        )}
      </div>
    </>
  );
}
