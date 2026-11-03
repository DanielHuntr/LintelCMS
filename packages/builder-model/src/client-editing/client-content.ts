import type {
  AnyComponentDefinition,
  ComponentCategory,
  EditableField,
  ListOfItemsField,
  SimpleField,
} from "../components/component-definition.js";
import type { ClientContentKind, PageNode } from "../document/page-document.schema.js";

/**
 * What a client (someone who may change content but not the design) may change on an
 * element: its words, its pictures, its links. The designer chooses per element in the
 * builder ("What clients can change"); until they do, each element's defaults apply:
 * text gives words, pictures give pictures, buttons and links give words and links, and
 * layout, styling and everything else give nothing.
 */

/** Categories whose elements clients never change unless the designer says so. */
const closedCategories: readonly ComponentCategory[] = ["code", "forms", "shop", "collections"];

/** Elements that draw the site's own menus and tools, which clients don't change here. */
const closedTypes: readonly string[] = [
  "navigation",
  "mobileMenu",
  "siteHeader",
  "siteFooter",
  "siteLogo",
  "languageSwitcher",
  "searchBox",
  "breadcrumbs",
  "backToTop",
  "cookieSettings",
  "customBlock",
];

/** Props that go with another: a picture's media id and description, a text's styled parts. */
const pictureCompanions = ["assetId", "alt"];
const wordCompanions = ["marks"];

/** Text props that set things up rather than say anything: a section's anchor for links. */
const settingProps = ["anchor"];

/** The kind of content one field holds, or null for settings (choices, toggles, numbers...). */
export function contentKindOfField(field: EditableField): ClientContentKind | null {
  if (settingProps.includes(field.prop)) return null;
  switch (field.kind) {
    case "text":
    case "multilineText":
    case "textList":
      return field.prop === "alt" ? "pictures" : "words";
    case "image":
      return "pictures";
    case "link":
    case "linkList":
      return "links";
    default:
      return null;
  }
}

/** Every kind of content an element has fields for, in the usual order. */
export function contentKindsOf(
  definition: AnyComponentDefinition | undefined,
): ClientContentKind[] {
  const kinds = new Set<ClientContentKind>();
  for (const field of definition?.editableFields ?? []) {
    if (field.kind === "itemList") {
      for (const itemField of field.fields) {
        const kind = contentKindOfField(itemField);
        if (kind) kinds.add(kind);
      }
    } else {
      const kind = contentKindOfField(field);
      if (kind) kinds.add(kind);
    }
  }
  return (["words", "pictures", "links"] as const).filter((kind) => kinds.has(kind));
}

/** What clients may change on an element nobody has set: its content, unless it is closed. */
export function defaultClientEdits(
  definition: AnyComponentDefinition | undefined,
): ClientContentKind[] {
  if (!definition) return [];
  if (closedCategories.includes(definition.category) || closedTypes.includes(definition.type)) {
    return [];
  }
  const kinds = contentKindsOf(definition);
  // Pictures, galleries and videos: the pictures themselves. Their captions are the
  // designer's to open up.
  if (definition.category === "media" && kinds.includes("pictures")) return ["pictures"];
  return kinds;
}

/** What clients may change on this element: the designer's choice, else the defaults. */
export function clientEditsOf(
  node: PageNode,
  definition: AnyComponentDefinition | undefined,
): ReadonlySet<ClientContentKind> {
  const offered = new Set(contentKindsOf(definition));
  const chosen = node.clientEdits ?? defaultClientEdits(definition);
  return new Set(chosen.filter((kind) => offered.has(kind)));
}

/**
 * The kind of content a prop holds on this element: its field's kind, the kind of the field
 * it goes with (a picture's `assetId`), "items" for a list of items, or null for a setting.
 */
export function contentKindOfProp(
  definition: AnyComponentDefinition | undefined,
  prop: string,
): ClientContentKind | "items" | null {
  const fields = definition?.editableFields ?? [];
  const field = fields.find((candidate) => candidate.prop === prop);
  if (field?.kind === "itemList") return "items";
  if (field) return contentKindOfField(field);
  if (pictureCompanions.includes(prop) && fields.some((each) => each.kind === "image")) {
    return "pictures";
  }
  if (
    wordCompanions.includes(prop) &&
    fields.some((each) => contentKindOfField(each) === "words")
  ) {
    return "words";
  }
  return null;
}

/**
 * The fields a client sees for an element: those holding content they may change, with a
 * list's item fields narrowed the same way. A list is kept when its items have something to
 * change, or when clients may add and remove its items.
 */
export function clientEditableFields(
  node: PageNode,
  definition: AnyComponentDefinition | undefined,
): EditableField[] {
  const allowed = clientEditsOf(node, definition);
  const isBound = (prop: string) => node.bindings?.[prop] !== undefined;
  const fits = (field: SimpleField) => {
    const kind = contentKindOfField(field);
    return kind !== null && allowed.has(kind);
  };
  return (definition?.editableFields ?? []).flatMap((field): EditableField[] => {
    if (isBound(field.prop)) return [];
    if (field.kind === "itemList") {
      const fields = field.fields.filter(fits);
      if (fields.length === 0 && !node.clientRepeats) return [];
      return [{ ...field, fields } satisfies ListOfItemsField];
    }
    if (field.kind === "source") return [];
    return fits(field) ? [field] : [];
  });
}

/** Whether clients may change anything on this element at all. */
export function clientMayEdit(
  node: PageNode,
  definition: AnyComponentDefinition | undefined,
): boolean {
  return clientEditableFields(node, definition).length > 0;
}

/** Whether clients may type into this prop on the canvas. */
export function clientMayEditText(
  node: PageNode,
  definition: AnyComponentDefinition | undefined,
  prop: string,
): boolean {
  return (
    node.bindings?.[prop] === undefined &&
    contentKindOfProp(definition, prop) === "words" &&
    clientEditsOf(node, definition).has("words")
  );
}

/** Whether an element has a list of items (a gallery's pictures, a table's rows) in its props. */
export function hasItemList(definition: AnyComponentDefinition | undefined): boolean {
  return (definition?.editableFields ?? []).some((field) => field.kind === "itemList");
}
