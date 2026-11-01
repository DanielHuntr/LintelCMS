import { classNames } from "./classNames.js";

interface AvatarProps {
  name: string;
  /** Their picture; initials are shown without one. */
  imageUrl?: string | null;
  size?: "small" | "medium" | "large";
}

const sizeClasses = {
  small: "size-8 text-footnote",
  medium: "size-10 text-body",
  large: "size-20 text-title",
};

/** A person's picture or initials. Decorative: their name is always written next to it. */
export function Avatar({ name, imageUrl, size = "small" }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={classNames("shrink-0 rounded-full bg-fill object-cover", sizeClasses[size])}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={classNames(
        "flex shrink-0 items-center justify-center rounded-full bg-accent-fill font-semibold text-on-accent",
        sizeClasses[size],
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/** "Ada Lovelace" becomes "AL"; a single name gives one letter. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase();
}
