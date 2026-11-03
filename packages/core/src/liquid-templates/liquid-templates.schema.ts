import { z } from "zod";

/** One template in the templates folder, as the entry editor lists it. */
export const templateSummarySchema = z.object({
  /** Its path under `templates/` without `.liquid`: "page", "pages/wide". */
  name: z.string(),
  /** The collection it is the template of (`templates/<collection>.liquid`), or null. */
  collectionHandle: z.string().nullable(),
});

export type TemplateSummary = z.infer<typeof templateSummarySchema>;

/** `GET /website/liquid-templates` */
export const liquidTemplateListSchema = z.object({
  templates: z.array(templateSummarySchema),
});

export type LiquidTemplateList = z.infer<typeof liquidTemplateListSchema>;
