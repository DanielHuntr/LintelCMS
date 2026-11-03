import {
  callToActionBlockComponent,
  heroBlockComponent,
  imageBlockComponent,
  questionBlockComponent,
  textBlockComponent,
} from "./block-components.js";
import { clockComponent } from "./clock-component.js";
import { codeBlockComponent } from "./code-block-component.js";
import { effectComponents } from "./effect-components.js";
import { customBlockComponent } from "../custom-blocks/custom-block.js";
import type { AnyComponentDefinition, ComponentDefinition } from "./component-definition.js";
import {
  buttonComponent,
  dividerComponent,
  headingComponent,
  imageComponent,
  linkComponent,
  listComponent,
  navigationComponent,
  quoteComponent,
  textComponent,
} from "./content-components.js";
import { collectionListComponent } from "./collection-components.js";
import { formEmbedComponent, newsletterSignupComponent } from "./form-components.js";
import * as info from "./info-components.js";
import * as layoutMore from "./layout-more-components.js";
import * as media from "./media-components.js";
import * as navigation from "./site-navigation-components.js";
import * as shop from "./shop-components.js";
import {
  boxComponent,
  columnsComponent,
  containerComponent,
  pageComponent,
  sectionComponent,
} from "./layout-components.js";

/**
 * The components every Lintel site has, in the order the Insert panel lists them. Sites add
 * their own (code components) by passing a longer list to `createComponentCatalogue`.
 */
export const standardComponents: readonly AnyComponentDefinition[] = [
  eraseProps(pageComponent),
  eraseProps(sectionComponent),
  eraseProps(containerComponent),
  eraseProps(boxComponent),
  eraseProps(columnsComponent),
  eraseProps(layoutMore.gridComponent),
  eraseProps(layoutMore.cardComponent),
  eraseProps(dividerComponent),
  eraseProps(layoutMore.spacerComponent),
  eraseProps(layoutMore.tabsComponent),
  eraseProps(layoutMore.tabPanelComponent),
  eraseProps(layoutMore.accordionComponent),
  eraseProps(layoutMore.accordionItemComponent),
  eraseProps(layoutMore.modalComponent),
  eraseProps(layoutMore.stickyComponent),
  eraseProps(headingComponent),
  eraseProps(textComponent),
  eraseProps(listComponent),
  eraseProps(quoteComponent),
  eraseProps(info.richTextComponent),
  eraseProps(info.tableComponent),
  eraseProps(info.badgeComponent),
  eraseProps(info.counterComponent),
  eraseProps(info.marqueeComponent),
  eraseProps(info.timelineComponent),
  eraseProps(info.featureListComponent),
  eraseProps(info.testimonialComponent),
  eraseProps(info.testimonialSliderComponent),
  eraseProps(info.pricingTableComponent),
  eraseProps(info.teamMemberComponent),
  eraseProps(info.countdownComponent),
  eraseProps(clockComponent),
  eraseProps(imageComponent),
  eraseProps(media.galleryComponent),
  eraseProps(media.carouselComponent),
  eraseProps(media.slideComponent),
  eraseProps(media.videoComponent),
  eraseProps(media.audioComponent),
  eraseProps(media.beforeAfterComponent),
  eraseProps(media.iconComponent),
  eraseProps(media.logoStripComponent),
  eraseProps(media.mapComponent),
  eraseProps(media.embedComponent),
  eraseProps(buttonComponent),
  eraseProps(linkComponent),
  eraseProps(navigationComponent),
  eraseProps(navigation.menuLinkComponent),
  eraseProps(navigation.siteHeaderComponent),
  eraseProps(navigation.siteLogoComponent),
  eraseProps(navigation.mobileMenuComponent),
  eraseProps(navigation.siteFooterComponent),
  eraseProps(info.breadcrumbsComponent),
  eraseProps(info.socialLinksComponent),
  eraseProps(navigation.languageSwitcherComponent),
  eraseProps(navigation.searchBoxComponent),
  eraseProps(navigation.backToTopComponent),
  eraseProps(navigation.cookieSettingsComponent),
  eraseProps(collectionListComponent),
  eraseProps(formEmbedComponent),
  eraseProps(newsletterSignupComponent),
  eraseProps(shop.productGridComponent),
  eraseProps(shop.productCardComponent),
  eraseProps(shop.productGalleryComponent),
  eraseProps(shop.productPriceComponent),
  eraseProps(shop.variantPickerComponent),
  eraseProps(shop.addToCartComponent),
  eraseProps(shop.cartDrawerComponent),
  eraseProps(shop.cartContentsComponent),
  eraseProps(shop.checkoutButtonComponent),
  eraseProps(shop.orderConfirmationComponent),
  eraseProps(heroBlockComponent),
  eraseProps(textBlockComponent),
  eraseProps(imageBlockComponent),
  eraseProps(callToActionBlockComponent),
  eraseProps(questionBlockComponent),
  eraseProps(codeBlockComponent),
  // Ready-made animated elements, which start with their effects (see effect-components.ts).
  ...effectComponents,
  eraseProps(customBlockComponent),
];

function eraseProps<Props extends Record<string, unknown>>(
  definition: ComponentDefinition<Props>,
): AnyComponentDefinition {
  return definition as unknown as AnyComponentDefinition;
}

export class DuplicateComponentTypeError extends Error {
  constructor(type: string) {
    super(`Two components have the type “${type}”. Each component needs its own type.`);
    this.name = "DuplicateComponentTypeError";
  }
}

/** The components a site can use, looked up by type. */
export interface ComponentCatalogue {
  readonly definitions: readonly AnyComponentDefinition[];
  find(type: string): AnyComponentDefinition | undefined;
  /** Whether a node of `childType` may go directly inside one of `parentType`. */
  canContain(parentType: string, childType: string): boolean;
}

export function createComponentCatalogue(
  definitions: readonly AnyComponentDefinition[] = standardComponents,
): ComponentCatalogue {
  const byType = new Map<string, AnyComponentDefinition>();
  for (const definition of definitions) {
    if (byType.has(definition.type)) {
      throw new DuplicateComponentTypeError(definition.type);
    }
    byType.set(definition.type, definition);
  }

  return {
    definitions,
    find: (type) => byType.get(type),
    canContain(parentType, childType) {
      const parent = byType.get(parentType);
      const child = byType.get(childType);
      if (!parent || !child || childType === "page") return false;
      if (child.allowedParents && !child.allowedParents.includes(parentType)) return false;
      if (parent.allowedChildren === "none") return false;
      if (parent.allowedChildren === "any") return true;
      return parent.allowedChildren.includes(childType);
    },
  };
}

export const standardCatalogue = createComponentCatalogue();
