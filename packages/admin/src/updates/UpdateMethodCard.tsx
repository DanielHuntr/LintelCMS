import { Card } from "../design/Card.js";
import { t, type StringKey } from "../i18n/strings.js";
import { CommandList } from "./CommandList.js";
import { TextWithCode } from "./InlineCode.js";
import type { UpdateMethod } from "./updates.api.js";

/**
 * How this copy of Lintel is updated, worked out by the API from how it was installed, in
 * plain words, with the commands to run where the button can't do it.
 */
export function UpdateMethodCard({
  method,
  version,
}: {
  method: UpdateMethod;
  /** The version to update to; null when there's nothing newer (LINTEL-LEFT-007). */
  version: string | null;
}) {
  const docker = method.installType === "docker";
  const explanation: StringKey =
    docker && method.oneClick
      ? "updates.method.dockerUpdater"
      : `updates.method.${method.installType}`;
  // "Update to the version you're on" is no use, so commands that need a version wait.
  const commands =
    version === null
      ? method.commands.filter((command) => !command.includes("{version}"))
      : method.commands;
  const waitsForVersion = commands.length < method.commands.length;
  return (
    <Card title={t("updates.methodTitle")}>
      <div className="flex flex-col gap-3">
        <p className="text-body text-label">
          <TextWithCode text={t(explanation)} />
        </p>
        <CommandList commands={commands} version={version ?? ""} />
        {waitsForVersion && (
          <p className="text-footnote text-label-secondary">{t("updates.method.noNewerVersion")}</p>
        )}
        {docker && !method.oneClick && (
          <p className="text-footnote text-label-secondary">
            {t("updates.method.dockerUpdaterOffer")}
          </p>
        )}
      </div>
    </Card>
  );
}
