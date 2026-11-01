import { createElement } from "react";
import {
  Box,
  CodeXml,
  Columns2,
  File,
  Heading,
  Image,
  Link,
  List,
  type LucideIcon,
  Menu,
  Minus,
  MousePointerClick,
  PanelTop,
  Pilcrow,
  Quote,
  Rows3,
  Square,
} from "lucide-react";
import { findSiteIcon } from "../render/elements/icon-set.js";

/**
 * The icons components name in their definitions (`icon: "heading"`), in one visible list.
 * The element library's icons come from the site's icon set; an unknown name is a plain box.
 */
const componentIcons: Record<string, LucideIcon> = {
  file: File,
  "rows-3": Rows3,
  square: Square,
  "panel-top": PanelTop,
  "columns-2": Columns2,
  minus: Minus,
  heading: Heading,
  pilcrow: Pilcrow,
  quote: Quote,
  list: List,
  image: Image,
  "mouse-pointer-click": MousePointerClick,
  link: Link,
  menu: Menu,
  "code-xml": CodeXml,
};

export function componentIcon(name: string | undefined): LucideIcon {
  return (name && (componentIcons[name] ?? findSiteIcon(name))) || Box;
}

/** A component's icon, decorative: the text beside it is the label. */
export function ComponentIcon({
  name,
  className,
}: {
  name: string | undefined;
  className: string;
}) {
  return createElement(componentIcon(name), { "aria-hidden": true, className });
}
