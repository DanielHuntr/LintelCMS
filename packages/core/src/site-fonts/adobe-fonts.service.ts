import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { Site } from "../sites/sites.table.js";
import { AdobeProjectEmptyError, AdobeProjectNotFoundError } from "./site-fonts.errors.js";
import {
  deleteAdobeProjectRows,
  findSiteFontRowByFamily,
  insertSiteFontRow,
} from "./site-fonts.repository.js";
import type { SiteFontsResponse } from "./site-fonts.schema.js";
import { listSiteFonts, type SiteFontsContext } from "./site-fonts.service.js";

/**
 * Adobe Fonts: a web project, connected by its ID. Lintel reads the project's stylesheet to
 * list its families; Adobe serves the fonts, and the website links to Adobe's stylesheet
 * on every page, as Adobe's licence asks. Connecting the same project again picks up
 * families added to it since.
 */
export async function connectAdobeProject(
  context: SiteFontsContext,
  site: Site,
  projectId: string,
): Promise<SiteFontsResponse> {
  const families = await context.adobe.readProject(projectId);
  if (families === null) throw new AdobeProjectNotFoundError();
  if (families.length === 0) throw new AdobeProjectEmptyError();

  await context.database.transaction(async (transaction) => {
    await deleteAdobeProjectRows(transaction, DEFAULT_TENANT_ID, site.id, projectId);
    for (const [index, family] of families.entries()) {
      // A family the site already has from somewhere else keeps that one.
      const taken = await findSiteFontRowByFamily(
        transaction,
        DEFAULT_TENANT_ID,
        site.id,
        family.family,
      );
      if (taken) continue;
      await insertSiteFontRow(transaction, {
        tenantId: DEFAULT_TENANT_ID,
        siteId: site.id,
        family: family.family,
        category: family.category,
        source: "adobe",
        sourceId: projectId,
        files: [],
        sortOrder: index,
      });
    }
  });
  return listSiteFonts(context, site);
}

export async function disconnectAdobeProject(
  context: SiteFontsContext,
  site: Site,
  projectId: string,
): Promise<SiteFontsResponse> {
  await deleteAdobeProjectRows(context.database, DEFAULT_TENANT_ID, site.id, projectId);
  return listSiteFonts(context, site);
}
