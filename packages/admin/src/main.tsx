import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { adminQueryClient } from "./api/queryClient.js";
import { applyColorScheme, readColorSchemeChoice } from "./appearance/colorScheme.js";
import { loadBranding } from "./branding/brandingStore.js";
import { InterfaceLanguageProvider } from "./interface-language/InterfaceLanguageProvider.js";
import { loadInterfaceLanguage } from "./interface-language/loadInterfaceLanguage.js";
import { router } from "./router.js";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('The admin needs an element with id="root" in index.html.');
}

// The admin's name, colours, scheme and language, before anything is drawn in the wrong ones.
applyColorScheme(readColorSchemeChoice());
await Promise.all([loadBranding(), loadInterfaceLanguage()]);

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={adminQueryClient}>
      <InterfaceLanguageProvider>
        <RouterProvider router={router} />
      </InterfaceLanguageProvider>
    </QueryClientProvider>
  </StrictMode>,
);
