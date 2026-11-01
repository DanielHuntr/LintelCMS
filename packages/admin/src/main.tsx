import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { adminQueryClient } from "./api/queryClient.js";
import { router } from "./router.js";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('The admin needs an element with id="root" in index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={adminQueryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
