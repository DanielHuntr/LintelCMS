import type { PageChange } from "@lintel/builder-model";
import type { LiveTab } from "./live-connection.js";
import { LiveDesignRoom, type RoomServices } from "./live-design-room.js";
import { liveLimits } from "./live-limits.js";
import type { StoredDesign } from "./live-design.service.js";

const roomKey = (entryId: string, field: string) => `${entryId}\n${field}`;

interface RoomsOptions {
  /** What a room for this design should use. */
  servicesFor: (entryId: string, field: string) => RoomServices;
  onError: (error: unknown) => void;
}

/** The designs open now. A room opens with its first person and closes with its last. */
export class LiveDesignRooms {
  private readonly rooms = new Map<string, Promise<LiveDesignRoom | null>>();

  constructor(private readonly options: RoomsOptions) {}

  /** Puts someone in a design's room. False if the design can't be opened this way. */
  async join(tab: LiveTab, entryId: string, field: string, canEdit: boolean): Promise<boolean> {
    const room = await this.open(entryId, field);
    if (!room) return false;
    await room.join(tab, canEdit);
    return true;
  }

  /** The room, if this tab is in it. */
  async roomOf(tab: LiveTab, entryId: string, field: string): Promise<LiveDesignRoom | null> {
    const room = await this.rooms.get(roomKey(entryId, field));
    return room?.tabs.has(tab) ? room : null;
  }

  async change(
    tab: LiveTab,
    entryId: string,
    field: string,
    batch: string,
    changes: readonly PageChange[],
  ): Promise<boolean> {
    const room = await this.roomOf(tab, entryId, field);
    if (!room) return false;
    await room.change(tab, batch, changes);
    return true;
  }

  async leave(tab: LiveTab, entryId: string, field: string): Promise<void> {
    const key = roomKey(entryId, field);
    const room = await this.rooms.get(key);
    if (!room) return;
    room.leave(tab);
    if (room.tabs.size === 0) await this.closeOnceStored(key, room, 1);
  }

  /** A room isn't given up while it holds changes that could still be stored. */
  private async closeOnceStored(key: string, room: LiveDesignRoom, tries: number): Promise<void> {
    await room.store().catch(this.options.onError);
    // Someone may have come in while that was being stored.
    if (room.tabs.size > 0) return;
    if (room.isDirty && tries < liveLimits.storeTriesAfterEveryoneLeft) {
      setTimeout(() => {
        void this.closeOnceStored(key, room, tries + 1).catch(this.options.onError);
      }, liveLimits.retryStoreAfterMilliseconds).unref();
      return;
    }
    if (room.isDirty)
      this.options.onError(new Error(`Gave up storing the design of ${room.entryId}`));
    room.close();
    this.rooms.delete(key);
  }

  /** Takes a tab out of every room for a page, or all of them. */
  async dropTab(tab: LiveTab, entryId?: string): Promise<void> {
    for (const pending of [...this.rooms.values()]) {
      const room = await pending;
      if (room?.tabs.has(tab) && (entryId === undefined || room.entryId === entryId)) {
        await this.leave(tab, room.entryId, room.field);
      }
    }
  }

  /** Stores the page's open designs, so whatever comes next sees them. */
  async storeEntry(entryId: string): Promise<void> {
    for (const room of await this.roomsOf(entryId)) await room.store();
  }

  async takeInSave(entryId: string, personId: string | null): Promise<void> {
    for (const room of await this.roomsOf(entryId)) await room.takeInSave(personId);
  }

  /** Stores everything, for shutting down. */
  async storeAll(): Promise<void> {
    for (const pending of [...this.rooms.values()]) {
      const room = await pending;
      await room?.store().catch(this.options.onError);
      room?.close();
    }
  }

  private async roomsOf(entryId: string): Promise<LiveDesignRoom[]> {
    const rooms = await Promise.all(this.rooms.values());
    return rooms.flatMap((room) => (room?.entryId === entryId ? [room] : []));
  }

  private open(entryId: string, field: string): Promise<LiveDesignRoom | null> {
    const key = roomKey(entryId, field);
    const existing = this.rooms.get(key);
    if (existing) return existing;
    const services = this.options.servicesFor(entryId, field);
    const opening = services.read().then((stored: StoredDesign | null) => {
      if (!stored) {
        this.rooms.delete(key);
        return null;
      }
      return new LiveDesignRoom(entryId, field, stored.entry, stored.document, services);
    });
    this.rooms.set(key, opening);
    opening.catch(() => this.rooms.delete(key));
    return opening;
  }
}
