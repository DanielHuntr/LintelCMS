import { findDeliveredDraft } from "../delivery/delivery.service.js";
import { PreviewTokenExpiredError, PreviewTokenInvalidError } from "../preview/preview.errors.js";
import { readPreviewToken } from "../preview/preview.service.js";
import type { SiteResponse } from "./rendered-pages-cache.js";
import { localiseUrl } from "./site-chrome.service.js";
import {
  type PageRequest,
  readSiteChrome,
  readSiteContext,
  renderEntry,
  renderMessage,
  type SiteDependencies,
} from "./site-pages.service.js";
import { splitLocale } from "./site-routing.js";

/**
 * Live preview on the real site: an address with `?preview=<token>` shows that entry's
 * working copy, drawn by the same template as the published page. The token is checked
 * exactly as the delivery API checks it (see src/preview); the page is never cached and
 * never indexed. A bad or expired token shows a page saying to open the preview again.
 */
export async function renderPreview(
  dependencies: SiteDependencies,
  path: string,
  token: string,
): Promise<SiteResponse> {
  const context = await readSiteContext(dependencies);
  const { locale: pathLocale, path: localPath } = splitLocale(
    path,
    context.defaultLocale,
    context.locales.map(({ code }) => code),
  );
  const request = async (locale: string): Promise<PageRequest> => ({
    dependencies,
    context,
    chrome: await readSiteChrome(dependencies, context, locale),
    locale,
    localPath,
    path,
    query: { page: 1 },
  });

  let entryId: string;
  try {
    entryId = await readPreviewToken(dependencies.database, token);
  } catch (error) {
    if (error instanceof PreviewTokenExpiredError || error instanceof PreviewTokenInvalidError) {
      return renderMessage(
        await request(pathLocale),
        { kind: "message", title: "This preview has ended", text: error.message },
        401,
      );
    }
    throw error;
  }

  const draft = await findDeliveredDraft(dependencies.database, entryId, dependencies.assetLookup);
  if (!draft) {
    return renderMessage(
      await request(pathLocale),
      {
        kind: "message",
        title: "This preview has ended",
        text: new PreviewTokenInvalidError().message,
      },
      401,
    );
  }
  const draftRequest = await request(draft.entry.locale);
  const draftPath = localiseUrl(draft.entry.url ?? path, draft.entry.locale, context);
  return renderEntry({ ...draftRequest, path: draftPath }, draft.collectionHandle, draft.entry, {
    private: true,
  });
}
