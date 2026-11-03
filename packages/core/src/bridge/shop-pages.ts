import type { PageView, SiteImage } from "@lintel/site-components";
import type { ShopContext } from "../commerce/commerce.context.js";
import { formatMoney } from "../commerce/money/money-format.js";
import type { StorefrontProduct } from "../commerce/storefront/storefront.schema.js";
import { listStorefrontProducts } from "../commerce/storefront/storefront.service.js";
import type { ExtraPage } from "../static-site/static-export.service.js";
import { fingerprint } from "../static-site/static-pages.service.js";
import { renderStandalonePage } from "../website/site-pages.service.js";
import { BRIDGE_FILE } from "./bridge-files.js";

/**
 * The shop's pages on a site published as files: a page listing the products, one page per
 * product with "Add to basket", the basket (with the delivery address and a discount code)
 * and a thank-you page. They use the site's own layout. The basket lives in the visitor's
 * browser; totals, stock and payment are the PHP companion's job, from the signed catalogue.
 */

export const SHOP_PATH = "/shop";
export const SHOP_SCRIPT_FILE = "_lintel/shop.js";

export async function buildShopPages(shop: ShopContext): Promise<ExtraPage[]> {
  const products: StorefrontProduct[] = [];
  for (let page = 1; ; page += 1) {
    const listed = await listStorefrontProducts(shop, { page, perPage: 100 });
    products.push(...listed.items);
    if (products.length >= listed.total || listed.items.length === 0) break;
  }
  if (products.length === 0) return [];
  const page = (
    path: string,
    title: string,
    body: string,
    image: SiteImage | null = null,
  ): ExtraPage => ({
    path,
    signature: fingerprint({ title, body, image }),
    render: (dependencies) =>
      renderStandalonePage(dependencies, path, pageView(title, body, image), title),
  });
  return [
    page(SHOP_PATH, "Shop", productListHtml(products)),
    ...products.map((product) =>
      page(
        `${SHOP_PATH}/${product.handle}`,
        product.title,
        productHtml(product),
        product.images[0] ? { ...product.images[0] } : null,
      ),
    ),
    page(`${SHOP_PATH}/basket`, "Your basket", basketHtml()),
    page(
      `${SHOP_PATH}/thank-you`,
      "Thank you for your order",
      "<p>Your payment went through. We’ve emailed your receipt, and we’ll be in touch when your order is on its way.</p>" +
        `<script src="/${SHOP_SCRIPT_FILE}" defer></script>`,
    ),
  ];
}

function pageView(title: string, body: string, image: SiteImage | null): PageView {
  return { kind: "page", title, summary: "", heroImage: image, body, sections: [], design: null };
}

function productListHtml(products: readonly StorefrontProduct[]): string {
  const items = products.map((product) => {
    const price = product.priceRange ? formatMoney(product.priceRange.min) : "";
    return `<li><a href="${SHOP_PATH}/${escapeHtml(product.handle)}">${escapeHtml(product.title)}</a>${price ? ` <span>${escapeHtml(price)}</span>` : ""}</li>`;
  });
  return `<ul class="lintel-shop-list">${items.join("")}</ul>`;
}

function productHtml(product: StorefrontProduct): string {
  const buyable = product.variants.filter((variant) => variant.price);
  const options = buyable
    .map(
      (variant) =>
        `<option value="${escapeHtml(variant.id)}" data-title="${escapeHtml(`${product.title}${variant.title === "Default" ? "" : ` (${variant.title})`}`)}" data-price="${escapeHtml(formatMoney(variant.price ?? { amount: 0, currency: "GBP" }))}"${variant.availableForSale ? "" : " disabled"}>${escapeHtml(variant.title === "Default" ? product.title : variant.title)} · ${escapeHtml(formatMoney(variant.price ?? { amount: 0, currency: "GBP" }))}${variant.availableForSale ? "" : " · sold out"}</option>`,
    )
    .join("");
  const form = product.availableForSale
    ? `<form class="lintel-add-to-basket" data-lintel-add-to-basket>` +
      `<label for="lintel-variant">Choose</label> <select id="lintel-variant" name="variant">${options}</select> ` +
      `<label for="lintel-quantity">Quantity</label> <input id="lintel-quantity" name="quantity" type="number" min="1" max="100" value="1"> ` +
      `<button type="submit" class="lintel-button lintel-button--primary">Add to basket</button>` +
      `<p role="status" data-lintel-basket-status></p></form>`
    : "<p>Sold out for now.</p>";
  return `${product.descriptionHtml}${form}<p><a href="${SHOP_PATH}/basket">Go to your basket</a></p><script src="/${SHOP_SCRIPT_FILE}" defer></script>`;
}

function basketHtml(): string {
  const field = (name: string, label: string, type = "text", autocomplete = "") =>
    `<p><label for="lintel-${name}">${label}</label><br><input id="lintel-${name}" name="${name}" type="${type}"${autocomplete ? ` autocomplete="${autocomplete}"` : ""}></p>`;
  return [
    '<div data-lintel-basket data-lintel-bridge="/' + BRIDGE_FILE + '">',
    '<div data-lintel-basket-lines aria-live="polite"><p>Your basket is empty.</p></div>',
    "<form data-lintel-checkout novalidate>",
    "<h2>Delivery</h2>",
    field("email", "Email", "email", "email"),
    field("name", "Full name", "text", "name"),
    field("line1", "Address", "text", "address-line1"),
    field("line2", "Address line 2 (optional)", "text", "address-line2"),
    field("city", "Town or city", "text", "address-level2"),
    field("postalCode", "Postcode", "text", "postal-code"),
    field("country", "Country code (such as GB)", "text", "country"),
    field("discountCode", "Discount code (optional)"),
    '<div data-lintel-totals aria-live="polite"></div>',
    '<p role="alert" data-lintel-problem></p>',
    '<button type="button" class="lintel-button lintel-button--secondary" data-lintel-quote>Work out the total</button> ',
    '<button type="submit" class="lintel-button lintel-button--primary">Pay securely</button>',
    "</form>",
    "</div>",
    `<script src="/${SHOP_SCRIPT_FILE}" defer></script>`,
  ].join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The basket, in plain ES5: kept in localStorage, totals and payment from the companion. */
export const shopScript = `(function () {
  "use strict";
  var KEY = "lintel-basket";
  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function write(lines) { localStorage.setItem(KEY, JSON.stringify(lines)); }
  function text(element, value) { if (element) element.textContent = value; }

  var add = document.querySelector("[data-lintel-add-to-basket]");
  if (add) {
    add.addEventListener("submit", function (event) {
      event.preventDefault();
      var select = add.querySelector("select");
      var option = select.options[select.selectedIndex];
      var quantity = Math.max(1, Math.min(100, parseInt(add.querySelector("input[name=quantity]").value, 10) || 1));
      var lines = read();
      var existing = lines.filter(function (line) { return line.variantId === option.value; })[0];
      if (existing) existing.quantity = Math.min(100, existing.quantity + quantity);
      else lines.push({ variantId: option.value, quantity: quantity, title: option.getAttribute("data-title"), price: option.getAttribute("data-price") });
      write(lines);
      text(add.querySelector("[data-lintel-basket-status]"), "Added to your basket.");
    });
  }

  if (/thank-you/.test(location.pathname)) write([]);

  var basket = document.querySelector("[data-lintel-basket]");
  if (!basket) return;
  var bridge = basket.getAttribute("data-lintel-bridge");
  var linesBox = basket.querySelector("[data-lintel-basket-lines]");
  var form = basket.querySelector("[data-lintel-checkout]");
  var problem = basket.querySelector("[data-lintel-problem]");
  var totals = basket.querySelector("[data-lintel-totals]");

  function drawLines() {
    var lines = read();
    linesBox.textContent = "";
    if (lines.length === 0) { var empty = document.createElement("p"); empty.textContent = "Your basket is empty."; linesBox.appendChild(empty); return; }
    var list = document.createElement("ul");
    lines.forEach(function (line, index) {
      var item = document.createElement("li");
      item.textContent = line.quantity + " × " + line.title + " (" + line.price + " each) ";
      var remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + line.title);
      remove.addEventListener("click", function () { var all = read(); all.splice(index, 1); write(all); drawLines(); });
      item.appendChild(remove);
      list.appendChild(item);
    });
    linesBox.appendChild(list);
  }

  function value(name) { var input = form.querySelector("[name=" + name + "]"); return input ? input.value.trim() : ""; }
  function request(action) {
    return {
      lines: read().map(function (line) { return { variantId: line.variantId, quantity: line.quantity }; }),
      email: value("email"), country: value("country").toUpperCase(), discountCode: value("discountCode"),
      address: { name: value("name"), line1: value("line1"), line2: value("line2"), city: value("city"), postalCode: value("postalCode") }
    };
  }
  function send(action) {
    text(problem, "");
    return fetch(bridge + "?action=" + action, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request(action)) })
      .then(function (response) { return response.json().then(function (body) { if (!response.ok) throw new Error(body.error || "Something went wrong."); return body; }); })
      .catch(function (error) { text(problem, error.message); throw error; });
  }
  function money(amount, currency) { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency }).format(amount / 100); }

  basket.querySelector("[data-lintel-quote]").addEventListener("click", function () {
    send("quote").then(function (quote) {
      totals.textContent = "Delivery " + money(quote.shippingAmount, quote.currency) + (quote.discountAmount ? " · Discount −" + money(quote.discountAmount, quote.currency) : "") + " · Total " + money(quote.totalAmount, quote.currency);
    }, function () {});
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    send("checkout").then(function (answer) { location.href = answer.url; }, function () {});
  });
  drawLines();
})();
`;
