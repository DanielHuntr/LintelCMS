import { z } from "zod";
import { defineComponent } from "./component-definition.js";
import { codeImageSchema, plainText } from "./component-props.js";

/**
 * A piece of the page written by hand in HTML, CSS and (optionally) JavaScript, for anything
 * the visual elements can't do. It moves, duplicates and hides like any other element.
 *
 * Developers mark the parts other people may change: `data-lintel-field="heading"` on an
 * element makes its text editable, `data-lintel-image="photo"` on an `<img>` makes the
 * picture choosable. The values people pick are kept in `fields` and `images` and filled in
 * when the page is drawn (see src/code/code-markers.ts), so editing them never touches code.
 */

export const maxCodeLength = 100_000;

export const codeBlockComponent = defineComponent({
  type: "codeBlock",
  label: "Code",
  description: "Your own HTML and CSS, for things the other elements can’t do.",
  icon: "code-xml",
  category: "code",
  propsSchema: z.object({
    html: plainText(maxCodeLength, ""),
    css: plainText(maxCodeLength, ""),
    js: plainText(maxCodeLength, ""),
    fields: z.record(z.string().max(64), plainText(10000)).default({}),
    images: z.record(z.string().max(64), codeImageSchema).default({}),
  }),
  defaultProps: {
    html: '<div class="custom">\n  <h2 data-lintel-field="heading">Made by hand</h2>\n</div>',
    css: ".custom {\n  padding: var(--lintel-space-6);\n}",
    js: "",
    fields: {},
    images: {},
  },
  allowedChildren: "none",
  // The Content panel builds its controls from the markers in the HTML instead.
  editableFields: [],
  requiresCodePermission: true,
});

export type CodeBlockProps = z.output<typeof codeBlockComponent.propsSchema>;
