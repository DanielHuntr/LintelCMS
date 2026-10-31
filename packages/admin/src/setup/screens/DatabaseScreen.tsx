import { Database, HardDrive } from "lucide-react";
import { useId } from "react";
import { Badge } from "../../design/Badge.js";
import { ChoiceCardGroup, type ChoiceCard } from "../../design/ChoiceCardGroup.js";
import { t } from "../../i18n/strings.js";
import type { DatabaseKind } from "../setup.api.js";
import { WizardScreen } from "../WizardScreen.js";

const databaseChoices: readonly ChoiceCard<DatabaseKind>[] = [
  {
    value: "built-in",
    title: t("database.builtInTitle"),
    description: t("database.builtInDescription"),
    icon: HardDrive,
    accessory: <Badge tone="accent">{t("database.recommended")}</Badge>,
  },
  {
    value: "postgres",
    title: t("database.postgresTitle"),
    description: t("database.postgresDescription"),
    icon: Database,
  },
];

interface DatabaseScreenProps {
  databaseKind: DatabaseKind;
  onDatabaseKindChange: (kind: DatabaseKind) => void;
  /** Picking a tile is the whole question, so a click moves straight on. */
  onChosen: (kind: DatabaseKind) => void;
  onContinue: () => void;
  onBack: () => void;
  isBusy: boolean;
  statusMessage: string;
}

/** "Where should Lintel keep your content?" Built-in or the person's own PostgreSQL. */
export function DatabaseScreen({
  databaseKind,
  onDatabaseKindChange,
  onChosen,
  onContinue,
  onBack,
  isBusy,
  statusMessage,
}: DatabaseScreenProps) {
  const titleId = useId();

  return (
    <WizardScreen
      title={t("database.title")}
      onContinue={onContinue}
      onBack={onBack}
      isBusy={isBusy}
      busyLabel={t("database.saving")}
      statusMessage={statusMessage}
    >
      <span id={titleId} className="sr-only">
        {t("database.title")}
      </span>
      <ChoiceCardGroup
        labelledBy={titleId}
        options={databaseChoices}
        value={databaseKind}
        onChange={onDatabaseKindChange}
        onActivate={onChosen}
        columns={2}
      />
    </WizardScreen>
  );
}
