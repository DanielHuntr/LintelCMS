import { Card } from "../design/Card.js";
import { controlClasses } from "../design/controlStyles.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { ProductDraft } from "./productDraft.js";
import type { ProductStatus } from "./products.api.js";

interface SectionProps {
  draft: ProductDraft;
  onChange: (changes: Partial<ProductDraft>) => void;
  errors: Record<string, string>;
}

/** Whether it's on sale, how it's grouped, and how it looks in search results. */
export function ProductOrganisationSection({ draft, onChange, errors }: SectionProps) {
  const statusHint = {
    active: t("shop.products.statusActiveHint"),
    draft: t("shop.products.statusDraftHint"),
    archived: t("shop.products.statusArchivedHint"),
  }[draft.status];

  return (
    <>
      <Card title={t("shop.products.statusHeader")}>
        <div className="flex flex-col gap-2">
          <SegmentedControl<ProductStatus>
            label={t("shop.products.statusHeader")}
            value={draft.status}
            onChange={(status) => onChange({ status })}
            options={[
              { value: "draft", label: t("shop.status.draft") },
              { value: "active", label: t("shop.status.active") },
              { value: "archived", label: t("shop.status.archived") },
            ]}
          />
          <p className="text-footnote text-label-secondary">{statusHint}</p>
        </div>
      </Card>

      <Card title={t("shop.products.organisationHeader")}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            label={t("shop.products.vendorLabel")}
            hint={t("shop.products.vendorHint")}
            value={draft.vendor}
            onChange={(event) => onChange({ vendor: event.target.value })}
          />
          <TextField
            label={t("shop.products.typeLabel")}
            hint={t("shop.products.typeHint")}
            value={draft.productType}
            onChange={(event) => onChange({ productType: event.target.value })}
          />
          <TextField
            className="sm:col-span-2"
            label={t("shop.products.tagsLabel")}
            hint={t("shop.products.tagsHint")}
            value={draft.tags}
            onChange={(event) => onChange({ tags: event.target.value })}
          />
        </div>
      </Card>

      <Card title={t("shop.products.seoHeader")}>
        <div className="flex flex-col gap-5">
          <TextField
            label={t("shop.products.seoTitleLabel")}
            hint={t("shop.products.seoTitleHint")}
            value={draft.seoTitle}
            maxLength={200}
            onChange={(event) => onChange({ seoTitle: event.target.value })}
          />
          <SeoDescriptionField
            value={draft.seoDescription}
            onChange={(seoDescription) => onChange({ seoDescription })}
          />
          <TextField
            label={t("shop.products.handleLabel")}
            hint={t("shop.products.handleHint")}
            value={draft.handle}
            onChange={(event) => onChange({ handle: event.target.value.toLowerCase() })}
            error={errors.handle}
          />
        </div>
      </Card>
    </>
  );
}

function SeoDescriptionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="product-seo-description" className="text-footnote font-medium text-label">
        {t("shop.products.seoDescriptionLabel")}
      </label>
      <textarea
        id="product-seo-description"
        aria-describedby="product-seo-description-hint"
        rows={3}
        maxLength={500}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${controlClasses()} py-2`}
      />
      <p id="product-seo-description-hint" className="text-footnote text-label-secondary">
        {t("shop.products.seoDescriptionHint")}
      </p>
    </div>
  );
}
