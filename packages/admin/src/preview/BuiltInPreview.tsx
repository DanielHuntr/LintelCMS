import type { ReactNode } from "react";
import type { Field } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import {
  deliveredBlocks,
  deliveredImage,
  deliveredLink,
  deliveredRichText,
  deliveredText,
} from "./deliveredValues.js";
import type { DeliveredBlock, DeliveredEntry } from "./preview.types.js";

interface BuiltInPreviewProps {
  entry: DeliveredEntry;
  fields: readonly Field[];
}

/**
 * A plain, readable page drawn from the draft exactly as the delivery API serves it, for
 * sites that aren't connected yet. It knows the block types new sites start with (Hero,
 * Text, Image, Call to action, FAQ) and shows any other field or block in a simple way.
 */
export function BuiltInPreview({ entry, fields }: BuiltInPreviewProps) {
  const title = deliveredText(entry.data.title) || t("preview.untitled");
  const otherFields = fields.filter((field) => field.handle !== "title");

  return (
    <article className="mx-auto flex max-w-[44rem] flex-col gap-8 px-6 py-10 text-label">
      <h1 className="text-large-title text-balance">{title}</h1>
      {otherFields.map((field) => (
        <PreviewField key={field.handle} field={field} value={entry.data[field.handle]} />
      ))}
    </article>
  );
}

function PreviewField({ field, value }: { field: Field; value: unknown }): ReactNode {
  if (value === null || value === undefined) return null;

  switch (field.type) {
    case "blocks": {
      const blockTypes = field.options.blockTypes ?? [];
      return (
        <div className="flex flex-col gap-10">
          {deliveredBlocks(value).map((block) => (
            <PreviewBlock
              key={block.id}
              block={block}
              fields={blockTypes.find((type) => type.handle === block.type)?.fields ?? []}
            />
          ))}
        </div>
      );
    }
    case "richText":
      return <RichText html={deliveredRichText(value)} />;
    case "image":
      return <PreviewImage value={value} />;
    case "link":
      return <PreviewButton value={value} />;
    case "textarea":
      return (
        <p className="text-headline font-normal text-label-secondary">{deliveredText(value)}</p>
      );
    case "text":
      return <p className="text-body">{deliveredText(value)}</p>;
    default:
      return (
        <p className="text-footnote text-label-secondary">
          {field.label}: {Array.isArray(value) ? value.join(", ") : String(value)}
        </p>
      );
  }
}

/** The default block types get a layout like a real site's; others list their fields. */
function PreviewBlock({ block, fields }: { block: DeliveredBlock; fields: readonly Field[] }) {
  const { data } = block;

  switch (block.type) {
    case "hero": {
      const image = deliveredImage(data.image);
      return (
        <section className="relative overflow-hidden rounded-panel bg-fill">
          {image && (
            <img
              src={image.url}
              alt={image.alt}
              className="absolute inset-0 size-full object-cover opacity-35"
            />
          )}
          <div className="relative flex flex-col items-start gap-3 px-8 py-14">
            <h2 className="text-large-title text-balance">{deliveredText(data.heading)}</h2>
            {deliveredText(data.subheading) && (
              <p className="max-w-prose text-headline font-normal text-label-secondary">
                {deliveredText(data.subheading)}
              </p>
            )}
            <PreviewButton value={data.button} />
          </div>
        </section>
      );
    }
    case "text":
      return (
        <section className="flex flex-col gap-3">
          {deliveredText(data.heading) && (
            <h2 className="text-title">{deliveredText(data.heading)}</h2>
          )}
          <RichText html={deliveredRichText(data.body)} />
        </section>
      );
    case "image":
      return <PreviewImage value={data.image} caption={deliveredText(data.caption)} />;
    case "call_to_action":
      return (
        <section className="flex flex-col items-center gap-3 rounded-panel bg-accent/10 px-8 py-10 text-center">
          <h2 className="text-title text-balance">{deliveredText(data.heading)}</h2>
          {deliveredText(data.text) && (
            <p className="max-w-prose text-body text-label-secondary">{deliveredText(data.text)}</p>
          )}
          <PreviewButton value={data.button} />
        </section>
      );
    case "faq":
      return (
        <details className="group rounded-card bg-fill/60 px-5 py-4" open>
          <summary className="cursor-pointer text-headline">{deliveredText(data.question)}</summary>
          <div className="mt-3">
            <RichText html={deliveredRichText(data.answer)} />
          </div>
        </details>
      );
    default:
      return (
        <section className="flex flex-col gap-4">
          {fields.map((field) => (
            <PreviewField key={field.handle} field={field} value={data[field.handle]} />
          ))}
        </section>
      );
  }
}

/**
 * Rich text HTML from the API. It is rendered on the server from the editor's own schema,
 * which only knows paragraphs, headings, lists, quotes and safe links, so it can't carry
 * scripts or event handlers.
 */
function RichText({ html }: { html: string }) {
  if (html === "") return null;
  return <div className="rich-text" dangerouslySetInnerHTML={{ __html: html }} />;
}

function PreviewImage({ value, caption }: { value: unknown; caption?: string }) {
  const image = deliveredImage(value);
  if (!image) return null;
  return (
    <figure className="flex flex-col gap-2">
      <img
        src={image.url}
        alt={image.alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        className="h-auto w-full rounded-card"
      />
      {caption && <figcaption className="text-footnote text-label-secondary">{caption}</figcaption>}
    </figure>
  );
}

/** Links in the preview don't navigate: following one would leave the editor's preview. */
function PreviewButton({ value }: { value: unknown }) {
  const link = deliveredLink(value);
  if (!link) return null;
  return (
    <span
      title={link.url}
      className="inline-flex h-10 items-center rounded-control bg-accent-fill px-5 text-body font-medium text-on-accent"
    >
      {link.label || link.url}
    </span>
  );
}
