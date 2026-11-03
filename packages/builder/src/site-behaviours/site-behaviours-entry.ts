import { setUpAccordions, setUpDialogs, setUpOpenStates, setUpTabs } from "./layout-behaviours.js";
import { setUpForms } from "./form-behaviours.js";
import { setUpClocks } from "./clock-behaviours.js";
import {
  setUpBackToTop,
  setUpCounters,
  setUpCountdowns,
  setUpHeaderClearance,
  setUpHeaders,
  setUpMenus,
} from "./info-behaviours.js";
import {
  setUpBeforeAfter,
  setUpCarousels,
  setUpConsentFrames,
  setUpLightboxes,
  setUpProductGalleries,
  setUpQuietVideos,
} from "./media-behaviours.js";
import {
  setUpAddToCart,
  setUpCart,
  setUpOrderConfirmation,
  setUpVariantPickers,
} from "./shop-behaviours.js";

/**
 * The elements script: published pages with sliders, tabs, pop-ups, forms or the shop load
 * it (deferred). Every behaviour enhances HTML that already works on its own as far as it
 * can, and each finds its elements by `data-behaviour`.
 */
function setUpElements(root: ParentNode): void {
  setUpTabs(root);
  setUpAccordions(root);
  setUpDialogs(root);
  setUpOpenStates(root);
  setUpCarousels(root);
  setUpProductGalleries(root);
  setUpLightboxes(root);
  setUpConsentFrames(root);
  setUpBeforeAfter(root);
  setUpQuietVideos(root);
  setUpCounters(root);
  setUpCountdowns(root);
  setUpClocks(root);
  setUpHeaders(root);
  setUpBackToTop(root);
  setUpMenus(root);
  setUpForms(root);
  setUpVariantPickers(root);
  setUpAddToCart(root);
  setUpOrderConfirmation(root);
  void setUpCart(root);
}

function setUp(): void {
  setUpElements(document);
  setUpHeaderClearance(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setUp);
} else {
  setUp();
}
