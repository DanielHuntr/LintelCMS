import type { DatabaseOrTransaction } from "../database/client.js";
import type { MediaContext } from "../media/index.js";

/** What the forms services need, gathered per request by the routes. */
export interface FormsContext {
  database: DatabaseOrTransaction;
  /** Files people send are kept in the media library. */
  media: MediaContext;
}
