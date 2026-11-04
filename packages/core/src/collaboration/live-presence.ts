import type { LiveAttendee, LiveActivity, LivePerson, LiveView } from "@lintel/builder-model";
import type { LiveTab } from "./live-connection.js";

/** A page someone is on. Its site is remembered from when they arrived. */
export interface PresencePage {
  entryId: string;
  siteId: string;
}

interface OccupiedPage extends PresencePage {
  tabs: Map<LiveTab, LiveView>;
}

/** How long changes in who's where are gathered before the tree is told. */
const TELL_WATCHERS_AFTER_MILLISECONDS = 150;

/**
 * Who is on which page, held in memory: it only means anything while people are connected,
 * and Lintel runs as one process, so nothing here is stored or shared with other servers.
 * Whether someone may be on a page is checked before they reach this class.
 */
export class LivePresence {
  private readonly pages = new Map<string, OccupiedPage>();
  private readonly watchers = new Map<string, Set<LiveTab>>();
  private readonly sitesToTell = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  enter(tab: LiveTab, page: PresencePage, view: LiveView): void {
    const occupied = this.pages.get(page.entryId) ?? { ...page, tabs: new Map() };
    this.pages.set(page.entryId, occupied);
    occupied.tabs.set(tab, view);
    tab.pages.add(page.entryId);
    this.tellPage(occupied);
    this.tellWatchersSoon(page.siteId);
  }

  leave(tab: LiveTab, entryId: string): void {
    const occupied = this.pages.get(entryId);
    tab.pages.delete(entryId);
    if (!occupied?.tabs.delete(tab)) return;
    if (occupied.tabs.size === 0) this.pages.delete(entryId);
    else this.tellPage(occupied);
    this.tellWatchersSoon(occupied.siteId);
  }

  /** The page's details, while someone is on it. */
  findPage(entryId: string): PresencePage | undefined {
    return this.pages.get(entryId);
  }

  watch(tab: LiveTab, siteId: string): void {
    this.stopWatching(tab);
    tab.watchedSiteId = siteId;
    const tabs = this.watchers.get(siteId) ?? new Set();
    this.watchers.set(siteId, tabs);
    tabs.add(tab);
    this.tellWatcher(tab, siteId);
  }

  stopWatching(tab: LiveTab): void {
    const siteId = tab.watchedSiteId;
    if (siteId === null) return;
    tab.watchedSiteId = null;
    const tabs = this.watchers.get(siteId);
    tabs?.delete(tab);
    if (tabs?.size === 0) this.watchers.delete(siteId);
  }

  dropTab(tab: LiveTab): void {
    for (const entryId of [...tab.pages]) this.leave(tab, entryId);
    this.stopWatching(tab);
  }

  /** Passes what someone is doing to the others on the page. */
  shareActivity(tab: LiveTab, entryId: string, activity: LiveActivity): void {
    const occupied = this.pages.get(entryId);
    if (!occupied?.tabs.has(tab)) return;
    const personId = tab.connection.person.id;
    for (const other of occupied.tabs.keys()) {
      if (other.connection.person.id === personId) continue;
      other.connection.send({ type: "activity", tab: other.id, entryId, personId, activity });
    }
  }

  /** Every tab on a page. */
  tabsOnPage(entryId: string): LiveTab[] {
    return [...(this.pages.get(entryId)?.tabs.keys() ?? [])];
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private tellPage(page: OccupiedPage): void {
    const people = attendeesOf(page);
    for (const tab of page.tabs.keys()) {
      tab.connection.send({ type: "peopleHere", tab: tab.id, entryId: page.entryId, people });
    }
  }

  private tellWatchersSoon(siteId: string): void {
    this.sitesToTell.add(siteId);
    this.timer ??= setTimeout(() => {
      this.timer = null;
      for (const site of this.sitesToTell) {
        for (const tab of this.watchers.get(site) ?? []) this.tellWatcher(tab, site);
      }
      this.sitesToTell.clear();
    }, TELL_WATCHERS_AFTER_MILLISECONDS);
    this.timer.unref();
  }

  private tellWatcher(tab: LiveTab, siteId: string): void {
    tab.connection.send({
      type: "peopleOnPages",
      tab: tab.id,
      siteId,
      pages: this.peopleOnPages(siteId),
    });
  }

  private peopleOnPages(siteId: string): Record<string, LivePerson[]> {
    const pages: Record<string, LivePerson[]> = {};
    for (const page of this.pages.values()) {
      if (page.siteId === siteId) pages[page.entryId] = attendeesOf(page);
    }
    return pages;
  }
}

/** Each person once, however many tabs they have on the page; the designer counts first. */
function attendeesOf(page: OccupiedPage): LiveAttendee[] {
  const people = new Map<string, LiveAttendee>();
  for (const [tab, view] of page.tabs) {
    const { person } = tab.connection;
    const current = people.get(person.id);
    people.set(person.id, { ...person, view: current?.view === "design" ? "design" : view });
  }
  return [...people.values()];
}
