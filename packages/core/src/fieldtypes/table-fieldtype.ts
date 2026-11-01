import { z } from "zod";
import { defineFieldtype } from "./fieldtype.js";

/**
 * A simple table of text, such as opening hours or a price list, stored as rows of cells:
 *
 *   [["Day", "Opens"], ["Monday", "9am"]]
 *
 * Every row has the same number of cells. With `headerRow` (the default) the first row is
 * the column headings.
 */
export const tableFieldtype = defineFieldtype({
  type: "table",
  name: "Table",
  description: "A small table of text in rows and columns, such as opening hours or prices.",
  category: "structure",
  keywords: ["grid", "spreadsheet", "rows", "columns", "matrix", "schedule"],
  optionsSchema: z.object({
    headerRow: z.boolean({ error: "headerRow should be true or false" }).default(true),
    maxRows: z
      .number({ error: "The most rows should be a number" })
      .int({ error: "The most rows should be a whole number" })
      .positive({ error: "The most rows should be more than 0" })
      .optional(),
    maxColumns: z
      .number({ error: "The most columns should be a number" })
      .int({ error: "The most columns should be a whole number" })
      .positive({ error: "The most columns should be more than 0" })
      .max(20, { error: "A table can have at most 20 columns" })
      .optional(),
  }),
  buildValueSchema: ({ maxRows, maxColumns }, label) =>
    z
      .array(
        z.array(
          z
            .string({ error: `Each cell in ${label} should be text` })
            .max(1000, { error: `Cells in ${label} can be at most 1000 characters` }),
          { error: `${label} should be rows of cells` },
        ),
        { error: `${label} should be rows of cells` },
      )
      .refine((rows) => rows.every((row) => row.length === rows[0]?.length), {
        error: `Every row in ${label} should have the same number of cells`,
      })
      .refine((rows) => maxRows === undefined || rows.length <= maxRows, {
        error: `${label} can have at most ${maxRows} rows`,
      })
      .refine((rows) => (rows[0]?.length ?? 0) <= (maxColumns ?? 20), {
        error: `${label} can have at most ${maxColumns ?? 20} columns`,
      }),
  isEmpty: (value) =>
    Array.isArray(value) &&
    value.every(
      (row) =>
        Array.isArray(row) && row.every((cell) => typeof cell === "string" && cell.trim() === ""),
    ),
});
