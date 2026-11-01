import { createComponentCatalogue, standardComponents } from "@lintel/builder-model";

/**
 * The components saved pages may use, in one visible list. A site's own code components are
 * added here (and to the editor's registry) so the server accepts pages that use them.
 */
export const pageComponentCatalogue = createComponentCatalogue([...standardComponents]);
