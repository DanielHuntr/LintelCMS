import { TriangleAlert } from "lucide-react";
import { CopyButton } from "../design/CopyButton.js";
import { t } from "../i18n/strings.js";

/** A fresh set of recovery codes, shown once, with a way to copy them all. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 text-footnote text-label-secondary">
        <TriangleAlert
          aria-hidden="true"
          strokeWidth={2}
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        {t("account.twoFactor.codesHint")}
      </p>
      <ol
        aria-label={t("account.twoFactor.codesLabel")}
        className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-control bg-fill p-4 font-mono text-body text-label select-all"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <div>
        <CopyButton value={codes.join("\n")} label={t("account.twoFactor.copyCodes")} />
      </div>
    </div>
  );
}
