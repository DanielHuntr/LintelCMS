import { Card } from "../design/Card.js";
import { t, type StringKey } from "../i18n/strings.js";
import { CommandList } from "./CommandList.js";
import { TextWithCode } from "./InlineCode.js";
import type { UpdateMethod } from "./updates.api.js";

/**
 * How this copy of Lintel is updated, worked out by the API from how it was installed, in
 * plain words, with the commands to run where the button can't do it.
 */
export function UpdateMethodCard({ method, version }: { method: UpdateMethod; version: string }) {
  const docker = method.installType === "docker";
  const explanation: StringKey =
    docker && method.oneClick
      ? "updates.method.dockerUpdater"
      : `updates.method.${method.installType}`;
  return (
    <Card title={t("updates.methodTitle")}>
      <div className="flex flex-col gap-3">
        <p className="text-body text-label">
          <TextWithCode text={t(explanation)} />
        </p>
        <CommandList commands={method.commands} version={version} />
        {docker && !method.oneClick && (
          <p className="text-footnote text-label-secondary">
            {t("updates.method.dockerUpdaterOffer")}
          </p>
        )}
      </div>
    </Card>
  );
}
