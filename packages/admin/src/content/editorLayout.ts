/**
 * What sits beside the document: the side panel (status, parent, history), the live
 * preview, or nothing. The preview needs the room, so it takes the panel's place.
 */
export type Companion = "panel" | "preview" | "none";

/**
 * The editor's width for each companion. The writing column stays about 720px, a
 * comfortable line length; the side panel grows with the window (24% of the page area,
 * between 272px and 416px) and drops below the document when the page area is narrow.
 * The preview needs the room, so the split view uses the page area's full width.
 */
export const editorWidths: Record<Companion, string> = {
  panel: "max-w-[calc(47rem+clamp(17rem,24cqw,26rem))]",
  preview: "w-full",
  none: "max-w-[45rem]",
};

export const editorColumns: Record<Companion, string> = {
  panel: "grid-cols-1 gap-8 @min-[52rem]:grid-cols-[minmax(0,1fr)_clamp(17rem,24cqw,26rem)]",
  preview: "grid-cols-1 gap-6 @min-[52rem]:grid-cols-2",
  none: "grid-cols-1",
};
