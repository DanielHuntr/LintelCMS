import type { PageHead } from "./page-head.types.js";

/**
 * The `<head>` tags for one page: title, description, canonical address, robots, Open
 * Graph and alternate languages. The stylesheet is one cached file, so pages after the
 * first load nothing but their HTML and pictures.
 */
export function HeadTags({
  head,
  locale,
  stylesheetUrl,
  fontStylesheetUrls = [],
}: {
  head: PageHead;
  locale: string;
  stylesheetUrl: string;
  /** Font services' stylesheets (an Adobe Fonts project's), linked as their licences ask. */
  fontStylesheetUrls?: readonly string[];
}) {
  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{head.title}</title>
      {head.description && <meta name="description" content={head.description} />}
      {head.canonicalUrl && <link rel="canonical" href={head.canonicalUrl} />}
      {head.noindex && <meta name="robots" content="noindex" />}
      {head.alternates.map((alternate) => (
        <link
          key={alternate.locale}
          rel="alternate"
          hrefLang={alternate.locale}
          href={alternate.url}
        />
      ))}
      <meta property="og:type" content={head.type} />
      <meta property="og:title" content={head.title} />
      {head.description && <meta property="og:description" content={head.description} />}
      {head.canonicalUrl && <meta property="og:url" content={head.canonicalUrl} />}
      {head.siteName && <meta property="og:site_name" content={head.siteName} />}
      <meta property="og:locale" content={locale.replace("-", "_")} />
      {head.image && <meta property="og:image" content={head.image.url} />}
      {head.image?.width && <meta property="og:image:width" content={String(head.image.width)} />}
      {head.image?.height && (
        <meta property="og:image:height" content={String(head.image.height)} />
      )}
      {head.image?.alt && <meta property="og:image:alt" content={head.image.alt} />}
      {head.publishedAt && head.type === "article" && (
        <meta property="article:published_time" content={head.publishedAt} />
      )}
      <meta name="twitter:card" content={head.image ? "summary_large_image" : "summary"} />
      {fontStylesheetUrls.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      <link rel="stylesheet" href={stylesheetUrl} />
    </>
  );
}
