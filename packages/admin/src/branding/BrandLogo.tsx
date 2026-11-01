import { AppMark } from "../design/AppMark.js";
import { useBranding } from "./brandingStore.js";

/**
 * The admin's name as the sidebar and sign-in screen show it: the agency's logo when there
 * is one (with its dark-mode version in dark mode), otherwise the mark and the name.
 */
interface BrandLogoProps {
  size?: "small" | "large";
  /** Without a logo, show the name beside the mark (the sidebar) or the mark alone (corners). */
  showsName?: boolean;
}

export function BrandLogo({ size = "small", showsName = true }: BrandLogoProps) {
  const { logo, logoDark, productName } = useBranding();

  if (logo) {
    return (
      <picture className="flex min-w-0">
        {logoDark && <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />}
        <img
          src={logo}
          alt={productName}
          className={
            size === "large"
              ? "max-h-12 max-w-64 object-contain"
              : "max-h-8 max-w-48 object-contain"
          }
        />
      </picture>
    );
  }

  if (!showsName) return <AppMark size={size} />;

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <AppMark size={size} />
      <span className="truncate text-headline text-label">{productName}</span>
    </span>
  );
}
