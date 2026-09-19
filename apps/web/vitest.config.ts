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
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url))
    }
  }
});
