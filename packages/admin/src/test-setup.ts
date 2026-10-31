import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no scrolling. TanStack Router restores the scroll position on navigation,
// so give it a no-op instead of a "not implemented" warning in every router test.
window.scrollTo = () => undefined;

afterEach(() => cleanup());
