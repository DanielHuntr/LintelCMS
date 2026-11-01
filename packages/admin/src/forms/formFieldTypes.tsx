import {
  AlignLeft,
  AtSign,
  Calendar,
  CircleDot,
  EyeOff,
  Hash,
  ListChecks,
  ListCollapse,
  Paperclip,
  Phone,
  ShieldCheck,
  SplitSquareVertical,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { StringKey } from "../i18n/strings.js";
import type { FormFieldType } from "./forms.types.js";

interface FormFieldTypeInfo {
  icon: LucideIcon;
  name: StringKey;
  description: StringKey;
}

/** Every kind of form field, in the order the "Add a field" sheet shows them. */
export const formFieldTypeInfo: Record<FormFieldType, FormFieldTypeInfo> = {
  shortText: { icon: Type, name: "forms.type.shortText", description: "forms.type.shortTextHint" },
  longText: {
    icon: AlignLeft,
    name: "forms.type.longText",
    description: "forms.type.longTextHint",
  },
  email: { icon: AtSign, name: "forms.type.email", description: "forms.type.emailHint" },
  phone: { icon: Phone, name: "forms.type.phone", description: "forms.type.phoneHint" },
  number: { icon: Hash, name: "forms.type.number", description: "forms.type.numberHint" },
  choice: { icon: CircleDot, name: "forms.type.choice", description: "forms.type.choiceHint" },
  checkboxes: {
    icon: ListChecks,
    name: "forms.type.checkboxes",
    description: "forms.type.checkboxesHint",
  },
  dropdown: {
    icon: ListCollapse,
    name: "forms.type.dropdown",
    description: "forms.type.dropdownHint",
  },
  date: { icon: Calendar, name: "forms.type.date", description: "forms.type.dateHint" },
  file: { icon: Paperclip, name: "forms.type.file", description: "forms.type.fileHint" },
  consent: { icon: ShieldCheck, name: "forms.type.consent", description: "forms.type.consentHint" },
  hidden: { icon: EyeOff, name: "forms.type.hidden", description: "forms.type.hiddenHint" },
  step: { icon: SplitSquareVertical, name: "forms.type.step", description: "forms.type.stepHint" },
};

/** The label a new field starts with, which people then change. */
export const newFieldLabels: Record<FormFieldType, StringKey> = {
  shortText: "forms.newLabel.shortText",
  longText: "forms.newLabel.longText",
  email: "forms.newLabel.email",
  phone: "forms.newLabel.phone",
  number: "forms.newLabel.number",
  choice: "forms.newLabel.choice",
  checkboxes: "forms.newLabel.checkboxes",
  dropdown: "forms.newLabel.dropdown",
  date: "forms.newLabel.date",
  file: "forms.newLabel.file",
  consent: "forms.newLabel.consent",
  hidden: "forms.newLabel.hidden",
  step: "forms.newLabel.step",
};

export function hasChoices(type: FormFieldType): boolean {
  return type === "choice" || type === "checkboxes" || type === "dropdown";
}
