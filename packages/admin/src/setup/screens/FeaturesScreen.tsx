import { GroupedList } from "../../design/GroupedList.js";
import { GroupedListRow } from "../../design/GroupedListRow.js";
import { Toggle } from "../../design/Toggle.js";
import { t } from "../../i18n/strings.js";
import type { Plugin } from "../setup.api.js";
import { WizardScreen } from "../WizardScreen.js";

interface FeaturesScreenProps {
  /** Every plugin there is, with the API's own names and descriptions. */
  plugins: readonly Plugin[];
  enabledPlugins: readonly string[];
  onToggle: (pluginId: string, isOn: boolean) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
  /** Which button is saving, so only that one says so. */
  savingAs?: "finish" | "skip";
  statusMessage: string;
}

/** "Choose your features": the plugins the kind of site switched on, ready to adjust. */
export function FeaturesScreen({
  plugins,
  enabledPlugins,
  onToggle,
  onContinue,
  onSkip,
  onBack,
  savingAs,
  statusMessage,
}: FeaturesScreenProps) {
  return (
    <WizardScreen
      title={t("features.title")}
      subtitle={t("features.subtitle")}
      onContinue={onContinue}
      onBack={onBack}
      continueLabel={t("features.finish")}
      isBusy={savingAs !== undefined}
      busyLabel={savingAs === "finish" ? t("features.finishing") : undefined}
      statusMessage={statusMessage}
    >
      <GroupedList footer={t("features.note")}>
        {plugins.map((plugin) => (
          <GroupedListRow
            key={plugin.id}
            label={plugin.name}
            description={plugin.description}
            wrapsText
            accessory={
              <Toggle
                label={plugin.name}
                labelVisibility="hidden"
                checked={enabledPlugins.includes(plugin.id)}
                onCheckedChange={(isOn) => onToggle(plugin.id, isOn)}
              />
            }
          />
        ))}
      </GroupedList>

      <button
        type="button"
        onClick={onSkip}
        disabled={savingAs !== undefined}
        className="mt-8 -ms-1 w-fit rounded-control px-1 text-body text-label-secondary transition-colors duration-150 ease-standard hover:text-label focus-visible:focus-ring disabled:opacity-40"
      >
        {t("features.skip")}
      </button>
    </WizardScreen>
  );
}
