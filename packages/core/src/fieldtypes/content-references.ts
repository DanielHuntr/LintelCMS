/**
 * What the `entries` and `terms` fieldtypes need from the rest of the content model:
 * whether the ids an editor picked still exist. Like images (see image-assets.ts), the
 * fieldtypes don't import that code; the entries feature hands an implementation in.
 */
export interface ContentReferences {
  /** The ids, of those given, that aren't terms of this taxonomy. */
  findMissingTermIds(taxonomyHandle: string, termIds: readonly string[]): Promise<string[]>;
  /**
   * The ids, of those given, that aren't entries. With collection handles, an entry in
   * any other collection counts as missing too.
   */
  findMissingEntryIds(
    collectionHandles: readonly string[],
    entryIds: readonly string[],
  ): Promise<string[]>;
  /** The ids, of those given, that aren't people with an account. */
  findMissingUserIds(userIds: readonly string[]): Promise<string[]>;
}

/** Accepts every id (the fieldtypes have already checked they are uuids), for tests. */
export const acceptAnyReference: ContentReferences = {
  findMissingTermIds: async () => [],
  findMissingEntryIds: async () => [],
  findMissingUserIds: async () => [],
};
