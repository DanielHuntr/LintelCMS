import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";

/**
 * The language each person chose for the admin's own words (menus, buttons, messages).
 * Not the language of the site's content: that is src/sites/locales. People without a row
 * see the site's default interface language.
 */
export const userInterfaceLanguagesTable = pgTable(
  "user_interface_languages",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** A language tag such as "en" or "fr-CA". */
    language: text("language").notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("user_interface_languages_user_unique").on(table.userId)],
);
