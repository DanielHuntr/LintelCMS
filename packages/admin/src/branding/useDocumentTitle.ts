import { useEffect } from "react";
import { useBranding } from "./brandingStore.js";

/** "Media · Acme Studio" in the browser tab. Every page title component calls this. */
export function useDocumentTitle(pageTitle: string | undefined): void {
  const { productName } = useBranding();
  useEffect(() => {
    if (pageTitle === undefined) return;
    document.title =
      pageTitle && pageTitle !== productName ? `${pageTitle} · ${productName}` : productName;
  }, [pageTitle, productName]);
}
