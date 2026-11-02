import { eachBehaviour } from "./behaviour-helpers.js";
import { renderCartViews, setUpCheckoutDetails } from "./cart-views.js";
import {
  addToCart,
  type Cart,
  loadCart,
  shopRequest,
  shopperMessage,
  startedCheckoutId,
  forgetCart,
} from "./shop-api.js";

/**
 * The shop on the page: the options picker keeps the price and Add to basket button in step,
 * adding opens the basket, the basket count follows the cart everywhere, and the
 * confirmation page waits for the payment to be confirmed.
 */

interface VariantData {
  id: string;
  optionValues: string[];
  price: string | null;
  compareAtPrice: string | null;
  availableForSale: boolean;
}

function variantsOf(handle: string): VariantData[] {
  const script = document.querySelector(`script[data-product-variants="${CSS.escape(handle)}"]`);
  try {
    return script ? (JSON.parse(script.textContent ?? "[]") as VariantData[]) : [];
  } catch {
    return [];
  }
}

function chosenValues(picker: HTMLElement): string[] {
  const values: string[] = [];
  picker
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-option-index]")
    .forEach((input) => {
      const index = Number(input.dataset.optionIndex);
      if (input instanceof HTMLSelectElement || input.checked) values[index] = input.value;
    });
  return values;
}

function showVariant(handle: string, variant: VariantData | undefined): void {
  document
    .querySelectorAll<HTMLFormElement>(
      `form[data-behaviour~="add-to-cart"][data-product="${CSS.escape(handle)}"]`,
    )
    .forEach((form) => {
      const input = form.querySelector<HTMLInputElement>("input[name=variantId]");
      const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (input) input.value = variant?.id ?? "";
      if (button) {
        const available = variant?.availableForSale === true;
        button.disabled = !available;
        button.textContent = available
          ? (form.dataset.label ?? "Add to basket")
          : (form.dataset.soldOutLabel ?? "Sold out");
      }
    });
  document
    .querySelectorAll<HTMLElement>(`[data-price-for="${CSS.escape(handle)}"]`)
    .forEach((price) => {
      const now = price.querySelector<HTMLElement>("[data-price=now]");
      const was = price.querySelector<HTMLElement>("[data-price=was]");
      if (now && variant?.price) now.textContent = variant.price;
      if (was) {
        was.hidden = !variant?.compareAtPrice;
        const words = was.lastChild;
        if (words && variant?.compareAtPrice) words.textContent = variant.compareAtPrice;
      }
      const saving = price.querySelector<HTMLElement>("[data-price=saving]");
      if (saving) saving.hidden = !variant?.compareAtPrice;
    });
}

export function setUpVariantPickers(root: ParentNode): void {
  eachBehaviour(root, "variant-picker", (picker) => {
    const handle = picker.dataset.product ?? "";
    const variants = variantsOf(handle);
    const update = () => {
      const values = chosenValues(picker);
      showVariant(
        handle,
        variants.find((variant) =>
          variant.optionValues.every((value, index) => values[index] === value),
        ),
      );
    };
    picker.addEventListener("change", update);
  });
}

function showCount(cart: Cart | null): void {
  const count = cart?.itemCount ?? 0;
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((badge) => {
    badge.textContent = String(count);
    badge.toggleAttribute("data-empty", count === 0);
    badge.setAttribute("aria-label", count === 1 ? "1 item" : `${count} items`);
  });
}

export function showCart(cart: Cart | null): void {
  showCount(cart);
  renderCartViews(cart, showCart);
}

export function setUpAddToCart(root: ParentNode): void {
  eachBehaviour<HTMLFormElement>(root, "add-to-cart", (form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = form.querySelector<HTMLElement>(".lintel-add-to-cart__status");
      const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
      const variantId = form.querySelector<HTMLInputElement>("input[name=variantId]")?.value ?? "";
      const quantity =
        Number(form.querySelector<HTMLInputElement>("input[name=quantity]")?.value ?? 1) || 1;
      if (!variantId) {
        if (status) status.textContent = "Please choose an option first.";
        return;
      }
      if (button) button.disabled = true;
      try {
        const cart = await addToCart(variantId, quantity);
        showCart(cart);
        if (status) status.textContent = "Added to your basket.";
        if (form.hasAttribute("data-opens-cart")) {
          const drawer = document.querySelector<HTMLDialogElement>("dialog[data-cart-drawer]");
          if (drawer && !drawer.open) drawer.showModal();
        }
      } catch (error) {
        if (status) status.textContent = shopperMessage(error, "That couldn’t be added.");
      } finally {
        if (button) button.disabled = false;
      }
    });
  });
}

export async function setUpCart(root: ParentNode): Promise<void> {
  const hasShop = root.querySelector(
    '[data-behaviour~="cart"], [data-cart-count], [data-behaviour~="add-to-cart"]',
  );
  if (!hasShop) return;
  setUpCheckoutDetails(showCart);
  showCart(await loadCart());
}

export function setUpOrderConfirmation(root: ParentNode): void {
  eachBehaviour(root, "order-confirmation", (section) => {
    const status = section.querySelector<HTMLElement>(".lintel-order-confirmation__status");
    const checkoutId = startedCheckoutId();
    if (!status || !checkoutId) return;
    let tries = 0;
    const check = async () => {
      tries += 1;
      try {
        const checkout = await shopRequest<{ status: string; orderName: string | null }>(
          `/checkouts/${encodeURIComponent(checkoutId)}`,
        );
        if (checkout.status === "completed") {
          status.textContent = (section.dataset.doneText ?? "").replace(
            "{order}",
            checkout.orderName ?? "",
          );
          forgetCart();
          showCount(null);
          return;
        }
      } catch {
        // Not there yet, or a blip: keep waiting a little longer.
      }
      if (tries < 30) window.setTimeout(check, 2000);
    };
    void check();
  });
}
