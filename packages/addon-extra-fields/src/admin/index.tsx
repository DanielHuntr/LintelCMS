import { defineAdminPlugin } from "@lintel/admin/plugin";
import { LocationEditor } from "./LocationEditor.js";
import { PaletteEditor } from "./PaletteEditor.js";

/**
 * The admin half of the Extra fields add-on: the editors for its two fields. It has no
 * screens or settings; the fields appear in "Add a field" while the add-on is on.
 * `pnpm build` bundles this into dist/admin.js.
 */
export default defineAdminPlugin({
  id: "extra-fields",
  fieldEditors: [
    { type: "extra-fields.location", Editor: LocationEditor, labelling: () => "group" },
    { type: "extra-fields.palette", Editor: PaletteEditor, labelling: () => "group" },
  ],
});
