import { AppWindow } from "lucide-react";
import { useState } from "react";
import { classNames } from "../design/classNames.js";

interface AppIconProps {
  iconUrl: string | null;
  size?: "regular" | "large";
}

/** The app's own icon, from its address, or a plain app glyph when it has none (or it fails). */
export function AppIcon({ iconUrl, size = "regular" }: AppIconProps) {
  const [failed, setFailed] = useState(false);
  const box = size === "large" ? "size-12 rounded-[11px]" : "size-7 rounded-[7px]";

  if (iconUrl && !failed) {
    return (
      <img
        src={iconUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={classNames("shrink-0 bg-fill object-cover", box)}
      />
    );
  }
  return (
    <span
      className={classNames(
        "flex shrink-0 items-center justify-center bg-success text-on-accent",
        box,
      )}
    >
      <AppWindow
        aria-hidden="true"
        strokeWidth={1.75}
        className={size === "large" ? "size-6" : "size-4"}
      />
    </span>
  );
}
