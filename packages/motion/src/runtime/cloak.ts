/**
 * Elements that animate in start hidden, but only when scripts run and motion is allowed,
 * so nobody without JavaScript is left with an empty page. Put this CSS in the page's head
 * and `data-motion-cloak` on elements that fade in on load; the runtime removes the
 * attribute once the first frame is in place. If the script never arrives, a CSS animation
 * shows the element after two seconds anyway.
 */
export const motionCloakCss = `@media (scripting: enabled) and (prefers-reduced-motion: no-preference) {
  [data-motion-cloak] { opacity: 0; animation: lintel-motion-uncloak 0s 2s forwards; }
}
@keyframes lintel-motion-uncloak { to { opacity: 1; } }`;
