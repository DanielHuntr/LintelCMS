import { useState } from "react";
import { Card } from "../design/Card.js";
import { SearchField } from "../design/SearchField.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { AmountsByCurrencyFields } from "./AmountsByCurrencyFields.js";
import type { DiscountDraft } from "./discountDraft.js";
import type { DiscountScope } from "./discounts.api.js";
import { useProductCollections } from "./discounts.queries.js";
import { useProducts } from "./shop.queries.js";

interface SectionProps {
  draft: DiscountDraft;
  onChange: (changes: Partial<DiscountDraft>) => void;
  errors: Record<string, string>;
  currencies: readonly string[];
}

/** What the discount is for (everything, some products, some collections) and its minimums. */
export function DiscountScopeSection({ draft, onChange, errors, currencies }: SectionProps) {
  return (
    <>
      <Card title={t("shop.discounts.forHeader")}>
        <div className="flex flex-col gap-4">
          <SegmentedControl<DiscountScope>
            label={t("shop.discounts.forHeader")}
            value={draft.scope}
            onChange={(scope) => onChange({ scope })}
            options={[
              { value: "order", label: t("shop.discounts.scope.order") },
              { value: "products", label: t("shop.discounts.scope.products") },
              { value: "collections", label: t("shop.discounts.scope.collections") },
            ]}
          />
          {draft.scope === "products" && (
            <ProductPicker
              chosen={draft.productIds}
              onChange={(productIds) => onChange({ productIds })}
              error={errors.productIds}
            />
          )}
          {draft.scope === "collections" && (
            <CollectionPicker
              chosen={draft.collectionIds}
              onChange={(collectionIds) => onChange({ collectionIds })}
              error={errors.collectionIds}
            />
          )}
        </div>
      </Card>

      <Card title={t("shop.discounts.minimumHeader")}>
        <div className="flex flex-col gap-4">
          <SegmentedControl<DiscountDraft["minimum"]>
            label={t("shop.discounts.minimumHeader")}
            value={draft.minimum}
            onChange={(minimum) => onChange({ minimum })}
            options={[
              { value: "none", label: t("shop.discounts.minimum.none") },
              { value: "spend", label: t("shop.discounts.minimum.spend") },
              { value: "quantity", label: t("shop.discounts.minimum.quantity") },
            ]}
          />
          {draft.minimum === "spend" && (
            <AmountsByCurrencyFields
              label={t("shop.discounts.minimumSpendLabel")}
              hint={
                draft.scope === "order"
                  ? t("shop.discounts.minimumSpendHint")
                  : t("shop.discounts.minimumSpendScopedHint")
              }
              currencies={currencies}
              values={draft.minimumSpendTexts}
              onChange={(minimumSpendTexts) => onChange({ minimumSpendTexts })}
              error={errors.minimumSpend}
            />
          )}
          {draft.minimum === "quantity" && (
            <TextField
              label={t("shop.discounts.minimumQuantityLabel")}
              inputMode="numeric"
              value={draft.minimumQuantityText}
              onChange={(event) => onChange({ minimumQuantityText: event.target.value })}
              error={errors.minimumQuantity}
            />
          )}
        </div>
      </Card>
    </>
  );
}

interface PickerProps {
  chosen: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}

function toggled(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function ProductPicker({ chosen, onChange, error }: PickerProps) {
  const [search, setSearch] = useState("");
  const products = useProducts({ search: search || undefined });
  return (
    <fieldset
      className="flex flex-col gap-3"
      aria-describedby={error ? "products-error" : undefined}
    >
      <legend className="mb-1 text-footnote font-medium text-label">
        {t("shop.discounts.chooseProducts", { count: chosen.length })}
      </legend>
      <SearchField label={t("shop.products.search")} value={search} onValueChange={setSearch} />
      <ul className="flex max-h-64 flex-col overflow-y-auto rounded-control bg-fill/40">
        {(products.data?.items ?? []).map((product) => (
          <li key={product.id}>
            <label className="flex items-center gap-3 px-3 py-2 text-body text-label">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={chosen.includes(product.id)}
                onChange={() => onChange(toggled(chosen, product.id))}
              />
              {product.title}
            </label>
          </li>
        ))}
      </ul>
      {error && (
        <p id="products-error" className="text-footnote text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function CollectionPicker({ chosen, onChange, error }: PickerProps) {
  const collections = useProductCollections();
  if (collections.data?.length === 0) {
    return <p className="text-body text-label-secondary">{t("shop.discounts.noCollections")}</p>;
  }
  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={error ? "collections-error" : undefined}
    >
      <legend className="mb-1 text-footnote font-medium text-label">
        {t("shop.discounts.chooseCollections")}
      </legend>
      {(collections.data ?? []).map((collection) => (
        <label key={collection.id} className="flex items-center gap-3 text-body text-label">
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={chosen.includes(collection.id)}
            onChange={() => onChange(toggled(chosen, collection.id))}
          />
          {collection.title}
          <span className="text-footnote text-label-secondary">
            {t("shop.discounts.collectionCount", { count: collection.productCount })}
          </span>
        </label>
      ))}
      {error && (
        <p id="collections-error" className="text-footnote text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
