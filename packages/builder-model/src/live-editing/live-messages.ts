import { z } from "zod";

/**
 * What browsers and the server say to each other over the live connection
 * (`GET /live`, see packages/core/src/collaboration). One browser keeps one connection,
 * shared by its tabs, so every message says which tab it is for.
 *
 * Everything a browser sends is checked against these schemas before it is read.
 */

/** The most elements someone can have selected for others to see. */
export const maxSharedSelection = 50;

const tabIdSchema = z.string().min(1).max(64);
const entryIdSchema = z.uuid();
const elementIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const liveViews = ["content", "design", "children"] as const;
export type LiveView = (typeof liveViews)[number];

/** Where someone's pointer is: on an element, as a share of its width and height. */
export const livePointerSchema = z.object({
  nodeId: elementIdSchema,
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type LivePointer = z.infer<typeof livePointerSchema>;

/** What someone is doing on a page, for the others there to see. */
export const liveActivitySchema = z.object({
  pointer: livePointerSchema.nullable(),
  selection: z.array(elementIdSchema).max(maxSharedSelection),
  /** The field they are typing in, in the page's Content view. */
  field: z.string().max(100).nullable(),
});
export type LiveActivity = z.infer<typeof liveActivitySchema>;

export const liveClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping"), tab: tabIdSchema }),
  /** This tab has closed. */
  z.object({ type: z.literal("closeTab"), tab: tabIdSchema }),
  /** Tell this tab who is on which page of a site, for the content tree. */
  z.object({ type: z.literal("watchSite"), tab: tabIdSchema, siteId: z.uuid() }),
  z.object({ type: z.literal("stopWatchingSite"), tab: tabIdSchema }),
  z.object({
    type: z.literal("enterPage"),
    tab: tabIdSchema,
    entryId: entryIdSchema,
    view: z.enum(liveViews),
  }),
  z.object({ type: z.literal("leavePage"), tab: tabIdSchema, entryId: entryIdSchema }),
  z.object({
    type: z.literal("activity"),
    tab: tabIdSchema,
    entryId: entryIdSchema,
    activity: liveActivitySchema,
  }),
]);
export type LiveClientMessage = z.infer<typeof liveClientMessageSchema>;

/** Someone signed in, as the people they work with see them. */
export interface LivePerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** Someone on a page, and which of its views they have open. */
export interface LiveAttendee extends LivePerson {
  view: LiveView;
}

export type LiveRefusalCode = "NOT_ALLOWED" | "NOT_FOUND" | "SLOW_DOWN" | "BAD_MESSAGE";

export type LiveServerMessage =
  /** The connection is open and signed in as this person. Goes to every tab. */
  | { type: "welcome"; tab: "*"; personId: string }
  | { type: "pong"; tab: string }
  /** Who is on the pages of a site: only pages with someone on them are listed. */
  | { type: "peopleOnPages"; tab: string; siteId: string; pages: Record<string, LivePerson[]> }
  | { type: "peopleHere"; tab: string; entryId: string; people: LiveAttendee[] }
  | { type: "activity"; tab: string; entryId: string; personId: string; activity: LiveActivity }
  /** A request wasn't allowed. `entryId` says which page, when it was about one. */
  | { type: "refused"; tab: string; code: LiveRefusalCode; entryId?: string; message: string };

/** Why the server closed a connection. A browser doesn't reconnect after `signedOut`. */
export const liveCloseCodes = {
  signedOut: 4401,
  tooManyConnections: 4429,
  tooManyMessages: 4408,
} as const;
