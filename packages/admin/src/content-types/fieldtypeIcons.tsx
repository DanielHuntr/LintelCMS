import {
  AlignLeft,
  Calendar,
  Hash,
  ImageIcon,
  Link2,
  ListChecks,
  Pilcrow,
  ToggleRight,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { FieldType } from "../fields/field.types.js";

/** One icon per fieldtype, shared by the field list and the "Add field" sheet. */
export const fieldtypeIcons: Record<FieldType, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  richText: Pilcrow,
  number: Hash,
  toggle: ToggleRight,
  select: ListChecks,
  date: Calendar,
  image: ImageIcon,
  link: Link2,
};

interface FieldtypeIconProps {
  type: string;
  className?: string;
}

/** The icon for a fieldtype, or a plain "T" for one this admin doesn't know. */
export function FieldtypeIcon({ type, className }: FieldtypeIconProps) {
  const Icon = fieldtypeIcons[type as FieldType] ?? Type;
  return <Icon aria-hidden="true" strokeWidth={1.75} className={className} />;
}
