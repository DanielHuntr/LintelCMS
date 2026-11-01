import { useState } from "react";
import { NameSheet } from "../content/NameSheet.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";

interface MenuSettingsSheetProps {
  title: string;
  description?: string;
  submitLabel: string;
  initialName?: string;
  initialMaxDepth?: number;
  showsHandle?: boolean;
  onSubmit: (name: string, handle: string, maxDepth: number) => Promise<void>;
  onClose: () => void;
}

type Levels = "1" | "2" | "3";

/** A menu's name and how many levels it has: flat for a footer, drop-downs for a main menu. */
export function MenuSettingsSheet({
  initialMaxDepth = 2,
  onSubmit,
  ...sheet
}: MenuSettingsSheetProps) {
  const [levels, setLevels] = useState<Levels>(
    String(Math.min(Math.max(initialMaxDepth, 1), 3)) as Levels,
  );

  return (
    <NameSheet
      open
      nameLabel={t("menus.name")}
      onSubmit={(name, handle) => onSubmit(name, handle, Number(levels))}
      {...sheet}
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-footnote font-medium text-label">{t("menus.levelsLabel")}</p>
        <SegmentedControl<Levels>
          label={t("menus.levelsLabel")}
          options={[
            { value: "1", label: t("menus.levels.flat") },
            { value: "2", label: t("menus.levels.two") },
            { value: "3", label: t("menus.levels.three") },
          ]}
          value={levels}
          onChange={setLevels}
        />
        <p className="text-footnote text-label-secondary">{t("menus.levelsHint")}</p>
      </div>
    </NameSheet>
  );
}
