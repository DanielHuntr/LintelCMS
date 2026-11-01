import type { EditorPanelProps } from "./adminPlugin.js";
import { useVisibleContributions } from "./AdminPluginsContext.js";

/** The entry editor's side-panel sections from plugins (SEO's Search engines, say). */
export function PluginEditorPanels(props: EditorPanelProps) {
  const panels = useVisibleContributions("editorPanels");
  return panels.map(({ pluginId, id, component: Panel }) => (
    <Panel key={`${pluginId}:${id}`} {...props} />
  ));
}
