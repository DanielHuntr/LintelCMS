import { Link } from "@tanstack/react-router";
import { Card } from "../design/Card.js";
import { t } from "../i18n/strings.js";
import type { ProductCollection } from "./collections.api.js";

interface ProductCollectionsCardProps {
  /** The hand-picked collections; undefined while they load. */
  collections: readonly ProductCollection[] | undefined;
  chosen: readonly string[];
  onChange: (chosenIds: string[]) => void;
}

/** Which hand-picked collections the product is in; saved with the product. */
export function ProductCollectionsCard({
  collections,
  chosen,
  onChange,
}: ProductCollectionsCardProps) {
  if (!collections) return null;
  return (
    <Card
      title={t("shop.collections.title")}
      accessory={
        <Link to="/commerce/collections" className="text-footnote text-accent">
          {t("shop.collections.manage")}
        </Link>
      }
    >
      {collections.length === 0 ? (
        <p className="text-body text-label-secondary">{t("shop.collections.productCardEmpty")}</p>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{t("shop.collections.title")}</legend>
          {collections.map((collection) => (
            <label key={collection.id} className="flex items-center gap-3 text-body text-label">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={chosen.includes(collection.id)}
                onChange={() =>
                  onChange(
                    chosen.includes(collection.id)
                      ? chosen.filter((id) => id !== collection.id)
                      : [...chosen, collection.id],
                  )
                }
              />
              {collection.title}
            </label>
          ))}
          <p className="text-footnote text-label-secondary">
            {t("shop.collections.productCardHint")}
          </p>
        </fieldset>
      )}
    </Card>
  );
}
