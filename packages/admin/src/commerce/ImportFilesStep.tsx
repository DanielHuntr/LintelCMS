import { FileSpreadsheet } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { t } from "../i18n/strings.js";
import type { ShopifyImport } from "./shopifyImport.api.js";
import { useStartShopifyImport } from "./shopifyImport.queries.js";

type FileKey = "productsCsv" | "customersCsv" | "ordersCsv";

/** Step 1: the CSV files exported from Shopify's admin. Only the products file is needed. */
export function ImportFilesStep({ onRead }: { onRead: (started: ShopifyImport) => void }) {
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const start = useStartShopifyImport();
  const fields = start.error instanceof ApiError ? start.error.fields : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!files.productsCsv) return;
    start.mutate(
      {
        productsCsv: await files.productsCsv.text(),
        ...(files.customersCsv && { customersCsv: await files.customersCsv.text() }),
        ...(files.ordersCsv && { ordersCsv: await files.ordersCsv.text() }),
      },
      { onSuccess: onRead },
    );
  }

  const pick = (key: FileKey) => (file: File | undefined) =>
    setFiles((current) => ({ ...current, [key]: file }));

  return (
    <form onSubmit={(event) => void submit(event)} className="flex max-w-2xl flex-col gap-6">
      <Card title={t("shop.import.filesHeader")}>
        <div className="flex flex-col gap-5">
          <p className="text-body text-label-secondary">{t("shop.import.filesBody")}</p>
          <FilePicker
            label={t("shop.import.productsFile")}
            hint={t("shop.import.productsFileHint")}
            file={files.productsCsv}
            onPick={pick("productsCsv")}
            error={fields?.productsCsv}
          />
          <FilePicker
            label={t("shop.import.customersFile")}
            hint={t("shop.import.customersFileHint")}
            file={files.customersCsv}
            onPick={pick("customersCsv")}
            error={fields?.customersCsv}
          />
          <FilePicker
            label={t("shop.import.ordersFile")}
            hint={t("shop.import.ordersFileHint")}
            file={files.ordersCsv}
            onPick={pick("ordersCsv")}
            error={fields?.ordersCsv}
          />
          <p className="text-footnote text-label-secondary">{t("shop.import.noKeys")}</p>
        </div>
      </Card>
      {start.error && !fields && (
        <p role="alert" className="text-footnote text-danger">
          {describeError(start.error)}
        </p>
      )}
      <div>
        <Button type="submit" disabled={!files.productsCsv || start.isPending}>
          {start.isPending ? t("shop.import.reading") : t("shop.import.read")}
        </Button>
      </div>
    </form>
  );
}

function FilePicker({
  label,
  hint,
  file,
  onPick,
  error,
}: {
  label: string;
  hint: string;
  file: File | undefined;
  onPick: (file: File | undefined) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-footnote font-medium text-label">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <FileSpreadsheet aria-hidden="true" className="size-5 shrink-0 text-label-secondary" />
        <input
          id={id}
          type="file"
          accept=".csv,text/csv"
          aria-describedby={`${id}-hint`}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onPick(event.target.files?.[0])}
          className="min-w-0 flex-1 text-body text-label file:mr-3 file:rounded-control file:border-0 file:bg-accent/14 file:px-3 file:py-1.5 file:text-footnote file:font-medium file:text-accent focus-visible:focus-ring"
        />
      </div>
      <p
        id={`${id}-hint`}
        className={`text-footnote ${error ? "text-danger" : "text-label-secondary"}`}
      >
        {error ?? (file ? t("shop.import.fileChosen", { name: file.name }) : hint)}
      </p>
    </div>
  );
}
