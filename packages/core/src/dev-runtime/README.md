# Dev runtime

How `pnpm dev` runs Lintel from source, and the test that keeps it working.

In development, core resolves workspace packages (such as `@lintel/builder`) to their
TypeScript sources through the `development` export condition, so tsx compiles them as well.
tsx only applies a tsconfig to the files that tsconfig includes, so `tsconfig.dev.json`
includes the other packages' `src` folders and uses the automatic JSX runtime. Without it,
the builder's `.tsx` files were compiled with the old JSX transform and every designed page
failed with "React is not defined".

| File                             | What it does                                           |
| -------------------------------- | ------------------------------------------------------ |
| `render-builder-page.fixture.ts` | Draws a page with the builder, run through tsx         |
| `dev-runtime.test.ts`            | Runs the fixture the way `pnpm dev` does and checks it |
