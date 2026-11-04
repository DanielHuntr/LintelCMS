import type { LiveActivity, LiveAttendee, LivePointer } from "@lintel/builder-model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { personColour } from "./personColour.js";
import { useLiveClient } from "./useLiveClient.js";

/** About 15 times a second is smooth enough to follow, and little to send. */
const SEND_EVERY_MS = 66;

const nothing: LiveActivity = { pointer: null, selection: [], field: null };

/** Someone on the page, with what they're doing and their colour. */
export interface PersonAtWork {
  id: string;
  name: string;
  colour: string;
  pointer: LivePointer | null;
  selection: readonly string[];
  field: string | null;
}

/**
 * What the others on a page are doing, and a way to say what this person is. Pointers are sent
 * at most about 15 times a second; a pointer that stops moving isn't sent at all.
 */
export function useLiveActivity(entryId: string | undefined, people: readonly LiveAttendee[]) {
  const client = useLiveClient();
  const [activities, setActivities] = useState<ReadonlyMap<string, LiveActivity>>(new Map());
  const mine = useRef<LiveActivity>(nothing);
  const timer = useRef(0);
  const sentAt = useRef(0);

  useEffect(() => {
    if (!client || !entryId) return;
    return client.listen((message) => {
      if (message.type !== "activity" || message.entryId !== entryId) return;
      setActivities((current) => new Map(current).set(message.personId, message.activity));
    });
  }, [client, entryId]);

  const send = useCallback(() => {
    if (!client || !entryId) return;
    sentAt.current = Date.now();
    client.send({ type: "activity", entryId, activity: mine.current });
  }, [client, entryId]);

  const share = useCallback(
    (activity: Partial<LiveActivity>) => {
      mine.current = { ...mine.current, ...activity };
      window.clearTimeout(timer.current);
      const wait = SEND_EVERY_MS - (Date.now() - sentAt.current);
      if (wait <= 0) send();
      else timer.current = window.setTimeout(send, wait);
    },
    [send],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Someone arriving hasn't heard where this person is: they're told at the next chance.
  useEffect(() => {
    if (people.length > 0) send();
  }, [people.length, send]);

  const atWork = useMemo<PersonAtWork[]>(
    () =>
      people.map((person) => {
        const activity = activities.get(person.id) ?? nothing;
        return {
          id: person.id,
          name: person.name,
          colour: personColour(person.id),
          pointer: activity.pointer,
          selection: activity.selection,
          field: activity.field,
        };
      }),
    [people, activities],
  );

  return { atWork, share };
}
