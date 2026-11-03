import type { ComponentCategory, SectionCategory } from "@lintel/builder-model";
import {
  Blocks,
  BookOpen,
  CircleHelp,
  ClipboardList,
  Code,
  Image,
  Images,
  LayoutGrid,
  Library,
  ListChecks,
  Mail,
  Menu,
  type LucideIcon,
  PanelBottom,
  PanelTop,
  ShoppingBag,
  Star,
  Tag,
  Type,
} from "lucide-react";

/** The picture beside each category in Insert, for sections and single elements alike. */
export const insertGroupIcons: Record<SectionCategory | ComponentCategory, LucideIcon> = {
  // Sections.
  navigation: Menu,
  intro: PanelTop,
  features: ListChecks,
  about: BookOpen,
  pictures: Images,
  proof: Star,
  pricing: Tag,
  questions: CircleHelp,
  contact: Mail,
  shop: ShoppingBag,
  footer: PanelBottom,
  // Elements.
  blocks: Blocks,
  layout: LayoutGrid,
  text: Type,
  media: Image,
  collections: Library,
  forms: ClipboardList,
  code: Code,
};
