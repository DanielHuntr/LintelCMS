import { apiErrorFromBody, apiRequest, apiUrl } from "../api/client.js";

/** Calls to the API's privacy tools (see packages/core/src/privacy). */

export interface Person {
  email: string;
  name: string;
}

/** A record ticked after searching by name. */
export interface ChosenRecord {
  kindId: string;
  id: string;
}

export interface PersonalDataKind {
  id: string;
  name: string;
  description: string;
  from: string;
  inUse: boolean;
  searchable: boolean;
  notSearchableReason: string | null;
  erasure: string | null;
  tables: Array<{ name: string; columns: string[] }>;
}

export interface FoundKind {
  kindId: string;
  name: string;
  erasure: string | null;
  items: Array<{ id: string; summary: string; email: string | null; date: string | null }>;
}

export interface PersonSearch {
  found: FoundKind[];
  notSearched: Array<{ kindId: string; name: string; reason: string }>;
}

export interface RequestPart {
  source: string;
  found: number;
  deleted: number;
  anonymised: number;
  kept: number;
}

export interface PrivacyRequest {
  id: string;
  kind: "export" | "erase";
  actorName: string;
  parts: RequestPart[];
  createdAt: string;
}

export type RetentionRuleId = "formEntries" | "abandonedCarts" | "activityLogs" | "orders";

export interface RetentionRule {
  id: RetentionRuleId;
  enabled: boolean;
  days: number;
  choices: number[];
  applies: boolean;
  dueNow: number;
  nextDueAt: string | null;
}

export interface Processor {
  id: string;
  name: string;
  purpose: string;
  location: string;
  link: string;
  origin: "detected" | "added";
}

export interface Processors {
  detected: Processor[];
  added: Processor[];
}

export interface PolicyHelper {
  sections: Array<{ id: string; heading: string; text: string }>;
  draft: string;
  privacyPage: { id: string; title: string } | null;
  notMentioned: string[];
}

/** Only what was typed is sent, so an empty name isn't looked for. */
function personBody(person: Person) {
  return { email: person.email.trim() || null, name: person.name.trim() || null };
}

export function getPersonalDataMap() {
  return apiRequest<{ kinds: PersonalDataKind[] }>("/privacy/map");
}

export function findPerson(person: Person) {
  return apiRequest<PersonSearch>("/privacy/people/find", {
    method: "POST",
    body: personBody(person),
  });
}

export function erasePerson(person: Person, selected?: ChosenRecord[]) {
  return apiRequest<{ parts: RequestPart[]; explanations: string[] }>("/privacy/people/erase", {
    method: "POST",
    body: { ...personBody(person), ...(selected && { selected }) },
  });
}

/** The export is a .zip, so it is fetched as a blob rather than as JSON. */
export async function exportPerson(
  person: Person,
  selected?: ChosenRecord[],
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${apiUrl}/privacy/people/export`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...personBody(person), ...(selected && { selected }) }),
  });
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw apiErrorFromBody(response.status, response.statusText, body);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "personal-data.zip";
  return { blob: await response.blob(), filename };
}

export function listPrivacyRequests() {
  return apiRequest<{ requests: PrivacyRequest[] }>("/privacy/requests");
}

export function getRetention() {
  return apiRequest<{ rules: RetentionRule[] }>("/privacy/retention");
}

export function updateRetention(
  changes: Partial<Record<RetentionRuleId, { enabled: boolean; days: number }>>,
) {
  return apiRequest<{ rules: RetentionRule[] }>("/privacy/retention", {
    method: "PUT",
    body: changes,
  });
}

export function getPolicyHelper() {
  return apiRequest<PolicyHelper>("/privacy/policy");
}

export function getProcessors() {
  return apiRequest<Processors>("/privacy/processors");
}

export function saveProcessors(processors: Array<Omit<Processor, "origin">>) {
  return apiRequest<Processors>("/privacy/processors", {
    method: "PUT",
    body: { processors },
  });
}
