import {
  CircleHelp,
  ImageIcon,
  LayoutTemplate,
  MousePointerClick,
  PanelTop,
  Pilcrow,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons for the block types new sites start with (see core's default-collections.ts).
 * Block types an agency adds get the general one; the icon is only a visual cue next to
 * the name, never the only way to tell blocks apart.
 */
const iconsByHandle: Readonly<Record<string, LucideIcon>> = {
  hero: PanelTop,
  text: Pilcrow,
  image: ImageIcon,
  call_to_action: MousePointerClick,
  faq: CircleHelp,
};

export function BlockTypeIcon({ handle, className }: { handle: string; className?: string }) {
  const Icon = iconsByHandle[handle] ?? LayoutTemplate;
  return <Icon aria-hidden="true" strokeWidth={1.75} className={className} />;
}
