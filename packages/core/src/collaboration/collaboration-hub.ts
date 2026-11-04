import {
  type LiveClientMessage,
  liveCloseCodes,
  type LivePerson,
  type LiveRefusalCode,
  type LiveServerMessage,
  type LiveView,
} from "@lintel/builder-model";
import type { FastifyBaseLogger } from "fastify";
import type { SignedIn } from "../auth/auth.schema.js";
import type { Database } from "../database/client.js";
import { findEntryById } from "../entries/entries.repository.js";
import type { Entry } from "../entries/entries.table.js";
import type { AssetExists } from "../fieldtypes/image-assets.js";
import { hasPermission } from "../roles/permissions.js";
import { canWorkOnSite } from "../sites/request-site.js";
import { findSiteById } from "../sites/sites.repository.js";
import { LiveConnection, type LiveSocket, type LiveTab } from "./live-connection.js";
import { checkDesignChange, readStoredDesign, storeDesign } from "./live-design.service.js";
import { LiveDesignRooms } from "./live-design-rooms.js";
import { liveLimits } from "./live-limits.js";
import { LivePresence } from "./live-presence.js";

interface HubOptions {
  /** Read on each use: setup can switch the server to another database. */
  database: () => Database;
  log: FastifyBaseLogger;
  assetExists: () => AssetExists;
  /** Tells the rest of Lintel a stored design changed the entry, as a save does. */
  announceStored: (entryId: string, field: string, author: SignedIn | null) => Promise<void>;
}

/** What happened to a page, for the people on it. */
export type PageNews = Omit<
  Extract<LiveServerMessage, { type: "entryChanged" }>,
  "type" | "tab" | "entryId"
>;

/** What the hub needs to know about the person opening a connection. */
export interface OpeningConnection {
  socket: LiveSocket;
  person: LivePerson;
  signedIn: SignedIn;
  /** The tenant the person belongs to: they only ever see that tenant's pages. */
  tenantId: string;
  findSignedIn: () => Promise<SignedIn | undefined>;
}

/**
 * Everyone connected, and what happens when they say something. Every request is checked
 * here against what the person may do now, whatever the admin chose to show them.
 */
export class CollaborationHub {
  readonly presence = new LivePresence();
  private readonly rooms: LiveDesignRooms;
  private readonly connections = new Set<LiveConnection>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(private readonly options: HubOptions) {
    const onError = (error: unknown) =>
      options.log.error(error, "Live editing of a page had a problem");
    this.rooms = new LiveDesignRooms({
      onError,
      servicesFor: (entryId, field) => ({
        onError,
        read: () => readStoredDesign(options.database(), entryId, field),
        check: (entry, before, after, signedIn) =>
          checkDesignChange(options.database(), entry, field, before, after, {
            assetExists: options.assetExists(),
            permissions: signedIn.permissions,
          }),
        store: async (document, author) => {
          const stored = await storeDesign(options.database(), entryId, field, document, {
            assetExists: options.assetExists(),
            authorId: author?.user.id ?? null,
          });
          if (stored) await options.announceStored(entryId, field, author);
          return stored;
        },
      }),
    });
  }

  open(opening: OpeningConnection): void {
    const { socket, person, signedIn, tenantId } = opening;
    const theirs = [...this.connections].filter((each) => each.person.id === person.id);
    if (
      this.connections.size >= liveLimits.maxConnections ||
      theirs.length >= liveLimits.maxConnectionsPerPerson
    ) {
      socket.close(liveCloseCodes.tooManyConnections, "Too many connections");
      return;
    }
    const onRoomError = (error: unknown) =>
      this.options.log.error(error, "Leaving a page design had a problem");
    const connection = new LiveConnection(socket, person, signedIn, {
      findSignedIn: opening.findSignedIn,
      onMessage: (tab, message) => this.handle(tab, message, tenantId),
      onPermissionsRead: (each) => this.takeOffWhatTheyLost(each),
      onTabClosed: (tab) => {
        this.presence.dropTab(tab);
        void this.rooms.dropTab(tab).catch(onRoomError);
      },
      onClosed: (each) => this.connections.delete(each),
      onError: (error) => this.options.log.error(error, "The live connection had a problem"),
    });
    this.connections.add(connection);
    this.startSweeping();
  }

  /** Pings every connection, and reads again what each person may do. */
  sweep(): void {
    for (const connection of this.connections) connection.sweep();
  }

  connectionCount(): number {
    return this.connections.size;
  }

  /** Stores the page's open designs, for anything about to read or replace the saved one. */
  storeOpenDesigns(entryId: string): Promise<void> {
    return this.rooms.storeEntry(entryId);
  }

  /**
   * Something happened to a page: the people on it hear, and open designs take in a save made
   * some other way. It doesn't wait for any of that, because stores announce themselves here.
   */
  entryChanged(entryId: string, news: PageNews): void {
    for (const tab of this.presence.tabsOnPage(entryId)) {
      tab.connection.send({ type: "entryChanged", tab: tab.id, entryId, ...news });
    }
    if (news.what === "saved") {
      void this.rooms.takeInSave(entryId, news.personId).catch((error: unknown) => {
        this.options.log.error(error, "Taking a saved change into a live design had a problem");
      });
    }
  }

  /** Stores what's open and stops, when the server is closing. */
  async close(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
    this.presence.close();
    await this.rooms.storeAll();
  }

  private startSweeping(): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => {
      this.sweep();
    }, liveLimits.sweepEveryMilliseconds);
    this.sweepTimer.unref();
  }

  private async handle(tab: LiveTab, message: LiveClientMessage, tenantId: string): Promise<void> {
    switch (message.type) {
      case "ping":
        tab.connection.send({ type: "pong", tab: tab.id });
        return;
      case "watchSite":
        await this.watchSite(tab, message.siteId, tenantId);
        return;
      case "stopWatchingSite":
        this.presence.stopWatching(tab);
        return;
      case "enterPage":
        await this.enterPage(tab, message.entryId, message.view, tenantId);
        return;
      case "leavePage":
        this.presence.leave(tab, message.entryId);
        await this.rooms.dropTab(tab, message.entryId);
        return;
      case "activity":
        this.presence.shareActivity(tab, message.entryId, message.activity);
        return;
      case "openDesign":
        await this.openDesign(tab, message.entryId, message.field, tenantId);
        return;
      case "closeDesign":
        await this.rooms.leave(tab, message.entryId, message.field);
        return;
      case "changes":
        await this.changeDesign(tab, message);
        return;
      case "storeDesign":
        await this.storeDesign(tab, message);
        return;
      case "closeTab":
        return;
    }
  }

  private async openDesign(
    tab: LiveTab,
    entryId: string,
    field: string,
    tenantId: string,
  ): Promise<void> {
    // Being on the page is what checked they may see it, so there's no other way in.
    if (!tab.pages.has(entryId)) {
      refuse(tab, "NOT_FOUND", "This page doesn't exist.", entryId);
      return;
    }
    const entry = await findEntryById(this.options.database(), entryId);
    if (!entry || entry.tenantId !== tenantId) {
      refuse(tab, "NOT_FOUND", "This page doesn't exist.", entryId);
      return;
    }
    const canEdit = mayEditEntry(tab.connection.signedIn, entry);
    if (!(await this.rooms.join(tab, entryId, field, canEdit))) {
      refuse(tab, "NOT_FOUND", "This design can't be edited live.", entryId);
    }
  }

  private async changeDesign(
    tab: LiveTab,
    message: Extract<LiveClientMessage, { type: "changes" }>,
  ): Promise<void> {
    const { entryId, field, batch, changes } = message;
    const entry = await findEntryById(this.options.database(), entryId);
    if (!entry || !tab.pages.has(entryId) || !mayEditEntry(tab.connection.signedIn, entry)) {
      tab.connection.send({
        type: "changesRefused",
        tab: tab.id,
        entryId,
        field,
        batch,
        code: "NOT_ALLOWED",
        message: "You can't change this page.",
      });
      return;
    }
    if (!(await this.rooms.change(tab, entryId, field, batch, changes))) {
      refuse(tab, "NOT_FOUND", "This design isn't open.", entryId);
    }
  }

  private async storeDesign(
    tab: LiveTab,
    message: Extract<LiveClientMessage, { type: "storeDesign" }>,
  ): Promise<void> {
    const room = await this.rooms.roomOf(tab, message.entryId, message.field);
    if (room) await room.store(tab, message.request);
    else refuse(tab, "NOT_FOUND", "This design isn't open.", message.entryId);
  }

  private async watchSite(tab: LiveTab, siteId: string, tenantId: string): Promise<void> {
    const site = await findSiteById(this.options.database(), siteId);
    if (site?.tenantId === tenantId && mayReadSite(tab.connection.signedIn, siteId)) {
      this.presence.watch(tab, siteId);
    } else {
      refuse(tab, "NOT_ALLOWED", "You don't have access to this site.");
    }
  }

  private async enterPage(
    tab: LiveTab,
    entryId: string,
    view: LiveView,
    tenantId: string,
  ): Promise<void> {
    if (!tab.pages.has(entryId) && tab.pages.size >= liveLimits.maxPagesPerTab) {
      refuse(tab, "SLOW_DOWN", "This tab is on too many pages.", entryId);
      return;
    }
    const entry = await findEntryById(this.options.database(), entryId);
    // Not found and not allowed read the same, so nobody learns what exists.
    const mayEnter =
      entry?.tenantId === tenantId && mayReadSite(tab.connection.signedIn, entry.siteId);
    if (!entry || !mayEnter) {
      refuse(tab, "NOT_FOUND", "This page doesn't exist.", entryId);
      return;
    }
    this.presence.enter(tab, { entryId, siteId: entry.siteId }, view);
  }

  /** After someone's permissions were read again: takes them off whatever they lost. */
  private takeOffWhatTheyLost(connection: LiveConnection): void {
    for (const tab of connection.tabs.values()) {
      if (tab.watchedSiteId && !mayReadSite(connection.signedIn, tab.watchedSiteId)) {
        this.presence.stopWatching(tab);
      }
      for (const entryId of [...tab.pages]) {
        const page = this.presence.findPage(entryId);
        if (page && !mayReadSite(connection.signedIn, page.siteId)) {
          this.presence.leave(tab, entryId);
          void this.rooms.dropTab(tab, entryId);
          refuse(tab, "NOT_ALLOWED", "You no longer have access to this page.", entryId);
        }
      }
    }
  }
}

/** The same rule as `requireEntryPermission("update")`, for one entry. */
function mayEditEntry(signedIn: SignedIn, entry: Entry): boolean {
  if (!canWorkOnSite(signedIn, entry.siteId)) return false;
  return (
    hasPermission(signedIn.permissions, "entries:update") ||
    (hasPermission(signedIn.permissions, "entries:update-own") &&
      entry.createdBy === signedIn.user.id)
  );
}

function mayReadSite(signedIn: SignedIn, siteId: string): boolean {
  return hasPermission(signedIn.permissions, "entries:read") && canWorkOnSite(signedIn, siteId);
}

function refuse(tab: LiveTab, code: LiveRefusalCode, message: string, entryId?: string): void {
  tab.connection.send({
    type: "refused",
    tab: tab.id,
    code,
    message,
    ...(entryId === undefined ? {} : { entryId }),
  });
}
