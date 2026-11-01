import { LintelUnreachableError } from "../lib/lintel";

/**
 * Shown instead of a page when Lintel can't be reached, which usually means Lintel isn't
 * running yet. The page tries again on its next refresh, so it fixes itself once Lintel is up.
 */
export function LintelUnavailable({ error }: { error: LintelUnreachableError }) {
  return (
    <section className="notice" role="status">
      <h1>This site can&rsquo;t reach Lintel yet</h1>
      <p>{error.message}</p>
      <p className="meta">This page tries again within a minute.</p>
    </section>
  );
}

/** Runs `load`, or returns the error to show if Lintel can't be reached. Other errors are thrown. */
export async function loadFromLintel<Result>(
  load: () => Promise<Result>,
): Promise<{ result: Result; unreachable?: undefined } | { unreachable: LintelUnreachableError }> {
  try {
    return { result: await load() };
  } catch (error) {
    if (error instanceof LintelUnreachableError) return { unreachable: error };
    throw error;
  }
}
