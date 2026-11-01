import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { rolesTable } from "../roles/roles.table.js";
import { usersTable } from "../users/users.table.js";
import type { WidgetPlacement } from "./dashboard.schema.js";

/**
 * A home dashboard's widgets, in order, with their sizes. A row belongs either to one
 * person (their own layout) or to one role (the layout people with that role start from),
 * never both. Widgets are named by id ("core:recent-edits", "bookings:today"); the admin
 * knows what each one is, so the server only checks the shape.
 */
export const dashboardLayoutsTable = pgTable(
  "dashboard_layouts",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").references(() => rolesTable.id, { onDelete: "cascade" }),
    widgets: jsonb("widgets").$type<WidgetPlacement[]>().notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("dashboard_layouts_tenant_user_unique").on(table.tenantId, table.userId),
    uniqueIndex("dashboard_layouts_tenant_role_unique").on(table.tenantId, table.roleId),
    check(
      "dashboard_layouts_one_owner",
      sql`(${table.userId} is null) <> (${table.roleId} is null)`,
    ),
  ],
);
