import {
  type Cart,
  type CartLine,
  cartTotalRows,
  changeLine,
  countryName,
  describeShippingRate,
  formatMoney,
  listDeliveryCountries,
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

/** The line's picture, or the same neutral "no picture" tile the product page shows. */
function linePicture(line: CartLine): HTMLElement {
  if (line.image?.url) {
    const picture = document.createElement("img");
    picture.src = line.image.url;
    picture.alt = "";
    return picture;
  }
  const tile = element("span", "lintel-cart__line-picture");
  tile.setAttribute("aria-hidden", "true");
  const icon = document.querySelector<HTMLTemplateElement>("template.lintel-cart__no-picture");
  if (icon) tile.append(icon.content.cloneNode(true));
  return tile;
}

function lineItem(line: CartLine, onChange: (cart: Cart) => void): HTMLLIElement {
  const item = element("li", "lintel-cart__line");
  item.append(linePicture(line));
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
  for (const { label, amount } of cartTotalRows(cart)) {
    let value = "Free";
    if (amount && amount.amount < 0)
      value = `−${formatMoney({ ...amount, amount: -amount.amount })}`;
    else if (amount) value = formatMoney(amount);
    list.append(element("dt", "", label), element("dd", "", value));
  }
  return list;
}

/** The codes in the cart, each with a Remove button, and why any of them don't apply yet. */
function showDiscountCodes(box: HTMLElement, cart: Cart, onChange: (cart: Cart) => void): void {
  const codes = box.querySelector<HTMLElement>(".lintel-cart__codes");
  const problems = box.querySelector<HTMLElement>(".lintel-cart__discount-problems");
  codes?.replaceChildren(
    ...cart.discountCodes.map((code) => {
      const item = element("li", "lintel-cart__code", code);
      const remove = element("button", "lintel-cart__remove", "Remove");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove the code ${code}`);
      remove.addEventListener("click", async () => {
        const left = cart.discountCodes.filter((each) => each !== code);
        try {
          onChange(await updateCart({ discountCodes: left }));
        } catch (error) {
          if (problems) problems.textContent = shopperMessage(error, "Please try again.");
        }
      });
      item.append(" ", remove);
      return item;
    }),
  );
  if (problems) problems.textContent = cart.discountProblems.map((each) => each.message).join(" ");
}

let latestCart: Cart | null = null;

export function renderCartViews(cart: Cart | null, onChange: (cart: Cart) => void): void {
  latestCart = cart;
  if (cart) fillSavedDetails(cart);
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
    const discountBox = view.querySelector<HTMLElement>(".lintel-cart__discount");
    discountBox?.toggleAttribute("hidden", !hasLines);
    if (!cart || !hasLines) return;
    const list = element("ul", "lintel-cart__lines");
    list.setAttribute("aria-label", "In your basket");
    cart.lines.forEach((line) => list.append(lineItem(line, onChange)));
    // The code box stays the same element, so typing in it isn't lost; it moves below the sums.
    view.prepend(list, totals(cart), ...(discountBox ? [discountBox] : []));
    if (discountBox) showDiscountCodes(discountBox, cart, onChange);
  });
}

/** The discount code box on the basket page, below the sums. */
export function setUpDiscountCode(onChange: (cart: Cart) => void): void {
  const page = document.querySelector<HTMLElement>(
    '[data-behaviour~="cart"][data-cart-view="page"]',
  );
  if (!page || page.querySelector(".lintel-cart__discount")) return;
  const box = element("form", "lintel-cart__discount");
  box.hidden = true;
  const field = element("label", "", "Discount code");
  const input = document.createElement("input");
  input.name = "discountCode";
  input.autocomplete = "off";
  input.maxLength = 50;
  field.append(input);
  const apply = element("button", "lintel-button lintel-button--secondary", "Apply");
  apply.type = "submit";
  const problems = element("p", "lintel-cart__discount-problems");
  problems.setAttribute("role", "status");
  const codes = element("ul", "lintel-cart__codes");
  codes.setAttribute("aria-label", "Codes in your basket");
  box.append(field, apply, problems, codes);
  page.prepend(box);

  box.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = input.value.trim();
    if (!code) return;
    const current = latestCart?.discountCodes ?? [];
    const already = current.some((each) => each.toUpperCase() === code.toUpperCase());
    problems.textContent = "";
    apply.disabled = true;
    try {
      onChange(await updateCart({ discountCodes: already ? current : [...current, code] }));
      input.value = "";
    } catch (error) {
      problems.textContent = shopperMessage(
        error,
        "That code couldn’t be added. Please try again.",
      );
    } finally {
      apply.disabled = false;
    }
  });
}

const addressFields = [
  ["email", "Email address", "email", "lintel-cart__wide"],
  ["name", "Full name", "name", "lintel-cart__wide"],
  ["line1", "Address", "address-line1", "lintel-cart__wide"],
  ["line2", "Address line 2 (optional)", "address-line2", "lintel-cart__wide"],
  ["city", "Town or city", "address-level2", ""],
  ["postalCode", "Postcode", "postal-code", ""],
  ["country", "Country", "country", ""],
] as const;

/**
 * The country list holds only the countries the shop delivers to, by name. Until they load,
 * or if they can't, it offers the page language's country, as the free-text box used to.
 */
function countryPicker(): HTMLSelectElement {
  const picker = document.createElement("select");
  const addOptions = (codes: readonly string[]) =>
    picker.replaceChildren(
      ...codes
        .map((code) => new Option(countryName(code), code))
        .sort((first, second) => first.text.localeCompare(second.text)),
    );
  const pageCountry = (document.documentElement.lang.split("-")[1] ?? "GB").toUpperCase();
  addOptions([pageCountry]);
  listDeliveryCountries()
    .then((codes) => {
      if (codes.length === 0) return;
      const wanted = latestCart?.country ?? picker.value;
      addOptions(codes);
      picker.value = codes.includes(wanted) ? wanted : (picker.options[0]?.value ?? "");
    })
    .catch(() => {
      // The page language's country stays; Choose delivery says if there's no delivery there.
    });
  return picker;
}

/**
 * Someone back from a payment that failed, or returning to their basket, shouldn't type it
 * all again. Only empty boxes are filled, so nothing being typed is overwritten.
 */
function fillSavedDetails(cart: Cart): void {
  const form = document.querySelector<HTMLFormElement>(".lintel-cart__checkout-form");
  for (const [name] of addressFields) {
    const box = form?.elements.namedItem(name);
    const saved = name === "email" ? cart.email : cart.shippingAddress?.[name];
    if (box instanceof HTMLInputElement && !box.value && saved) box.value = saved;
  }
}

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
    const input = name === "country" ? countryPicker() : document.createElement("input");
    input.name = name;
    input.autocomplete = autocomplete;
    input.required = name !== "line2";
    if (name === "email" && input instanceof HTMLInputElement) input.type = "email";
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
  // Shoppers see the total they'll pay before they press Pay now.
  rates.addEventListener("change", (event) => {
    const chosen = (event.target as HTMLInputElement).value;
    updateCart({ shippingRateId: chosen }).then(onChange, (error: unknown) => {
      message.textContent = shopperMessage(error, "Something went wrong. Please try again.");
    });
  });
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
          // Focus used to be lost here (the button was busy), so keyboard and screen reader
          // users started again at the top of the page (LINTEL-A11Y-002). Now it moves to the
          // choice, and the status line says how many there are.
          message.textContent =
            offered.length === 1
              ? "1 way to deliver. Check it, then choose Pay now."
              : `${offered.length} ways to deliver. Choose one, then choose Pay now.`;
          rates.querySelector<HTMLInputElement>("input:checked")?.focus();
          // The first choice is already ticked, so the total should already include it.
          const first = offered[0];
          if (first) onChange(await updateCart({ shippingRateId: first.rateId }));
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
      // While it was busy the button lost focus; give it back unless focus moved on purpose.
      if (!form.contains(document.activeElement)) next.focus();
    }
  });
}
