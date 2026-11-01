import { CircleCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t, type StringKey } from "../i18n/strings.js";
import {
  type ConflictStrategy,
  type ImportKind,
  type ImportPlan,
  previewContentImport,
  runContentImport,
  uploadFiles,
} from "./dataTools.api.js";
import { FilePicker } from "./FilePicker.js";

type Step =
  | { name: "choose" }
  | { name: "preview"; uploadId: string; plan: ImportPlan }
  | { name: "done"; plan: ImportPlan };

/**
 * Importing a Lintel export: upload it, see what will be added, updated or kept, choose
 * what happens to things already here, then import.
 */
export function LintelImportCard() {
  const [step, setStep] = useState<Step>({ name: "choose" });
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attempt(work: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await work();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const upload = (file: File) =>
    attempt(async () => {
      setProgress(0);
      const uploaded = await uploadFiles<{ uploadId: string; plan: ImportPlan }>(
        "/content-imports",
        { file },
        setProgress,
      );
      setStep({ name: "preview", ...uploaded });
    });

  const changeStrategy = (uploadId: string, strategy: ConflictStrategy) =>
    attempt(async () => {
      setStep({ name: "preview", uploadId, plan: await previewContentImport(uploadId, strategy) });
    });

  const runImport = (uploadId: string, strategy: ConflictStrategy) =>
    attempt(async () => {
      setStep({ name: "done", plan: await runContentImport(uploadId, strategy) });
    });

  return (
    <Card title={t("import.lintelTitle")}>
      {step.name === "choose" && (
        <>
          <p className="mb-4 text-body text-label-secondary">{t("import.lintelDescription")}</p>
          <FilePicker
            label={t("import.fileLabel")}
            accept=".zip,.json,application/zip,application/json"
            disabled={busy}
            onPick={(file) => void upload(file)}
          />
          {progress !== null && (
            <p role="status" className="mt-2 text-footnote text-label-secondary">
              {progress < 1
                ? t("import.uploading", { percent: Math.round(progress * 100) })
                : t("import.checking")}
            </p>
          )}
        </>
      )}
      {step.name === "preview" && (
        <div className="flex flex-col gap-4">
          <SegmentedControl
            label={t("import.strategyLabel")}
            options={[
              { value: "skip", label: t("import.strategy.skip") },
              { value: "overwrite", label: t("import.strategy.overwrite") },
            ]}
            value={step.plan.strategy}
            onChange={(strategy) => void changeStrategy(step.uploadId, strategy)}
          />
          <h3 className="text-headline text-label">{t("import.previewTitle")}</h3>
          <PlanTable plan={step.plan} />
          <Warnings warnings={step.plan.warnings} />
          <div>
            <Button disabled={busy} onClick={() => void runImport(step.uploadId, step.plan.strategy)}>
              {busy ? t("import.running") : t("import.run")}
            </Button>
          </div>
        </div>
      )}
      {step.name === "done" && (
        <div className="flex flex-col gap-4">
          <p role="status" className="flex items-center gap-2 text-body text-label">
            <CircleCheck aria-hidden="true" className="size-5 text-success" />
            {t("import.doneTitle")}.{" "}
            {t("import.doneText", {
              created: sum(step.plan, "create"),
              updated: sum(step.plan, "update"),
            })}
          </p>
          <PlanTable plan={step.plan} />
          <div>
            <Button variant="tinted" onClick={() => setStep({ name: "choose" })}>
              {t("import.another")}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-footnote text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}

function sum(plan: ImportPlan, action: "create" | "update" | "skip"): number {
  return Object.values(plan.totals).reduce((total, counts) => total + counts[action], 0);
}

export function PlanTable({ plan }: { plan: ImportPlan }) {
  const rows = (Object.entries(plan.totals) as Array<[ImportKind, ImportPlan["totals"][ImportKind]]>).filter(
    ([, counts]) => counts.create + counts.update + counts.skip > 0,
  );
  if (rows.length === 0 || sum(plan, "create") + sum(plan, "update") === 0) {
    return <p className="text-body text-label-secondary">{t("import.nothingToDo")}</p>;
  }
  return (
    <table className="w-full text-left text-body text-label">
      <thead className="text-footnote text-label-secondary">
        <tr>
          <th scope="col" className="pb-2 font-medium">{t("import.column.what")}</th>
          <th scope="col" className="pb-2 text-right font-medium">{t("import.column.create")}</th>
          <th scope="col" className="pb-2 text-right font-medium">{t("import.column.update")}</th>
          <th scope="col" className="pb-2 text-right font-medium">{t("import.column.skip")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([kind, counts]) => (
          <tr key={kind} className="hairline-top">
            <th scope="row" className="py-2 font-normal">{t(`import.kind.${kind}` as StringKey)}</th>
            <td className="py-2 text-right tabular-nums">{counts.create}</td>
            <td className="py-2 text-right tabular-nums">{counts.update}</td>
            <td className="py-2 text-right tabular-nums text-label-secondary">{counts.skip}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-footnote text-label-secondary">
      {warnings.map((warning) => (
        <li key={warning} className="flex items-start gap-2">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          {warning}
        </li>
      ))}
    </ul>
  );
}
