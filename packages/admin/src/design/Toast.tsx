import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { t } from "../i18n/strings.js";
import { classNames } from "./classNames.js";

export interface ToastNotice {
  id: number;
  message: string;
  tone: "neutral" | "danger";
  /** Shown as text buttons beside the message, such as Undo. */
  actions?: { label: string; run: () => void }[];
}

/** Long enough to read the note and reach Undo; it stays longer while held (see below). */
export const TOAST_VISIBLE_FOR_MS = 8000;

interface ToastProps {
  notice: ToastNotice | null;
  onDismiss: () => void;
  /** Where the note sits: the region is positioned by whoever places it. */
  className?: string;
}

/**
 * A short note after something changed: "Moved “About” to the recycle bin. Undo".
 *
 * - It is a polite live region, so screen readers hear it without losing their place.
 * - Alt+T takes keyboard focus to its first button (Undo, say), and its buttons are in the
 *   tab order. It stays while the pointer or keyboard focus is on it, going about eight
 *   seconds after they leave.
 */
export function Toast({ notice, onDismiss, className }: ToastProps) {
  return (
    <div role="status" aria-live="polite" className={classNames("pointer-events-none", className)}>
      {notice && <ToastCard key={notice.id} notice={notice} onDismiss={onDismiss} />}
    </div>
  );
}

/** The shortcut to the note's buttons, as Sonner and others use. */
export const TOAST_SHORTCUT = "Alt+T";

function ToastCard({ notice, onDismiss }: { notice: ToastNotice; onDismiss: () => void }) {
  const card = useRef<HTMLDivElement>(null);
  const firstAction = notice.actions?.[0];
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isHeld = isHovered || isFocused;
  // The timer starts again only when the note is let go, not each time its owner renders.
  const dismissLater = useEffectEvent(onDismiss);

  useEffect(() => {
    if (isHeld) return;
    const timer = setTimeout(() => dismissLater(), TOAST_VISIBLE_FOR_MS);
    return () => clearTimeout(timer);
  }, [isHeld]);

  useEffect(() => {
    function focusOnShortcut(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== "KeyT") return;
      const button = card.current?.querySelector("button");
      if (!button) return;
      event.preventDefault();
      button.focus();
    }
    window.addEventListener("keydown", focusOnShortcut);
    return () => window.removeEventListener("keydown", focusOnShortcut);
  }, []);

  return (
    <div
      ref={card}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
      }}
      className="pointer-events-auto flex w-full max-w-[440px] flex-wrap items-center gap-x-2 gap-y-1 rounded-card bg-surface-raised px-3 py-2 text-footnote text-label shadow-float hairline-ring motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:starting:translate-y-2 starting:opacity-0"
    >
      <p
        className={classNames(
          "min-w-0 flex-1 basis-40",
          notice.tone === "danger" ? "text-danger" : undefined,
        )}
      >
        {notice.message}
        {/* Screen readers hear the way to the buttons; everyone else can see them. */}
        {firstAction && (
          <span className="sr-only">
            {" "}
            {t("common.toastShortcut", { action: firstAction.label })}
          </span>
        )}
      </p>
      {/* The buttons stay together, so a narrow note wraps them as one, under the words. */}
      <div className="ms-auto flex shrink-0 items-center gap-1">
        {notice.actions?.map((action, index) => (
          <button
            key={action.label}
            type="button"
            aria-keyshortcuts={index === 0 ? TOAST_SHORTCUT : undefined}
            onClick={() => {
              action.run();
              onDismiss();
            }}
            className="rounded-[6px] px-2 py-1 font-semibold text-accent hover:bg-fill focus-visible:focus-ring"
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("common.dismiss")}
          className="flex size-6 items-center justify-center rounded-full text-label-secondary hover:bg-fill focus-visible:focus-ring"
        >
          <X aria-hidden="true" strokeWidth={2} className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

type ShowToast = (notice: Omit<ToastNotice, "id">) => void;

const ToastContext = createContext<ShowToast | null>(null);

/**
 * The admin's own note, at the foot of the window, for screens outside the content tree
 * (which has its own, at the foot of the tree). One at a time: a new note replaces the last.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const show = useCallback<ShowToast>((next) => {
    setNotice((current) => ({ ...next, id: (current?.id ?? 0) + 1 }));
  }, []);
  const dismiss = useCallback(() => setNotice(null), []);
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext value={value}>
      {children}
      <Toast
        notice={notice}
        onDismiss={dismiss}
        className="fixed inset-x-4 bottom-4 z-40 flex justify-center md:inset-s-[276px]"
      />
    </ToastContext>
  );
}

/** Shows a note at the foot of the window. Outside a ToastProvider it does nothing. */
export function useToast(): ShowToast {
  return useContext(ToastContext) ?? ignoreToast;
}

function ignoreToast() {}
