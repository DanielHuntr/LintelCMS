/**
 * A message carried to the next screen in the history entry rather than the URL, so it
 * shows once and can't be bookmarked or shared.
 */
declare module "@tanstack/history" {
  interface HistoryState {
    /** Set when setup turns out to be done already: sign-in explains why the person is there. */
    setupAlreadyDone?: boolean;
  }
}

export {};
