import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Workspace packages are consumed from source, so tests and typecheck agree on one resolution. */
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@training-planner/domain": here("./packages/domain/src/index.ts"),
      "@training-planner/knowledge": here("./packages/knowledge/src/index.ts"),
      "@training-planner/knowledge/canonical": here("./packages/knowledge/src/canonical.ts"),
      "@training-planner/golden-fixtures": here("./eval/golden-plans/fixture.ts"),
      "@training-planner/planner-core": here("./packages/planner-core/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/*/test/**/*.test.ts"],
    passWithNoTests: false,
  },
});
