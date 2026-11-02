import { Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { apiUrl } from "../api/client.js";
import { t } from "../i18n/strings.js";
import { formatMoney } from "./money.js";
import { priceRangeText, type ProductSummary } from "./products.api.js";
import { ProductStatusBadge } from "./ProductStatusBadge.js";

/**
 * The shop's products as owners expect to scan them: a photo, the name, whether it's on
 * sale, its price and its stock, across the page. On a phone, price and stock fold under the
 * name. The name is the link, stretched over the whole row.
 */
export function ProductsTable({
  products,
  total,
}: {
  products: readonly ProductSummary[];
  total: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-card bg-surface">
        <table className="w-full text-start text-body">
          <caption className="sr-only">{t("shop.products.title")}</caption>
          <thead className="text-footnote text-label-secondary max-sm:sr-only">
            <tr className="hairline-bottom">
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("shop.products.column.product")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("shop.products.column.status")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-medium max-sm:hidden">
                {t("shop.products.column.price")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-medium max-sm:hidden">
                {t("shop.products.column.stock")}
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const price = priceRangeText(product.priceRange, formatMoney);
              const stock =
                product.available === null
                  ? t("shop.products.notTracked")
                  : t("shop.products.inStock", { count: product.available });
              return (
                <tr
                  key={product.id}
                  className="relative hairline-top first:border-t-0 hover:bg-fill/50 focus-within:bg-fill/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductPhoto imageId={product.imageId} />
                      <div className="flex min-w-0 flex-col">
                        <Link
                          to="/commerce/products/$productId"
                          params={{ productId: product.id }}
                          className="truncate font-medium text-label after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:focus-ring-inset"
                        >
                          {product.title}
                        </Link>
                        <span className="truncate text-footnote text-label-secondary">
                          <span className="sm:hidden">
                            {[price ?? t("shop.products.noPrice"), stock].join(" · ")}
                          </span>
                          <span className="max-sm:hidden">
                            {t("shop.products.variantCount", { count: product.variantCount })}
                          </span>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ProductStatusBadge status={product.status} available={product.available} />
                  </td>
                  <td className="px-4 py-3 text-end whitespace-nowrap tabular-nums max-sm:hidden">
                    {price ?? (
                      <span className="text-label-secondary">{t("shop.products.noPrice")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end whitespace-nowrap text-label-secondary tabular-nums max-sm:hidden">
                    {stock}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 text-footnote text-label-secondary">
        {t("shop.products.count", { count: total })}
      </p>
    </div>
  );
}

/** The product's first photo, small and square; a neutral tile when it has none. */
function ProductPhoto({ imageId }: { imageId: string | null }) {
  if (!imageId) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-fill text-label-tertiary">
        <Package aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </span>
    );
  }
  const source = `${apiUrl}/media/${encodeURIComponent(imageId)}/file?w=80&h=80&fit=cover`;
  return <img src={source} alt="" className="size-10 shrink-0 rounded-control object-cover" />;
}
