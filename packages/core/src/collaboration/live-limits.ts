/**
 * How much one browser may ask of the live connection. Real use is far below all of these:
 * pointers are sent about 15 times a second at most, changes a few times a second.
 */
export const liveLimits = {
  /** The most one message may hold. Same as the largest save the API accepts. */
  maxMessageBytes: 1024 * 1024,
  /** Connections one person may have open: a browser each. */
  maxConnectionsPerPerson: 8,
  maxConnections: 1000,
  maxTabsPerConnection: 32,
  /** Pages one tab can be on at once. */
  maxPagesPerTab: 8,
  /** Messages: a burst of this many, then this many a second. */
  messageBurst: 200,
  messagesPerSecond: 60,
  /** Bytes: a burst of this many, then this many a second. */
  byteBurst: 8 * 1024 * 1024,
  bytesPerSecond: 1024 * 1024,
  /** Refused messages before the connection is closed. */
  strikesBeforeClosing: 20,
  /**
   * How long what someone may do is trusted before it is read from the database again. Every
   * message is checked against it, so a removed permission takes effect within this time.
   */
  permissionsFreshForMilliseconds: 5000,
  /** How often connections are pinged, and checked for people who signed out. */
  sweepEveryMilliseconds: 20_000,
} as const;
