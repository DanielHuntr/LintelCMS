/**
 * The messages an app's frame and the Lintel admin send each other with `postMessage`.
 * Both sides read them with the functions here, so they agree on every field, and both
 * refuse anything that doesn't match exactly: a message is data from another origin.
 *
 * Every message is wrapped as `{ protocol: "lintel-app-bridge", version: 1, type, ... }`,
 * so the admin and the app can ignore other scripts' messages without guessing.
 */
export const BRIDGE_PROTOCOL = "lintel-app-bridge";
export const BRIDGE_VERSION = 1;

/** Where in the admin an app's page is shown. */
export type ExtensionKind = "page" | "widget" | "panel" | "settings";

export type ToastTone = "neutral" | "success" | "critical";

/** What the app is told about where it is and who is looking. */
export interface AppContext {
  appId: string;
  extension: ExtensionKind;
  /** The widget's or panel's id from the manifest; undefined for the page and settings. */
  extensionId?: string;
  user: { id: string; name: string };
  theme: "light" | "dark";
  /** Like "en". */
  locale: string;
  /** For editor panels: the entry being edited. `id` is null until it is first saved. */
  entry?: { id: string | null; collection: string; slug: string; title: string };
  /** For dashboard widgets: how much room it has. */
  widgetSize?: "small" | "medium" | "large";
}

/** From the app's frame to the admin. */
export type AppMessage =
  | { type: "ready" }
  | { type: "resize"; height: number }
  | { type: "toast"; message: string; tone: ToastTone }
  | { type: "navigate"; path: string }
  | { type: "request-session-token"; requestId: string };

/** From the admin to the app's frame. */
export type AdminMessage =
  | { type: "context"; context: AppContext; sessionToken: string; expiresAt: string }
  | { type: "session-token"; requestId: string; sessionToken: string; expiresAt: string }
  | { type: "session-token-failed"; requestId: string; message: string };

export type Envelope<Message> = Message & { protocol: typeof BRIDGE_PROTOCOL; version: number };

export function wrapMessage<Message extends AppMessage | AdminMessage>(
  message: Message,
): Envelope<Message> {
  return { protocol: BRIDGE_PROTOCOL, version: BRIDGE_VERSION, ...message };
}

/** The tallest a frame may ask to be, in CSS pixels; enough for any real page. */
export const MAXIMUM_FRAME_HEIGHT = 10_000;
export const MAXIMUM_TOAST_LENGTH = 200;
const MAXIMUM_ID_LENGTH = 100;
const MAXIMUM_PATH_LENGTH = 500;
const MAXIMUM_TOKEN_LENGTH = 8_000;

type Fields = Record<string, unknown>;

function readEnvelope(data: unknown): Fields | undefined {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return undefined;
  }
  const fields = data as Fields;
  return fields.protocol === BRIDGE_PROTOCOL && fields.version === BRIDGE_VERSION
    ? fields
    : undefined;
}

function isText(value: unknown, maximumLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximumLength;
}

/**
 * A path inside the admin, like "/content/pages". Nothing that could leave it: no other
 * site ("//evil.example"), no scheme ("javascript:"), no backslashes browsers treat as
 * slashes.
 */
export function isAdminPath(path: unknown): path is string {
  return (
    isText(path, MAXIMUM_PATH_LENGTH) &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    ![...path].some((character) => character.charCodeAt(0) < 32)
  );
}

/** The admin's reading of a message from an app's frame, or undefined if it isn't one. */
export function readAppMessage(data: unknown): AppMessage | undefined {
  const fields = readEnvelope(data);
  switch (fields?.type) {
    case "ready":
      return { type: "ready" };
    case "resize": {
      const height = fields.height;
      return typeof height === "number" && Number.isFinite(height) && height >= 0
        ? { type: "resize", height: Math.min(Math.ceil(height), MAXIMUM_FRAME_HEIGHT) }
        : undefined;
    }
    case "toast": {
      const tone = fields.tone ?? "neutral";
      return isText(fields.message, MAXIMUM_TOAST_LENGTH) &&
        (tone === "neutral" || tone === "success" || tone === "critical")
        ? { type: "toast", message: fields.message, tone }
        : undefined;
    }
    case "navigate":
      return isAdminPath(fields.path) ? { type: "navigate", path: fields.path } : undefined;
    case "request-session-token":
      return isText(fields.requestId, MAXIMUM_ID_LENGTH)
        ? { type: "request-session-token", requestId: fields.requestId }
        : undefined;
    default:
      return undefined;
  }
}

/** The app's reading of a message from the admin, or undefined if it isn't one. */
export function readAdminMessage(data: unknown): AdminMessage | undefined {
  const fields = readEnvelope(data);
  switch (fields?.type) {
    case "context":
      return isText(fields.sessionToken, MAXIMUM_TOKEN_LENGTH) &&
        typeof fields.expiresAt === "string" &&
        isContext(fields.context)
        ? {
            type: "context",
            context: fields.context,
            sessionToken: fields.sessionToken,
            expiresAt: fields.expiresAt,
          }
        : undefined;
    case "session-token":
      return isText(fields.requestId, MAXIMUM_ID_LENGTH) &&
        isText(fields.sessionToken, MAXIMUM_TOKEN_LENGTH) &&
        typeof fields.expiresAt === "string"
        ? {
            type: "session-token",
            requestId: fields.requestId,
            sessionToken: fields.sessionToken,
            expiresAt: fields.expiresAt,
          }
        : undefined;
    case "session-token-failed":
      return isText(fields.requestId, MAXIMUM_ID_LENGTH) && typeof fields.message === "string"
        ? { type: "session-token-failed", requestId: fields.requestId, message: fields.message }
        : undefined;
    default:
      return undefined;
  }
}

function isContext(value: unknown): value is AppContext {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const context = value as Fields;
  const user = context.user as Fields | undefined;
  return (
    typeof context.appId === "string" &&
    ["page", "widget", "panel", "settings"].includes(String(context.extension)) &&
    typeof user === "object" &&
    user !== null &&
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    (context.theme === "light" || context.theme === "dark") &&
    typeof context.locale === "string"
  );
}
