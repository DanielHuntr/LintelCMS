/**
 * Messages carried from one screen to the next in the history entry, not the URL, so they
 * show once and can't be bookmarked or shared.
 */
declare module "@tanstack/history" {
  interface HistoryState {
    /** Set by setup: the dashboard shows "You're all set" with the address to sign in with. */
    welcomeEmail?: string;
    /** Set when setup turns out to be done already: sign-in explains why the person is there. */
    setupAlreadyDone?: boolean;
  }
}

export {};
