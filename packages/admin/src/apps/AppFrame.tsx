import type { AppContext, ExtensionKind } from "@lintel/app-bridge";
import { type AdminMessage, wrapMessage } from "@lintel/app-bridge/protocol";
import { TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { describeError } from "../api/describeError.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { usePluginNavigate } from "../plugins/PluginLink.js";
import { useSession } from "../session/SessionContext.js";
import type { AppExtensions } from "./apps.api.js";
import { fetchSessionToken } from "./apps.api.js";
import {
  acceptAppMessage,
  APP_FRAME_SANDBOX,
  frameAddress,
  MINIMUM_FRAME_HEIGHT,
  mayFrameOrigin,
} from "./appFrameMessages.js";
import { useShowAppToast } from "./AppToasts.js";

interface AppFrameProps {
  app: Pick<AppExtensions, "id" | "name" | "origin">;
  url: string;
  extension: ExtensionKind;
  extensionId?: string;
  /** Names the frame for screen readers, like "Stock Sync: Low stock". */
  title: string;
  entry?: AppContext["entry"];
  widgetSize?: AppContext["widgetSize"];
  /** Height before the app reports its own. */
  initialHeight?: number;
  className?: string;
}

/** After the page loads, how long to wait for the bridge before saying the app is quiet. */
const QUIET_AFTER_MILLISECONDS = 10_000;

/**
 * One of an app's pages, in a sandboxed frame. When the app's page says it is ready (through
 * `@lintel/app-bridge`), the admin fetches a session token and sends it, with who is looking
 * and where, to the app's origin only. After that it answers the page's requests: a fresh
 * token, a new height, a toast, or opening an admin screen. Messages from anywhere else are
 * ignored (see appFrameMessages.ts).
 */
export function AppFrame({
  app,
  url,
  extension,
  extensionId,
  title,
  entry,
  widgetSize,
  initialHeight = 320,
  className,
}: AppFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const session = useSession();
  const navigate = usePluginNavigate();
  const showToast = useShowAppToast();
  const [height, setHeight] = useState(initialHeight);
  const [problem, setProblem] = useState<string | null>(null);
  const [isQuiet, setIsQuiet] = useState(false);
  const hasSpoken = useRef(false);
  const lastToken = useRef<{ token: string; expiresAt: string } | null>(null);
  const adminOrigin = window.location.origin;
  const allowed = mayFrameOrigin(app.origin, adminOrigin);

  const context = useCallback(
    (): AppContext => ({
      appId: app.id,
      extension,
      ...(extensionId && { extensionId }),
      user: { id: session.user.id, name: session.user.name },
      theme: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      locale: document.documentElement.lang || "en",
      ...(entry && { entry }),
      ...(widgetSize && { widgetSize }),
    }),
    [app.id, extension, extensionId, session.user.id, session.user.name, entry, widgetSize],
  );

  const post = useCallback(
    (message: AdminMessage) => {
      // Only the app's origin may read what is sent: a token must never reach anyone else.
      frame.current?.contentWindow?.postMessage(wrapMessage(message), app.origin);
    },
    [app.origin],
  );

  useEffect(() => {
    if (!allowed) return;
    async function answer(event: MessageEvent) {
      const message = acceptAppMessage(event, {
        origin: app.origin,
        window: frame.current?.contentWindow,
      });
      if (!message) return;
      hasSpoken.current = true;
      setIsQuiet(false);

      switch (message.type) {
        case "ready":
          try {
            const { token, expiresAt } = await fetchSessionToken(app.id);
            lastToken.current = { token, expiresAt };
            setProblem(null);
            post({ type: "context", context: context(), sessionToken: token, expiresAt });
          } catch (error) {
            setProblem(describeError(error));
          }
          return;
        case "request-session-token":
          try {
            const { token, expiresAt } = await fetchSessionToken(app.id);
            lastToken.current = { token, expiresAt };
            post({
              type: "session-token",
              requestId: message.requestId,
              sessionToken: token,
              expiresAt,
            });
          } catch (error) {
            post({
              type: "session-token-failed",
              requestId: message.requestId,
              message: describeError(error),
            });
          }
          return;
        case "resize":
          setHeight(Math.max(MINIMUM_FRAME_HEIGHT, message.height));
          return;
        case "toast":
          showToast({ appName: app.name, message: message.message, tone: message.tone });
          return;
        case "navigate":
          void navigate(message.path);
          return;
      }
    }
    window.addEventListener("message", answer);
    return () => window.removeEventListener("message", answer);
  }, [allowed, app.id, app.name, app.origin, context, navigate, post, showToast]);

  // An editor panel follows the entry: tell the app when it changes.
  useEffect(() => {
    const current = lastToken.current;
    if (!entry || !current) return;
    post({
      type: "context",
      context: context(),
      sessionToken: current.token,
      expiresAt: current.expiresAt,
    });
  }, [entry, context, post]);

  function noticeLoad() {
    window.setTimeout(() => {
      if (!hasSpoken.current) setIsQuiet(true);
    }, QUIET_AFTER_MILLISECONDS);
  }

  if (!allowed) {
    return <FrameProblem message={t("apps.frame.notAllowed", { name: app.name })} />;
  }

  return (
    <div className={classNames("flex flex-col gap-2", className)}>
      <iframe
        ref={frame}
        title={title}
        src={frameAddress(url, { extension, extensionId, adminOrigin })}
        sandbox={APP_FRAME_SANDBOX}
        // No camera, microphone, location or payment: an app asks for nothing here.
        allow=""
        referrerPolicy="strict-origin"
        loading={extension === "page" || extension === "settings" ? "eager" : "lazy"}
        onLoad={noticeLoad}
        style={{ height }}
        className="w-full rounded-control border-0 bg-surface"
      />
      {problem && <FrameProblem message={problem} />}
      {isQuiet && !problem && (
        <p className="text-footnote text-label-secondary">
          {t("apps.frame.quiet", { name: app.name })}
        </p>
      )}
    </div>
  );
}

function FrameProblem({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 text-footnote text-label-secondary">
      <TriangleAlert
        aria-hidden="true"
        strokeWidth={2}
        className="mt-0.5 size-4 shrink-0 text-warning"
      />
      {message}
    </p>
  );
}
