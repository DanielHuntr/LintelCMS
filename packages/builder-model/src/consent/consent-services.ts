import type { PageNode } from "../document/page-document.schema.js";
import { instanceBlockHandle, type CustomBlock } from "../custom-blocks/custom-block.js";
import { walkNodes } from "../tree/tree-queries.js";

/**
 * The other companies a published page may contact, and so may set cookies: the services the
 * site's cookie notice names and asks visitors about. Videos from YouTube and Vimeo, maps,
 * Embed elements, Adobe Fonts, and anything a plugin declares. Each has a stable id, kept in
 * a visitor's saved choice, and the name visitors read.
 *
 * Embeds that load without asking (`loadsStraightAway`) are the site maker's own call and
 * aren't counted; neither are Code elements, whose contents can't be read for this.
 */

export interface ConsentService {
  /** "youtube", "embed:calendly.com", "adobe-fonts", "plugin:bookings". */
  id: string;
  /** What visitors read: "YouTube", "Calendly". */
  name: string;
  /** Counts visits without cookies ("Visitor counts"), so the notice doesn't say it may set any. */
  countsWithoutCookies?: boolean;
}

export const youTubeService: ConsentService = { id: "youtube", name: "YouTube" };
export const vimeoService: ConsentService = { id: "vimeo", name: "Vimeo" };
export const openStreetMapService: ConsentService = { id: "openstreetmap", name: "OpenStreetMap" };
export const adobeFontsService: ConsentService = { id: "adobe-fonts", name: "Adobe Fonts" };

/** The names of the services Embed elements can show, by the host their address is on. */
const embedServiceNames: Readonly<Record<string, string>> = {
  "youtube-nocookie.com": "YouTube",
  "player.vimeo.com": "Vimeo",
  "open.spotify.com": "Spotify",
  "w.soundcloud.com": "SoundCloud",
  "bandcamp.com": "Bandcamp",
  "codepen.io": "CodePen",
  "docs.google.com": "Google Docs",
  "calendar.google.com": "Google Calendar",
  "calendly.com": "Calendly",
  "openstreetmap.org": "OpenStreetMap",
  "figma.com": "Figma",
  "loom.com": "Loom",
  "typeform.com": "Typeform",
  "airtable.com": "Airtable",
  "tally.so": "Tally",
};

/** The service a video comes from, or null for a file on the site. */
export function consentServiceForVideo(source: string): ConsentService | null {
  if (source === "youtube") return youTubeService;
  if (source === "vimeo") return vimeoService;
  return null;
}

/**
 * The service an embed's address is from: a known one by name ("Calendly"), YouTube and
 * Vimeo as their videos are, or the host itself for anything else. Null without an address.
 */
export function consentServiceForEmbed(address: string): ConsentService | null {
  const host = /^https:\/\/([^/?#:]+)/i.exec(address.trim())?.[1]?.toLowerCase();
  if (!host) return null;
  const known = Object.keys(embedServiceNames).find(
    (name) => host === name || host.endsWith(`.${name}`),
  );
  if (known === "youtube-nocookie.com") return youTubeService;
  if (known === "player.vimeo.com") return vimeoService;
  if (known === "openstreetmap.org") return openStreetMapService;
  const name = known ? (embedServiceNames[known] ?? known) : host.replace(/^www\./, "");
  return { id: `embed:${known ?? host.replace(/^www\./, "")}`, name };
}

/** The service one element would load, or null when it loads nothing from elsewhere. */
export function consentServiceOfNode(node: PageNode): ConsentService | null {
  const props = node.props;
  if (node.type === "video") {
    return typeof props.url === "string" && props.url.trim() !== ""
      ? consentServiceForVideo(String(props.source ?? ""))
      : null;
  }
  if (node.type === "map") return openStreetMapService;
  if (node.type === "embed") {
    if (props.loadsStraightAway === true || typeof props.url !== "string") return null;
    return consentServiceForEmbed(props.url);
  }
  return null;
}

/**
 * Every service a design uses, in the order they first appear, including those inside the
 * site's own blocks it holds (looked up in `blocks`, each read once).
 */
export function consentServicesInDesign(
  root: PageNode,
  blocks: ReadonlyMap<string, Pick<CustomBlock, "design">> = new Map(),
): ConsentService[] {
  const found = new Map<string, ConsentService>();
  const blocksRead = new Set<string>();
  const read = (start: PageNode) => {
    walkNodes(start, (node) => {
      const service = consentServiceOfNode(node);
      if (service && !found.has(service.id)) found.set(service.id, service);
      const handle = instanceBlockHandle(node);
      if (handle && !blocksRead.has(handle)) {
        blocksRead.add(handle);
        const design = blocks.get(handle)?.design;
        if (design) read(design);
      }
    });
  };
  read(root);
  return [...found.values()];
}

/** Services from several places as one list, each once, sorted by name. */
export function combineConsentServices(
  ...lists: ReadonlyArray<readonly ConsentService[]>
): ConsentService[] {
  const byId = new Map<string, ConsentService>();
  for (const service of lists.flat()) if (!byId.has(service.id)) byId.set(service.id, service);
  return [...byId.values()].sort((first, second) => first.name.localeCompare(second.name));
}

/** "YouTube", "YouTube and Vimeo", "Adobe Fonts, Vimeo and YouTube": names joined as English. */
export function listServiceNames(services: readonly Pick<ConsentService, "name">[]): string {
  const names = [...new Set(services.map((service) => service.name))];
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
