import type { StringKey } from "../i18n/strings.js";

export const workspaceTabs = ["content", "children", "settings", "history", "info"] as const;
export type WorkspaceTab = (typeof workspaceTabs)[number];

export const workspaceTabLabels: Record<WorkspaceTab, StringKey> = {
  content: "workspace.tab.content",
  children: "workspace.tab.children",
  settings: "workspace.tab.settings",
  history: "workspace.tab.history",
  info: "workspace.tab.info",
};

/** A tab name from the address, or undefined for one that isn't a tab. */
export function readWorkspaceTab(value: unknown): WorkspaceTab | undefined {
  return workspaceTabs.find((tab) => tab === value);
}

/**
 * The tabs an entry's workspace shows. "Items" appears when its children are listed in the
 * workspace instead of the tree. Blueprints don't group fields into tabs yet; when they do,
 * their groups go where "content" is.
 */
export function visibleWorkspaceTabs(options: { listsChildren: boolean }): WorkspaceTab[] {
  return workspaceTabs.filter((tab) => tab !== "children" || options.listsChildren);
}
