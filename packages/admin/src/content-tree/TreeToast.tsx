import { Toast, type ToastNotice } from "../design/Toast.js";

export type TreeNotice = ToastNotice;

/**
 * The tree's note, at the foot of the tree after something changed there: "Moved “About”.
 * Undo". It is the admin's Toast (design/Toast.tsx), placed where the change was made.
 */
export function TreeToast({
  notice,
  onDismiss,
}: {
  notice: TreeNotice | null;
  onDismiss: () => void;
}) {
  return (
    <Toast notice={notice} onDismiss={onDismiss} className="absolute inset-x-2 bottom-14 z-20" />
  );
}
