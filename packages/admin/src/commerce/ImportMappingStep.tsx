import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t, type StringKey } from "../i18n/strings.js";
import { ImportReportView } from "./ImportReportView.js";
import type { ImportOptions, ShopifyImport } from "./shopifyImport.api.js";
import { useDryRun, useRunBatch, useSaveImportOptions } from "./shopifyImport.queries.js";

const FIELD_NAMES: Record<string, StringKey> = {
  handle: "shop.import.field.handle",
  title: "shop.import.field.title",
  description: "shop.import.field.description",
  vendor: "shop.import.field.vendor",
  productType: "shop.import.field.productType",
  tags: "shop.import.field.tags",
  status: "shop.import.field.status",
  options: "shop.import.field.options",
  sku: "shop.import.field.sku",
  weight: "shop.import.field.weight",
  trackStock: "shop.import.field.trackStock",
  stock: "shop.import.field.stock",
  price: "shop.import.field.price",
  compareAtPrice: "shop.import.field.compareAtPrice",
  barcode: "shop.import.field.barcode",
  photos: "shop.import.field.photos",
  seoTitle: "shop.import.field.seoTitle",
  seoDescription: "shop.import.field.seoDescription",
  collections: "shop.import.field.collections",
  giftCard: "shop.import.field.giftCard",
  name: "shop.import.field.name",
  email: "shop.import.field.email",
  phone: "shop.import.field.phone",
  address: "shop.import.field.address",
  note: "shop.import.field.note",
  orderNumber: "shop.import.field.orderNumber",
  currency: "shop.import.field.currency",
  paymentStatus: "shop.import.field.paymentStatus",
  fulfilmentStatus: "shop.import.field.fulfilmentStatus",
  totals: "shop.import.field.totals",
  discounts: "shop.import.field.discounts",
  placedAt: "shop.import.field.placedAt",
  items: "shop.import.field.items",
  shippingAddress: "shop.import.field.shippingAddress",
};

/** Step 2: what's in the files, where each column goes, and the choices before starting. */
export function ImportMappingStep({ job }: { job: ShopifyImport }) {
  const save = useSaveImportOptions(job.id);
  const dryRun = useDryRun(job.id);
  const run = useRunBatch(job.id);
  const options = job.options;
  const change = (changes: Partial<ImportOptions>) => save.mutate({ ...options, ...changes });
  const productColumns = job.mapping.filter((item) => item.file === "products");
  const grouped = new Map<string, string[]>();
  for (const item of job.mapping) {
    const key = `${item.file}:${item.field}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item.column]);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card title={t("shop.import.previewHeader")}>
        <p className="text-body text-label">
          {t("shop.import.previewCounts", {
            products: job.counts.products,
            variants: job.counts.variants,
            images: job.counts.images,
            customers: job.counts.customers,
            orders: job.counts.orders,
          })}
        </p>
        <ul className="mt-4 flex flex-col divide-y divide-separator">
          {job.samples.map((sample) => (
            <li key={sample.handle} className="flex justify-between gap-3 py-2 text-body">
              <span className="text-label">{sample.title}</span>
              <span className="text-label-secondary tabular-nums">
                {t("shop.import.sample", {
                  variants: sample.variants,
                  images: sample.images,
                  price: sample.price,
                  currency: job.currency ?? "",
                })}
              </span>
            </li>
          ))}
        </ul>
        {job.warnings.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1 rounded-control bg-warning/10 px-4 py-3 text-footnote text-label">
            {job.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("shop.import.mappingHeader")}>
        <p className="mb-3 text-body text-label-secondary">{t("shop.import.mappingBody")}</p>
        <table className="w-full text-left text-body">
          <thead>
            <tr className="text-footnote text-label-secondary">
              <th scope="col" className="pb-2 font-medium">
                {t("shop.import.mappingShopify")}
              </th>
              <th scope="col" className="pb-2 font-medium">
                {t("shop.import.mappingLintel")}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...grouped.entries()].map(([key, columns]) => {
              const field = key.split(":")[1] ?? "";
              const name = FIELD_NAMES[field];
              return (
                <tr key={key} className="border-t border-separator">
                  <td className="py-1.5 pr-3 text-label-secondary">{columns.join(", ")}</td>
                  <td className="py-1.5 text-label">{name ? t(name) : field}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {job.notImported.length > 0 && (
          <p className="mt-4 text-footnote text-label-secondary">
            {t("shop.import.notImported", {
              columns: job.notImported.map((item) => item.column).join(", "),
            })}
          </p>
        )}
        {productColumns.length === 0 && (
          <p className="mt-3 text-footnote text-danger">{t("shop.import.nothingMapped")}</p>
        )}
      </Card>

      <Card title={t("shop.import.choicesHeader")}>
        <div className="flex flex-col gap-5">
          <SegmentedControl<"keep" | "draft">
            label={t("shop.import.statusLabel")}
            value={options.productStatus}
            onChange={(productStatus) => change({ productStatus })}
            options={[
              { value: "keep", label: t("shop.import.statusKeep") },
              { value: "draft", label: t("shop.import.statusDraft") },
            ]}
          />
          <p className="-mt-3 text-footnote text-label-secondary">
            {options.productStatus === "keep"
              ? t("shop.import.statusKeepHint")
              : t("shop.import.statusDraftHint")}
          </p>
          <Toggle
            label={t("shop.import.photos")}
            checked={options.importImages}
            onCheckedChange={(importImages) => change({ importImages })}
          />
          {job.counts.collectionsInFile.length > 0 && (
            <Toggle
              label={t("shop.import.collectionsColumn", {
                names: job.counts.collectionsInFile.slice(0, 3).join(", "),
              })}
              checked={options.collectionsFromColumn}
              onCheckedChange={(collectionsFromColumn) => change({ collectionsFromColumn })}
            />
          )}
          {job.counts.tags.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-footnote font-medium text-label">
                {t("shop.import.tagsLegend")}
              </legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {job.counts.tags.slice(0, 30).map(({ tag, products }) => (
                  <label key={tag} className="flex items-center gap-2 text-body text-label">
                    <input
                      type="checkbox"
                      className="size-4 accent-accent"
                      checked={options.tagCollections.includes(tag)}
                      onChange={() =>
                        change({
                          tagCollections: options.tagCollections.includes(tag)
                            ? options.tagCollections.filter((item) => item !== tag)
                            : [...options.tagCollections, tag],
                        })
                      }
                    />
                    {tag}
                    <span className="text-footnote text-label-secondary">({products})</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {job.files.customers && (
            <Toggle
              label={t("shop.import.customers", { count: job.counts.customers })}
              checked={options.importCustomers}
              onCheckedChange={(importCustomers) => change({ importCustomers })}
            />
          )}
          {job.files.orders && (
            <div className="flex flex-col gap-1">
              <Toggle
                label={t("shop.import.orders", { count: job.counts.orders })}
                checked={options.importOrders}
                onCheckedChange={(importOrders) => change({ importOrders })}
              />
              <p className="text-footnote text-label-secondary">{t("shop.import.ordersHint")}</p>
            </div>
          )}
          <TextField
            label={t("shop.import.pathLabel")}
            hint={t("shop.import.pathHint")}
            defaultValue={options.productPathPrefix}
            onBlur={(event) => {
              if (event.target.value !== options.productPathPrefix) {
                change({ productPathPrefix: event.target.value });
              }
            }}
          />
          {save.error && (
            <p role="alert" className="text-footnote text-danger">
              {describeError(save.error)}
            </p>
          )}
        </div>
      </Card>

      {job.dryRunReport && (
        <Card title={t("shop.import.dryRunHeader")}>
          <p className="mb-4 text-body text-label-secondary">{t("shop.import.dryRunBody")}</p>
          <ImportReportView report={job.dryRunReport} wouldHappen />
        </Card>
      )}

      {(dryRun.error || run.error) && (
        <p role="alert" className="text-footnote text-danger">
          {describeError(dryRun.error ?? run.error)}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="tinted" disabled={dryRun.isPending} onClick={() => dryRun.mutate()}>
          {dryRun.isPending ? t("shop.import.dryRunning") : t("shop.import.dryRun")}
        </Button>
        <Button disabled={run.isPending || save.isPending} onClick={() => run.mutate()}>
          {t("shop.import.start")}
        </Button>
      </div>
    </div>
  );
}
