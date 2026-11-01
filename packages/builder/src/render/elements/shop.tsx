import {
  addToCartComponent,
  cartContentsComponent,
  cartDrawerComponent,
  checkoutButtonComponent,
  formatMoney,
  orderConfirmationComponent,
  productAsItem,
  productCardComponent,
  productGalleryComponent,
  productGridComponent,
  productPriceComponent,
  type ShopProduct,
  variantPickerComponent,
} from "@lintel/builder-model";
import { scriptSafeJson } from "@lintel/site-components";
import { drawsProps, type RenderMode } from "../component-registry.js";
import { usePageData, useProduct } from "../data-context.js";
import { cx } from "./behaviour-types.js";
import { Pagination, RepeatedItems } from "./collections.js";
import { gridClasses } from "./layout.js";
import { SiteIcon } from "./media.js";
import { useSite } from "./navigation.js";

/**
 * The shop's elements. The page holds what doesn't change (names, pictures, prices); the
 * elements script keeps the basket in the browser (by the storefront API's cart token) and
 * keeps the options picker, price and Add to basket button of one product in step.
 */

/** A product to show on the canvas before the shop has any. */
export const sampleProduct: ShopProduct = {
  id: "sample",
  handle: "sample-product",
  title: "Linen shirt",
  descriptionHtml: "<p>Cool and soft, for warm days.</p>",
  url: "/products/sample-product",
  images: [],
  options: [{ name: "Size", values: ["S", "M", "L"] }],
  priceRange: { min: { amount: 4500, currency: "GBP" }, max: { amount: 4500, currency: "GBP" } },
  availableForSale: true,
  variants: ["S", "M", "L"].map((size) => ({
    id: `sample-${size}`,
    title: size,
    optionValues: [size],
    price: { amount: 4500, currency: "GBP" },
    compareAtPrice: size === "M" ? { amount: 6000, currency: "GBP" } : null,
    availableForSale: size !== "L",
  })),
};

function useShownProduct(handle: string, mode: RenderMode): ShopProduct | undefined {
  const product = useProduct(handle);
  return product ?? (mode === "canvas" ? sampleProduct : undefined);
}

function firstAvailableVariant(product: ShopProduct) {
  return product.variants.find((variant) => variant.availableForSale) ?? product.variants[0];
}

/** The variants as data for the script: which options make which variant, at what price. */
function VariantData({ product }: { product: ShopProduct }) {
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    optionValues: variant.optionValues,
    price: variant.price ? formatMoney(variant.price) : null,
    compareAtPrice: variant.compareAtPrice ? formatMoney(variant.compareAtPrice) : null,
    availableForSale: variant.availableForSale,
  }));
  return (
    <script
      type="application/json"
      data-product-variants={product.handle}
      dangerouslySetInnerHTML={{ __html: scriptSafeJson(variants) }}
    />
  );
}

export function PriceText({ product, showSaving }: { product: ShopProduct; showSaving: boolean }) {
  const variant = firstAvailableVariant(product);
  const price = variant?.price ?? product.priceRange?.min ?? null;
  const compareAt = variant?.compareAtPrice ?? null;
  const varies =
    product.priceRange !== null && product.priceRange.min.amount !== product.priceRange.max.amount;
  if (!price) return null;
  const saving =
    compareAt && compareAt.amount > price.amount
      ? Math.round((1 - price.amount / compareAt.amount) * 100)
      : 0;
  return (
    <p className="lintel-price" data-price-for={product.handle}>
      <span className="lintel-price__now" data-price="now">
        {varies && !variant ? `From ${formatMoney(price)}` : formatMoney(price)}
      </span>
      <s
        className="lintel-price__was"
        data-price="was"
        hidden={!compareAt || saving === 0 || undefined}
      >
        <span className="lintel-visually-hidden">Was </span>
        <span data-price="was-amount">{compareAt ? formatMoney(compareAt) : ""}</span>
      </s>
      {showSaving && (
        <span
          className="lintel-price__saving"
          data-price="saving"
          hidden={saving === 0 || undefined}
        >
          {saving > 0 ? `Save ${saving}%` : ""}
        </span>
      )}
    </p>
  );
}

function AddToCartForm({
  product,
  label,
  soldOutLabel,
  showQuantity,
  opensCart,
  formId,
}: {
  product: ShopProduct;
  label: string;
  soldOutLabel: string;
  showQuantity: boolean;
  opensCart: boolean;
  formId: string;
}) {
  const variant = firstAvailableVariant(product);
  const soldOut = !product.availableForSale || !variant?.availableForSale;
  return (
    <form
      className="lintel-add-to-cart"
      data-behaviour="add-to-cart"
      data-product={product.handle}
      data-opens-cart={opensCart ? "" : undefined}
      data-sold-out-label={soldOutLabel}
      data-label={label}
    >
      <input type="hidden" name="variantId" value={variant?.id ?? ""} />
      {showQuantity && (
        <span className="lintel-add-to-cart__quantity">
          <label htmlFor={`${formId}-quantity`}>Quantity</label>
          <input
            id={`${formId}-quantity`}
            type="number"
            name="quantity"
            min={1}
            max={99}
            defaultValue={1}
            inputMode="numeric"
          />
        </span>
      )}
      <button
        type="submit"
        className="lintel-button lintel-add-to-cart__button"
        disabled={soldOut || undefined}
      >
        {soldOut ? soldOutLabel : label}
      </button>
      <p className="lintel-add-to-cart__status" role="status" aria-live="polite" />
    </form>
  );
}

function ProductCardBody({
  product,
  showAddToCart,
  imageShape,
  mode,
  formId,
}: {
  product: ShopProduct;
  showAddToCart: boolean;
  imageShape: string;
  mode: RenderMode;
  formId: string;
}) {
  const image = product.images[0];
  return (
    <>
      <a className="lintel-product-card__link" href={mode === "site" ? product.url : undefined}>
        <span
          className={cx(
            "lintel-product-card__picture",
            `lintel-product-card__picture--${imageShape}`,
          )}
        >
          {image ? (
            <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
          ) : (
            <SiteIcon name="shopping-bag" />
          )}
        </span>
        <span className="lintel-product-card__title">{product.title}</span>
      </a>
      <PriceText product={product} showSaving={false} />
      {!product.availableForSale && (
        <span className="lintel-badge lintel-badge--neutral">Sold out</span>
      )}
      {showAddToCart && product.availableForSale && (
        <>
          <VariantData product={product} />
          <AddToCartForm
            product={product}
            label="Add to basket"
            soldOutLabel="Sold out"
            showQuantity={false}
            opensCart
            formId={formId}
          />
        </>
      )}
    </>
  );
}

const ProductCard = drawsProps(productCardComponent, ({ props, attributes, node, mode }) => {
  const product = useShownProduct(props.product, mode);
  if (!product) return null;
  return (
    <article {...attributes} className={cx(attributes.className, "lintel-product-card")}>
      <ProductCardBody
        product={product}
        showAddToCart={props.showAddToCart}
        imageShape={props.imageShape}
        mode={mode}
        formId={node.id}
      />
    </article>
  );
});

const sortLabels: Record<string, string> = {
  featured: "Featured",
  newest: "Newest",
  priceLowToHigh: "Price, low to high",
  priceHighToLow: "Price, high to low",
  titleAToZ: "Name, A to Z",
};

const ProductGrid = drawsProps(
  productGridComponent,
  ({ props, attributes, node, children, mode }) => {
    const list = usePageData().productLists?.[node.id];
    const products =
      list?.products ??
      (mode === "canvas" ? [sampleProduct, sampleProduct, sampleProduct, sampleProduct] : []);
    const site = useSite();
    return (
      <section
        {...attributes}
        className={cx(attributes.className, "lintel-product-grid")}
        aria-label="Products"
      >
        {props.showSort && products.length > 1 && (
          <form className="lintel-product-grid__sort" method="get" data-behaviour="sort-menu">
            <label htmlFor={`sort-${node.id}`}>Sort by</label>
            <select id={`sort-${node.id}`} name="sort" defaultValue={list?.sort ?? props.sort}>
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value} data-url={list?.sortUrls[value]}>
                  {label}
                </option>
              ))}
            </select>
            <noscript>
              <button type="submit">Sort</button>
            </noscript>
          </form>
        )}
        {products.length === 0 ? (
          <p className="lintel-collection-list__empty">{props.emptyText}</p>
        ) : (
          <RepeatedItems
            items={products.map((product) => productAsItem(product, site.locale))}
            mode={mode}
            className={cx(
              "lintel-grid",
              "lintel-grid--gap-medium",
              "lintel-product-grid__items",
              gridClasses(props),
            )}
            productFor={(item) => products.find((product) => product.id === item.id)}
          >
            {children}
          </RepeatedItems>
        )}
        {list && props.paginate && <Pagination {...list} mode={mode} />}
      </section>
    );
  },
);

const ProductGallery = drawsProps(productGalleryComponent, ({ props, attributes, node, mode }) => {
  const product = useShownProduct(props.product, mode);
  if (!product) return null;
  const images = product.images;
  return (
    <div
      {...attributes}
      className={cx(
        attributes.className,
        "lintel-product-gallery",
        `lintel-product-gallery--${props.thumbnails}`,
      )}
      data-behaviour="product-gallery"
    >
      <ul
        className="lintel-product-gallery__track"
        aria-label={`Pictures of ${product.title}`}
        tabIndex={0}
      >
        {images.length === 0 ? (
          <li className="lintel-product-gallery__slide lintel-product-gallery__slide--empty">
            <SiteIcon name="shopping-bag" />
          </li>
        ) : (
          images.map((image, index) => (
            <li
              key={index}
              className="lintel-product-gallery__slide"
              id={`${node.id}-picture-${index}`}
            >
              <img
                src={image.src}
                alt={image.alt}
                loading={index === 0 ? "eager" : "lazy"}
                width={image.width ?? undefined}
                height={image.height ?? undefined}
              />
            </li>
          ))
        )}
      </ul>
      {props.thumbnails !== "none" && images.length > 1 && (
        <ul className="lintel-product-gallery__thumbnails">
          {images.map((image, index) => (
            <li key={index}>
              <a
                className="lintel-product-gallery__thumbnail"
                href={`#${node.id}-picture-${index}`}
                aria-label={`Show picture ${index + 1} of ${images.length}`}
                aria-current={index === 0 ? "true" : undefined}
              >
                <img src={image.src} alt="" loading="lazy" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

const ProductPrice = drawsProps(productPriceComponent, ({ props, attributes, mode }) => {
  const product = useShownProduct(props.product, mode);
  if (!product) return null;
  return (
    <div {...attributes} className={cx(attributes.className, "lintel-product-price")}>
      <PriceText product={product} showSaving={props.showSaving} />
    </div>
  );
});

const VariantPicker = drawsProps(variantPickerComponent, ({ props, attributes, node, mode }) => {
  const product = useShownProduct(props.product, mode);
  if (!product || product.options.length === 0 || product.variants.length <= 1) return null;
  const selected = firstAvailableVariant(product);
  return (
    <div
      {...attributes}
      className={cx(
        attributes.className,
        "lintel-variant-picker",
        `lintel-variant-picker--${props.look}`,
      )}
      data-behaviour="variant-picker"
      data-product={product.handle}
    >
      <VariantData product={product} />
      {product.options.map((option, optionIndex) => {
        const chosen = selected?.optionValues[optionIndex];
        const name = `${node.id}-option-${optionIndex}`;
        return props.look === "menus" ? (
          <p key={option.name} className="lintel-variant-picker__option">
            <label htmlFor={name}>{option.name}</label>
            <select
              id={name}
              name={option.name}
              data-option-index={optionIndex}
              defaultValue={chosen}
            >
              {option.values.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </p>
        ) : (
          <fieldset key={option.name} className="lintel-variant-picker__option">
            <legend>{option.name}</legend>
            {option.values.map((value) => (
              <label key={value} className="lintel-variant-picker__choice">
                <input
                  type="radio"
                  name={name}
                  value={value}
                  data-option-index={optionIndex}
                  defaultChecked={value === chosen}
                />
                <span>{value}</span>
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
});

const AddToCart = drawsProps(addToCartComponent, ({ props, attributes, node, mode }) => {
  const product = useShownProduct(props.product, mode);
  if (!product) return null;
  return (
    <div {...attributes} className={cx(attributes.className, "lintel-add-to-cart-element")}>
      <VariantData product={product} />
      <AddToCartForm
        product={product}
        label={props.label}
        soldOutLabel={props.soldOutLabel}
        showQuantity={props.showQuantity}
        opensCart={props.opensCart}
        formId={node.id}
      />
    </div>
  );
});

function cartAttributes(apiBase: string) {
  return { "data-api": apiBase };
}

const CartDrawer = drawsProps(cartDrawerComponent, ({ props, attributes, node, mode }) => {
  const site = useSite();
  const dialogId = `cart-${node.id}`;
  return (
    <div {...attributes} className={cx(attributes.className, "lintel-cart-button")}>
      <button
        type="button"
        className="lintel-cart-button__open"
        {...({ command: "show-modal", commandfor: dialogId } as Record<string, string>)}
        aria-haspopup="dialog"
        data-cart-opener=""
      >
        <SiteIcon name="shopping-basket" />
        <span className="lintel-visually-hidden">{props.label}</span>
        <span className="lintel-cart-button__count" data-cart-count="" aria-label="items">
          0
        </span>
      </button>
      {mode === "site" && (
        <dialog
          id={dialogId}
          className="lintel-drawer lintel-drawer--right lintel-cart"
          aria-label={props.label}
          data-cart-drawer=""
        >
          <form method="dialog" className="lintel-drawer__close-form">
            <button type="submit" className="lintel-drawer__close" aria-label="Close the basket">
              <SiteIcon name="x" />
            </button>
          </form>
          <h2 className="lintel-cart__title">{props.label}</h2>
          <div
            className="lintel-cart__contents"
            data-behaviour="cart"
            data-cart-view="drawer"
            data-empty-text={props.emptyText}
            {...cartAttributes(site.apiBase)}
          >
            <p className="lintel-cart__empty">{props.emptyText}</p>
          </div>
          <a className="lintel-button lintel-cart__checkout" href="/cart">
            {props.checkoutLabel}
          </a>
        </dialog>
      )}
    </div>
  );
});

const CartContents = drawsProps(cartContentsComponent, ({ props, attributes, mode }) => {
  const site = useSite();
  return (
    <div
      {...attributes}
      className={cx(attributes.className, "lintel-cart", "lintel-cart--page")}
      data-behaviour="cart"
      data-cart-view="page"
      data-empty-text={props.emptyText}
      {...cartAttributes(site.apiBase)}
    >
      <p className="lintel-cart__empty">{props.emptyText}</p>
      <noscript>
        <p>Your basket needs JavaScript switched on.</p>
      </noscript>
      <a className="lintel-cart__continue" href={mode === "site" ? props.continueHref : undefined}>
        {props.continueLabel}
      </a>
    </div>
  );
});

const CheckoutButton = drawsProps(
  checkoutButtonComponent,
  ({ props, attributes, editableText }) => {
    const site = useSite();
    return (
      <a
        {...attributes}
        href="/cart#checkout"
        className={cx(attributes.className, "lintel-button", "lintel-checkout-button")}
        data-behaviour="checkout-link"
        {...cartAttributes(site.apiBase)}
        {...editableText("label")}
      >
        {props.label}
      </a>
    );
  },
);

const OrderConfirmation = drawsProps(orderConfirmationComponent, ({ props, attributes }) => {
  const site = useSite();
  return (
    <section
      {...attributes}
      className={cx(attributes.className, "lintel-order-confirmation")}
      data-behaviour="order-confirmation"
      data-done-text={props.doneText}
      {...cartAttributes(site.apiBase)}
    >
      <SiteIcon name="circle-check" className="lintel-order-confirmation__icon" />
      <h1 className="lintel-order-confirmation__title">{props.title}</h1>
      <p className="lintel-order-confirmation__status" role="status" aria-live="polite">
        {props.waitingText}
      </p>
    </section>
  );
});

export const shopRenders = {
  productCard: ProductCard,
  productGrid: ProductGrid,
  productGallery: ProductGallery,
  productPrice: ProductPrice,
  variantPicker: VariantPicker,
  addToCart: AddToCart,
  cartDrawer: CartDrawer,
  cartContents: CartContents,
  checkoutButton: CheckoutButton,
  orderConfirmation: OrderConfirmation,
};
