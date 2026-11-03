import type { ToastTone } from "@lintel/app-bridge";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { classNames } from "../design/classNames.js";

/**
 * Short messages apps show through the bridge ("Stock updated"). They appear above the
 * page's bottom edge for a few seconds, are read out by screen readers, and always say
 * which app they came from, so an app can't pass its words off as Lintel's.
 */

interface Toast {
  id: number;
  appName: string;
  message: string;
  tone: ToastTone;
}

type ShowToast = (toast: Omit<Toast, "id">) => void;

const AppToastsContext = createContext<ShowToast>(() => undefined);

export function useShowAppToast(): ShowToast {
  return useContext(AppToastsContext);
}

const VISIBLE_MILLISECONDS = 5_000;
/** One noisy app can't cover the screen. */
const MAXIMUM_SHOWN = 3;

const toneIcons = { neutral: Info, success: CircleCheck, critical: CircleAlert } as const;
const toneColours = {
  neutral: "text-label-secondary",
  success: "text-success",
  critical: "text-danger",
} as const;

export function AppToastsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback<ShowToast>((toast) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((shown) => [...shown, { ...toast, id }].slice(-MAXIMUM_SHOWN));
    setTimeout(
      () => setToasts((shown) => shown.filter((each) => each.id !== id)),
      VISIBLE_MILLISECONDS,
    );
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <AppToastsContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex flex-col items-center gap-2 pl-[264px]"
      >
        {toasts.map((toast) => {
          const Icon = toneIcons[toast.tone];
          return (
            <p
              key={toast.id}
              className="flex max-w-md items-center gap-2.5 rounded-full bg-surface px-4 py-2.5 text-subheadline text-label shadow-float hairline-ring"
            >
              <Icon
                aria-hidden="true"
                strokeWidth={2}
                className={classNames("size-4 shrink-0", toneColours[toast.tone])}
              />
              <span>
                <span className="font-semibold">{toast.appName}: </span>
                {toast.message}
              </span>
            </p>
          );
        })}
      </div>
    </AppToastsContext.Provider>
  );
}
