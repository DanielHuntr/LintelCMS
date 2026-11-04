import { z } from "zod";
import type { PageDocument } from "../document/page-document.schema.js";
import { type PageChange, pageChangesSchema } from "./page-changes.js";

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
const fieldHandleSchema = z.string().min(1).max(100);
const requestIdSchema = z.string().min(1).max(100);

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
  /** Start editing a page's design with whoever else has it open. */
  z.object({
    type: z.literal("openDesign"),
    tab: tabIdSchema,
    entryId: entryIdSchema,
    field: fieldHandleSchema,
  }),
  z.object({
    type: z.literal("closeDesign"),
    tab: tabIdSchema,
    entryId: entryIdSchema,
    field: fieldHandleSchema,
  }),
  z.object({
    type: z.literal("changes"),
    tab: tabIdSchema,
    entryId: entryIdSchema,
    field: fieldHandleSchema,
    batch: requestIdSchema,
    changes: pageChangesSchema,
  }),
  /** Store the design now, rather than shortly: for leaving, publishing and previews. */
  z.object({
    type: z.literal("storeDesign"),
    tab: tabIdSchema,
    entryId: entryIdSchema,
    field: fieldHandleSchema,
    request: requestIdSchema,
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
  | { type: "refused"; tab: string; code: LiveRefusalCode; entryId?: string; message: string }
  | {
      type: "designOpened";
      tab: string;
      entryId: string;
      field: string;
      /** Changes when the server has started this design afresh, such as after a restart. */
      session: string;
      sequence: number;
      version: number;
      document: PageDocument;
      /** False for someone who may only look: their changes would be refused. */
      canEdit: boolean;
    }
  /** Someone else's steps, or changes saved another way. */
  | {
      type: "designChanged";
      tab: string;
      entryId: string;
      field: string;
      sequence: number;
      personId: string | null;
      changes: readonly PageChange[];
    }
  | {
      type: "changesAccepted";
      tab: string;
      entryId: string;
      field: string;
      batch: string;
      sequence: number;
    }
  | {
      type: "changesRefused";
      tab: string;
      entryId: string;
      field: string;
      batch: string;
      code: string;
      message: string;
    }
  /** Everything up to `sequence` is stored. `request` answers a `storeDesign`. */
  | {
      type: "designStored";
      tab: string;
      entryId: string;
      field: string;
      sequence: number;
      version: number;
      hasUnpublishedChanges: boolean;
      request?: string;
    }
  | {
      type: "designNotStored";
      tab: string;
      entryId: string;
      field: string;
      message: string;
      request?: string;
    }
  /** Something about the page changed, for anyone on it. */
  | {
      type: "entryChanged";
      tab: string;
      entryId: string;
      version: number;
      personId: string | null;
      /** "saved", or what else happened to it. */
      what: "saved" | "published" | "unpublished" | "deleted";
      /** The fields a save changed. */
      fields: readonly string[];
    };

/** Why the server closed a connection. A browser doesn't reconnect after `signedOut`. */
export const liveCloseCodes = {
  signedOut: 4401,
  tooManyConnections: 4429,
  tooManyMessages: 4408,
} as const;
