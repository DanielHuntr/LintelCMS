import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { useMarkNotificationRead, useNotifications } from "./workflows.queries.js";

/**
 * The bell beside Help: review requests and messages from automations. Opening one goes
 * to what it is about (the entry to review) and marks it read.
 */
export function NotificationsButton() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const container = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const now = useNow();
  const unread = notifications.data?.unread ?? 0;

  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  return (
    <div
      ref={container}
      className="fixed top-4 right-16 z-20"
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label={
          unread > 0 ? t("notifications.openWithCount", { count: unread }) : t("notifications.open")
        }
        title={t("notifications.open")}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        className="relative flex size-9 items-center justify-center rounded-full bg-surface text-label-secondary shadow-float hairline-ring transition-colors duration-150 ease-standard hover:text-label focus-visible:focus-ring motion-safe:active:scale-95"
      >
        <Bell aria-hidden="true" strokeWidth={1.75} className="size-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-on-accent"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {isOpen && (
        <section
          id={panelId}
          aria-label={t("notifications.title")}
          className="absolute top-full right-0 mt-2 flex w-80 flex-col rounded-panel bg-surface-raised shadow-float hairline-ring"
        >
          <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
            <h2 className="text-headline text-label">{t("notifications.title")}</h2>
            {unread > 0 && (
              <Button variant="plain" size="small" onClick={() => markRead.mutate(undefined)}>
                {t("notifications.markAllRead")}
              </Button>
            )}
          </header>
          {notifications.data?.notifications.length === 0 && (
            <p className="px-4 pb-4 text-footnote text-label-secondary">
              {t("notifications.empty")}
            </p>
          )}
          <ul className="flex max-h-96 flex-col overflow-y-auto pb-2">
            {notifications.data?.notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!notification.read) markRead.mutate(notification.id);
                    setIsOpen(false);
                    if (notification.link) void navigate({ to: notification.link });
                  }}
                  className="flex w-full gap-2.5 px-4 py-2 text-left hover:bg-fill focus-visible:focus-ring-inset"
                >
                  <span
                    aria-hidden="true"
                    className={classNames(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      notification.read ? "bg-transparent" : "bg-accent-fill",
                    )}
                  />
                  <span className="flex flex-col gap-0.5">
                    {!notification.read && (
                      <span className="sr-only">{t("notifications.unread")}: </span>
                    )}
                    <span className="text-footnote text-label">{notification.message}</span>
                    <span className="text-caption text-label-secondary">
                      {formatRelativeTime(notification.createdAt, now)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
