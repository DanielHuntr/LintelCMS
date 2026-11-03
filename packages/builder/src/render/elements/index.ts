import type { ComponentRender } from "../component-registry.js";
import { clockRenders } from "./clock.js";
import { collectionRenders } from "./collections.js";
import { creativeRenders } from "./creative.js";
import { effectRenders } from "./effects.js";
import { formRenders } from "./forms.js";
import { infoRenders } from "./info.js";
import { layoutRenders } from "./layout.js";
import { mediaRenders } from "./media.js";
import { navigationRenders } from "./navigation.js";
import { shopRenders } from "./shop.js";

/** The drawings of the element library, by component type. */
export const elementRenders: Readonly<Record<string, ComponentRender>> = {
  ...layoutRenders,
  ...mediaRenders,
  ...infoRenders,
  ...navigationRenders,
  ...formRenders,
  ...collectionRenders,
  ...shopRenders,
  ...effectRenders,
  ...clockRenders,
  ...creativeRenders,
};

export { behaviourTypes, usesBehaviours } from "./behaviour-types.js";
export { elementStylesheet } from "./element-stylesheet.js";
export { siteIconNames, siteIcons, findSiteIcon } from "./icon-set.js";
export { markdownToHtml } from "./markdown.js";
export { openStreetMapAddresses, videoEmbed, vimeoId, youTubeId } from "./media-addresses.js";
export { placeholderItem } from "./collections.js";
export { sampleProduct } from "./shop.js";
