import type { DatabaseOrTransaction } from "../database/client.js";
import { firstFreeSlug, slugify } from "../entries/slugs.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { forgetTerms } from "./term-references.js";
import { TermNotFoundError } from "./taxonomies.errors.js";
import { findTaxonomyOrFail } from "./taxonomies.service.js";
import type { CreateTermRequest, TermResponse, UpdateTermRequest } from "./taxonomies.schema.js";
import {
  deleteTermRow,
  findTermById,
  findTermSlugsStartingWith,
  insertTerm,
  listTermsInTaxonomy,
  type TermWithTaxonomy,
  updateTermRow,
} from "./terms.repository.js";

/** Business rules for the terms of a taxonomy: "News" and "Guides" in Categories. */

export function describeTerm(term: TermWithTaxonomy): TermResponse {
  return {
    id: term.id,
    taxonomyHandle: term.taxonomyHandle,
    title: term.title,
    slug: term.slug,
    description: term.description,
    updatedAt: term.updatedAt.toISOString(),
  };
}

export async function listTerms(
  database: DatabaseOrTransaction,
  taxonomyHandle: string,
): Promise<{ terms: TermResponse[] }> {
  const taxonomy = await findTaxonomyOrFail(database, taxonomyHandle);
  const terms = await listTermsInTaxonomy(database, taxonomy.id);
  return { terms: terms.map(describeTerm) };
}

export async function findTermOrFail(
  database: DatabaseOrTransaction,
  termId: string,
): Promise<TermWithTaxonomy> {
  const term = await findTermById(database, termId);
  if (!term) {
    throw new TermNotFoundError();
  }
  return term;
}

export async function createTerm(
  database: DatabaseOrTransaction,
  taxonomyHandle: string,
  request: CreateTermRequest,
): Promise<TermResponse> {
  const taxonomy = await findTaxonomyOrFail(database, taxonomyHandle);
  const slug = await chooseTermSlug(database, taxonomy.id, request.slug, request.title);
  const term = await insertTerm(database, {
    taxonomyId: taxonomy.id,
    title: request.title,
    slug,
    description: request.description ?? "",
  });
  return describeTerm({ ...term, taxonomyHandle: taxonomy.handle });
}

export async function updateTerm(
  database: DatabaseOrTransaction,
  termId: string,
  request: UpdateTermRequest,
): Promise<TermResponse> {
  const term = await findTermOrFail(database, termId);
  const slug =
    request.slug === undefined
      ? undefined
      : await chooseTermSlug(database, term.taxonomyId, request.slug, term.title, term.id);
  await updateTermRow(database, term.id, {
    title: request.title,
    slug,
    description: request.description,
  });
  return describeTerm(await findTermOrFail(database, term.id));
}

/** Deletes the term and takes it out of every entry and global set that chose it. */
export async function deleteTerm(database: DatabaseOrTransaction, termId: string): Promise<void> {
  const term = await findTermOrFail(database, termId);
  await database.transaction(async (transaction) => {
    await forgetTerms(transaction, [term.id]);
    await deleteTermRow(transaction, term.id);
  });
}

/**
 * A typed slug is tidied and must be free in the taxonomy; one made from the title is
 * numbered until it is free, so adding "News" twice gives "news" and "news-2".
 */
async function chooseTermSlug(
  database: DatabaseOrTransaction,
  taxonomyId: string,
  requested: string | undefined,
  title: string,
  exceptTermId?: string,
): Promise<string> {
  if (requested !== undefined && requested.trim() !== "") {
    const slug = slugify(requested);
    if (slug === "") {
      throw new InvalidFieldsError({ slug: "The slug needs at least one letter or number" });
    }
    const taken = await findTermSlugsStartingWith(database, taxonomyId, slug, exceptTermId);
    if (taken.includes(slug)) {
      throw new InvalidFieldsError({
        slug: "Another term in this taxonomy already uses this slug",
      });
    }
    return slug;
  }
  const base = slugify(title) || "term";
  const taken = await findTermSlugsStartingWith(database, taxonomyId, base, exceptTermId);
  return firstFreeSlug(base, new Set(taken));
}
