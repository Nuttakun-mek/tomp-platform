import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // app/**/*.test.ts added alongside this fix round: the two new action
    // tests (app/actions/project-helper.test.ts, project-members.test.ts)
    // proving PIN lockout and the role allowlist were silently never run
    // under the old lib-only pattern — `npm run test` reported them passing
    // only because vitest's file filter matched nothing there, not because
    // the tests ran.
    // components/** added for the same reason, and .tsx alongside it: a
    // component test needs JSX, and the two older globs are .test.ts only
    // because nothing under lib/ or app/ has needed it yet. The file-level
    // default stays `node`; the one test that needs a DOM opts itself in with
    // a `// @vitest-environment jsdom` pragma.
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "components/**/*.test.{ts,tsx}"]
  },
  // Next.js compiles .tsx with the automatic JSX runtime (no `import React`
  // needed — none of this codebase's components do), but tsconfig.json's
  // "jsx": "preserve" leaves that choice to whichever compiler runs, and
  // esbuild's own default is the classic runtime, which needs a `React`
  // identifier in scope. Only mattered once a test (settings/page.test.ts)
  // started importing a page/component module and calling it directly
  // instead of only importing plain lib functions.
  esbuild: {
    jsx: "automatic"
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
      // This app can run as a git worktree nested under the main checkout
      // (apps/web/.claude/worktrees/...) with no node_modules of its own, so
      // plain Node package resolution for "@tomp/*" walks up past the
      // worktree root and silently resolves to the MAIN CHECKOUT's copy of
      // these workspace packages via its node_modules symlink — not this
      // worktree's own, possibly-edited, packages/*. tsconfig.json's own
      // "paths" already point at the worktree-relative source (which is why
      // `tsc` gets this right), but Vitest doesn't read tsconfig paths on
      // its own; mirror them explicitly here so a test in a worktree
      // actually exercises the code that worktree just changed.
      "@tomp/types/schemas": fileURLToPath(new URL("../../packages/types/schemas.ts", import.meta.url)),
      "@tomp/types/domain": fileURLToPath(new URL("../../packages/types/domain.ts", import.meta.url)),
      "@tomp/types": fileURLToPath(new URL("../../packages/types/src", import.meta.url))
    }
  }
});
