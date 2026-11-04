import {
  type LiveClientMessage,
  liveCloseCodes,
  type LivePerson,
  type LiveRefusalCode,
  type LiveView,
} from "@lintel/builder-model";
import type { FastifyBaseLogger } from "fastify";
import type { SignedIn } from "../auth/auth.schema.js";
import type { Database } from "../database/client.js";
import { findEntryById } from "../entries/entries.repository.js";
import { hasPermission } from "../roles/permissions.js";
import { canWorkOnSite } from "../sites/request-site.js";
import { LiveConnection, type LiveSocket, type LiveTab } from "./live-connection.js";
import { liveLimits } from "./live-limits.js";
import { LivePresence } from "./live-presence.js";

interface HubOptions {
  /** Read on each use: setup can switch the server to another database. */
  database: () => Database;
  log: FastifyBaseLogger;
}

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
  private readonly connections = new Set<LiveConnection>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(private readonly options: HubOptions) {}

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
    const connection = new LiveConnection(socket, person, signedIn, {
      findSignedIn: opening.findSignedIn,
      onMessage: (tab, message) => this.handle(tab, message, tenantId),
      onPermissionsRead: (each) => this.takeOffWhatTheyLost(each),
      onTabClosed: (tab) => this.presence.dropTab(tab),
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

  close(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
    this.presence.close();
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
        if (mayReadSite(tab.connection.signedIn, message.siteId)) {
          this.presence.watch(tab, message.siteId);
        } else {
          refuse(tab, "NOT_ALLOWED", "You don't have access to this site.");
        }
        return;
      case "stopWatchingSite":
        this.presence.stopWatching(tab);
        return;
      case "enterPage":
        await this.enterPage(tab, message.entryId, message.view, tenantId);
        return;
      case "leavePage":
        this.presence.leave(tab, message.entryId);
        return;
      case "activity":
        this.presence.shareActivity(tab, message.entryId, message.activity);
        return;
      case "closeTab":
        return;
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
          refuse(tab, "NOT_ALLOWED", "You no longer have access to this page.", entryId);
        }
      }
    }
  }
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
