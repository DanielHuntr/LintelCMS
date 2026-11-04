import type { LiveAttendee, LivePerson, LiveView } from "@lintel/builder-model";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { LiveClient } from "./LiveClient.js";
import { useLiveClient } from "./useLiveClient.js";

const noSubscription = () => () => undefined;
const nobody: readonly LiveAttendee[] = [];

function useLiveValue<Value>(
  client: LiveClient | null,
  read: (client: LiveClient) => Value,
  fallback: Value,
): Value {
  const getValue = () => (client ? read(client) : fallback);
  return useSyncExternalStore(client?.subscribe ?? noSubscription, getValue, getValue);
}

/** Whether the connection is up, for screens that behave differently without it. */
export function useLiveStatus() {
  const client = useLiveClient();
  return useLiveValue(client, (live) => live.status, "unavailable" as const);
}

/**
 * Says this person is on a page, for as long as the screen is open, and gives the others who
 * are: nobody at all when the connection is down.
 */
export function usePeopleHere(
  entryId: string | undefined,
  view: LiveView,
): readonly LiveAttendee[] {
  const client = useLiveClient();
  useEffect(() => {
    if (!client || !entryId) return;
    const key = `page:${entryId}`;
    client.keep(key, { type: "enterPage", entryId, view });
    return () => client.forget(key, { type: "leavePage", entryId });
  }, [client, entryId, view]);
  const people = useLiveValue(
    client,
    (live) => (entryId ? live.peopleOn(entryId) : nobody),
    nobody,
  );
  const me = client?.personId;
  return useMemo(() => people.filter((person) => person.id !== me), [people, me]);
}

/** Says which site's pages the tree is showing. */
export function useWatchSite(siteId: string | undefined): void {
  const client = useLiveClient();
  useEffect(() => {
    if (!client || !siteId) return;
    client.keep("site", { type: "watchSite", siteId });
    return () => client.forget("site", { type: "stopWatchingSite" });
  }, [client, siteId]);
}

const noPeople: readonly LivePerson[] = [];

/** The other people on a page, for its row in the tree. */
export function usePeopleOnPage(entryId: string): readonly LivePerson[] {
  const client = useLiveClient();
  const people = useLiveValue(client, (live) => live.peopleOnPages[entryId] ?? noPeople, noPeople);
  const me = client?.personId;
  return useMemo(() => people.filter((person) => person.id !== me), [people, me]);
}
