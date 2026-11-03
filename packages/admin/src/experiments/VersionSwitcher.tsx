import { Link } from "@tanstack/react-router";
import { Copy, FileStack, Plus, Rows3, Settings2, Split } from "lucide-react";
import { Menu, type MenuItem } from "../design/Menu.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import { versionLetter } from "./experimentText.js";
import type { Experiment, VersionKey } from "./experiments.types.js";

interface VersionSwitcherProps {
  experiment: Experiment | null;
  editing: VersionKey;
  onSwitch: (key: VersionKey) => void;
  /** Starts a test with Version B of the whole page, or of the section given. */
  onTry: (sectionId?: string) => void;
  /** The section around the selected element, offered as "Of the selected section only". */
  selectedSectionId: string | null;
  onAdd: (from: VersionKey) => void;
  isWorking: boolean;
}

const toolbarButton =
  "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control px-2 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring aria-expanded:bg-fill disabled:opacity-50";

/**
 * In the page designer's toolbar: "Try another version" before a test exists, then the
 * versions to switch the canvas between (Original, B, C), adding one, and the test's settings.
 */
export function VersionSwitcher(props: VersionSwitcherProps) {
  const { experiment, editing, onSwitch, onTry, selectedSectionId, onAdd, isWorking } = props;

  if (!experiment) {
    const items: MenuItem[] = [
      { label: t("experiments.designer.tryPage"), icon: FileStack, onSelect: () => onTry() },
    ];
    if (selectedSectionId) {
      items.push({
        label: t("experiments.designer.trySection"),
        icon: Rows3,
        onSelect: () => onTry(selectedSectionId),
      });
    }
    return (
      <Menu
        label={t("experiments.designer.try")}
        triggerClassName={toolbarButton}
        trigger={
          <>
            <Split aria-hidden="true" className="size-3.5" />
            {isWorking ? t("experiments.designer.creating") : t("experiments.designer.try")}
          </>
        }
        items={items}
      />
    );
  }

  const keys: VersionKey[] = ["original", ...experiment.versions.map((version) => version.key)];
  const canAdd = keys.length < 3 && experiment.status !== "running";
  return (
    <div className="flex items-center gap-1">
      <SegmentedControl
        label={t("experiments.designer.switcher")}
        options={keys.map((key) => ({ value: key, label: versionLetter(key) }))}
        value={editing}
        onChange={onSwitch}
      />
      {canAdd && (
        <Menu
          label={t("experiments.designer.add")}
          trigger={<Plus aria-hidden="true" className="size-4" />}
          items={[
            {
              label: t("experiments.designer.addFromOriginal"),
              icon: Copy,
              onSelect: () => onAdd("original"),
            },
            { label: t("experiments.designer.addFromB"), icon: Copy, onSelect: () => onAdd("b") },
          ]}
        />
      )}
      <Link
        to="/experiments/$experimentId"
        params={{ experimentId: experiment.id }}
        aria-label={
          experiment.status === "running"
            ? `${t("experiments.designer.settings")}, ${t("experiments.designer.running")}`
            : t("experiments.designer.settings")
        }
        title={t("experiments.designer.settings")}
        className="relative flex size-8 items-center justify-center rounded-control text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring"
      >
        <Settings2 aria-hidden="true" className="size-4" />
        {experiment.status === "running" && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 inset-e-1.5 size-1.5 rounded-full bg-success"
          />
        )}
      </Link>
    </div>
  );
}
