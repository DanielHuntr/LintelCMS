import {
  type Cart,
  type CartLine,
  changeLine,
  describeShippingRate,
  formatMoney,
  listShippingRates,
  shopperMessage,
  startCheckout,
  updateCart,
} from "./shop-api.js";

/**
 * The basket, drawn into the basket drawer and the basket page from the cart the storefront
 * API answers with. Built with DOM methods and `textContent`, so names can't become HTML.
 * The basket page also asks for the email and address, offers the delivery rates and starts
 * the payment.
 */

function element<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  className: string,
  text?: string,
): HTMLElementTagNameMap[Tag] {
  const created = document.createElement(tag);
  created.className = className;
  if (text !== undefined) created.textContent = text;
  return created;
}

const problems: Record<string, string> = {
  unavailable: "This is no longer available.",
  no_price: "This can’t be bought here.",
  out_of_stock: "Sold out.",
  not_enough_stock: "Not enough left.",
};

function lineItem(line: CartLine, onChange: (cart: Cart) => void): HTMLLIElement {
  const item = element("li", "lintel-cart__line");
  const picture = document.createElement("img");
  picture.src = line.image?.url ?? "";
  picture.alt = "";
  item.append(picture);
  const words = element("div", "lintel-cart__line-words");
  words.append(element("p", "lintel-cart__line-name", line.productTitle));
  if (line.variantTitle && line.variantTitle !== "Default")
    words.append(element("p", "lintel-cart__line-detail", line.variantTitle));
  if (line.unitPrice)
    words.append(element("p", "lintel-cart__line-detail", formatMoney(line.unitPrice)));
  if (line.problem)
    words.append(element("p", "lintel-cart__problem", problems[line.problem] ?? line.problem));
  item.append(words);
  const actions = element("div", "lintel-cart__line-actions");
  const quantity = document.createElement("input");
  quantity.type = "number";
  quantity.min = "0";
  quantity.max = "99";
  quantity.value = String(line.quantity);
  quantity.setAttribute("aria-label", `Quantity of ${line.productTitle}`);
  quantity.addEventListener("change", async () =>
    onChange(await changeLine(line.id, Math.max(0, Number(quantity.value) || 0))),
  );
  const remove = element("button", "lintel-cart__remove", "Remove");
  remove.type = "button";
  remove.setAttribute("aria-label", `Remove ${line.productTitle}`);
  remove.addEventListener("click", async () => onChange(await changeLine(line.id, 0)));
  actions.append(quantity, remove);
  item.append(actions);
  return item;
}

function totals(cart: Cart): HTMLDListElement {
  const list = element("dl", "lintel-cart__totals");
  const row = (name: string, value: string) =>
    list.append(element("dt", "", name), element("dd", "", value));
  row("Subtotal", formatMoney(cart.subtotal));
  if (cart.shipping) row("Delivery", formatMoney(cart.shipping));
  row("Total", formatMoney(cart.total));
  return list;
}

export function renderCartViews(cart: Cart | null, onChange: (cart: Cart) => void): void {
  document.querySelectorAll<HTMLElement>('[data-behaviour~="cart"]').forEach((view) => {
    const lines = view.querySelector(".lintel-cart__lines");
    const sums = view.querySelector(".lintel-cart__totals");
    lines?.remove();
    sums?.remove();
    const empty = view.querySelector<HTMLElement>(".lintel-cart__empty");
    const hasLines = (cart?.lines.length ?? 0) > 0;
    if (empty) empty.hidden = hasLines;
    view
      .querySelector<HTMLElement>(".lintel-cart__checkout-area")
      ?.toggleAttribute("hidden", !hasLines);
    if (!cart || !hasLines) return;
    const list = element("ul", "lintel-cart__lines");
    list.setAttribute("aria-label", "In your basket");
    cart.lines.forEach((line) => list.append(lineItem(line, onChange)));
    view.prepend(list, totals(cart));
  });
}

const addressFields = [
  ["email", "Email address", "email", "lintel-cart__wide"],
  ["name", "Full name", "name", "lintel-cart__wide"],
  ["line1", "Address", "address-line1", "lintel-cart__wide"],
  ["line2", "Address line 2 (optional)", "address-line2", "lintel-cart__wide"],
  ["city", "Town or city", "address-level2", ""],
  ["postalCode", "Postcode", "postal-code", ""],
  ["country", "Country code (like GB)", "country", ""],
] as const;

/** The details form on the basket page: email and address, then delivery, then pay. */
export function setUpCheckoutDetails(onChange: (cart: Cart) => void): void {
  const page = document.querySelector<HTMLElement>(
    '[data-behaviour~="cart"][data-cart-view="page"]',
  );
  if (!page || page.querySelector(".lintel-cart__checkout-area")) return;
  const area = element("section", "lintel-cart__checkout-area");
  area.id = "checkout";
  area.hidden = true;
  area.setAttribute("aria-labelledby", "lintel-checkout-title");
  const title = element("h2", "lintel-cart__title", "Delivery details");
  title.id = "lintel-checkout-title";
  const form = element("form", "lintel-cart__checkout-form");
  for (const [name, label, autocomplete, wide] of addressFields) {
    const field = element("label", wide, label);
    const input = document.createElement("input");
    input.name = name;
    input.autocomplete = autocomplete;
    input.required = name !== "line2";
    if (name === "email") input.type = "email";
    if (name === "country") {
      input.maxLength = 2;
      input.value = (document.documentElement.lang.split("-")[1] ?? "GB").toUpperCase();
    }
    field.append(input);
    form.append(field);
  }
  const rates = element("fieldset", "lintel-cart__wide lintel-cart__rates");
  rates.hidden = true;
  rates.append(element("legend", "", "Delivery"));
  const message = element("p", "lintel-cart__message lintel-cart__wide");
  message.setAttribute("role", "status");
  const next = element("button", "lintel-button lintel-cart__wide", "Choose delivery");
  next.type = "submit";
  form.append(rates, message, next);
  area.append(title, form);
  page.append(area);

  let choosingRate = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    next.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
      if (!choosingRate) {
        const { email, ...address } = values;
        delete address.shippingRateId;
        onChange(await updateCart({ email, country: address.country, shippingAddress: address }));
        const offered = await listShippingRates();
        rates.replaceChildren(element("legend", "", "Delivery"));
        offered.forEach((rate, index) => {
          const option = element("label", "lintel-form__choice");
          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = "shippingRateId";
          radio.value = rate.rateId;
          radio.checked = index === 0;
          option.append(radio, describeShippingRate(rate));
          rates.append(option);
        });
        rates.hidden = offered.length === 0;
        if (offered.length === 0) message.textContent = "We can’t deliver to that address yet.";
        else {
          choosingRate = true;
          next.textContent = "Pay now";
        }
        return;
      }
      onChange(await updateCart({ shippingRateId: values.shippingRateId }));
      const checkout = await startCheckout();
      if (checkout.url) window.location.assign(checkout.url);
      else
        message.textContent =
          "Payment for this shop is set up to happen on a page of its own. Please contact the shop.";
    } catch (error) {
      message.textContent = shopperMessage(error, "Something went wrong. Please try again.");
    } finally {
      next.disabled = false;
    }
  });
}
