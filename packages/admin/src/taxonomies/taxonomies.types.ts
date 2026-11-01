/** A taxonomy, such as Categories or Tags. Matches the API's `Taxonomy`. */
export interface Taxonomy {
  id: string;
  handle: string;
  name: string;
  termCount: number;
  updatedAt: string;
}

/** One term of a taxonomy, such as "News". Matches the API's `Term`. */
export interface Term {
  id: string;
  taxonomyHandle: string;
  title: string;
  slug: string;
  description: string;
  updatedAt: string;
}

export interface TermChanges {
  title: string;
  slug?: string;
  description?: string;
}
