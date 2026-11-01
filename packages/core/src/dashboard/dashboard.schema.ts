import { z } from "zod";

/** How much of the dashboard's width a widget takes: a third, a half, or all of it. */
export const widgetSizes = ["small", "medium", "large"] as const;

/** "core:recent-edits", or "<plugin id>:<widget>" for a plugin's widget. */
const WIDGET_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;

/** The most widgets one dashboard can hold; far more than fit on a screen. */
export const MAX_WIDGETS = 40;

export const widgetPlacementSchema = z.object({
  widget: z
    .string({ error: "Each widget needs an id" })
    .regex(WIDGET_ID_PATTERN, { error: 'Widget ids look like "core:recent-edits"' }),
  size: z.enum(widgetSizes, { error: "The size should be small, medium or large" }),
});

export const dashboardLayoutSchema = z
  .array(widgetPlacementSchema, { error: "Please send a list of widgets" })
  .max(MAX_WIDGETS, { error: `A dashboard can have at most ${MAX_WIDGETS} widgets` })
  .refine((widgets) => new Set(widgets.map(({ widget }) => widget)).size === widgets.length, {
    error: "Each widget can only be on the dashboard once",
  });

/** `PUT /dashboard/layout` and `PUT /dashboard/role-layouts/:roleId` */
export const saveDashboardLayoutRequestSchema = z.object({ widgets: dashboardLayoutSchema });

export const roleIdParamsSchema = z.object({ roleId: z.uuid() });

/**
 * Where someone's layout came from: their own, their role's default, or nothing saved
 * (`widgets` is null, and the admin uses its built-in default).
 */
export const layoutSources = ["user", "role", "default"] as const;

export const dashboardLayoutResponseSchema = z.object({
  widgets: z.array(widgetPlacementSchema).nullable(),
  source: z.enum(layoutSources),
});

export const roleLayoutsResponseSchema = z.object({
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      widgets: z.array(widgetPlacementSchema).nullable(),
    }),
  ),
});

export type WidgetSize = (typeof widgetSizes)[number];
export type WidgetPlacement = z.infer<typeof widgetPlacementSchema>;
export type DashboardLayoutResponse = z.infer<typeof dashboardLayoutResponseSchema>;
export type RoleLayoutsResponse = z.infer<typeof roleLayoutsResponseSchema>;
