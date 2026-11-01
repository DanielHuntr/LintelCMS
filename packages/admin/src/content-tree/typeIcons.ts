import {
  BookOpen,
  CalendarDays,
  FileText,
  House,
  LayoutList,
  type LucideIcon,
  Newspaper,
  Package,
  Rows3,
  ShoppingBag,
  Users,
} from "lucide-react";

/** Icons for well-known kinds of content, by a word in the collection's handle. */
const iconsByWord: readonly [RegExp, LucideIcon][] = [
  [/post|blog|news|article/, Newspaper],
  [/product|shop|store/, ShoppingBag],
  [/event/, CalendarDays],
  [/person|people|team|staff|author/, Users],
  [/guide|doc|recipe|story/, BookOpen],
  [/item|stock/, Package],
];

/**
 * The icon for an entry or section in the tree. A content type's own icon comes from its
 * handle ("blog_posts" is a newspaper); otherwise pages look like pages and lists like lists.
 * The first page of a site is its home.
 */
export function iconForContent(
  collection: { handle: string; structure?: string },
  options: { isHome?: boolean } = {},
): LucideIcon {
  if (options.isHome) return House;
  const known = iconsByWord.find(([pattern]) => pattern.test(collection.handle));
  if (known) return known[1];
  if (collection.structure === "dated") return Newspaper;
  if (collection.structure === "flat") return Rows3;
  if (collection.structure === undefined) return FileText;
  return collection.structure === "tree" ? FileText : LayoutList;
}
