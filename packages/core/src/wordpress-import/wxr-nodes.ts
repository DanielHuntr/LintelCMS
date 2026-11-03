import { decodeEntities } from "./wordpress-content.js";

/** Small helpers for reading the parsed WordPress export (see wxr-parser.ts). */
export type XmlNode = Record<string, unknown>;

export function readMeta(node: XmlNode): Map<string, string> {
  return new Map(
    nodes(node["wp:postmeta"]).map((entry) => [
      text(entry["wp:meta_key"]),
      text(entry["wp:meta_value"]),
    ]),
  );
}

export function termSlugsIn(node: XmlNode, domain: string): string[] {
  return nodes(node.category)
    .filter((category) => category["@_domain"] === domain)
    .map((category) => text(category["@_nicename"]));
}

export function termNamesIn(node: XmlNode, domain: string): string[] {
  return nodes(node.category)
    .filter((category) => category["@_domain"] === domain)
    .map((category) => decodeEntities(text(category)));
}

export function nodes(value: unknown): XmlNode[] {
  return Array.isArray(value)
    ? value.filter((item): item is XmlNode => typeof item === "object" && item !== null)
    : [];
}

export function text(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object" && value !== null && "#text" in value) {
    return text((value as XmlNode)["#text"]);
  }
  return "";
}
