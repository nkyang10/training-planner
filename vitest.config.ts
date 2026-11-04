import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Workspace packages are consumed from source, so tests and typecheck agree on one resolution. */
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    // Order matters: Vite aliases match by prefix, so a subpath alias must come before its package, or
    // "@training-planner/knowledge" swallows "@training-planner/knowledge/canonical" and the import
    // resolves to index.ts/canonical. That failure looked like a missing module, which is why it is
    // written down here rather than discovered twice.
    alias: [
      { find: "@training-planner/knowledge/canonical", replacement: here("./packages/knowledge/src/canonical.ts") },
      { find: "@training-planner/golden-fixtures", replacement: here("./eval/golden-plans/fixture.ts") },
      { find: "@training-planner/domain", replacement: here("./packages/domain/src/index.ts") },
      { find: "@training-planner/knowledge", replacement: here("./packages/knowledge/src/index.ts") },
      { find: "@training-planner/planner-core", replacement: here("./packages/planner-core/src/index.ts") },
      { find: "@training-planner/policy", replacement: here("./packages/policy/src/index.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["packages/*/test/**/*.test.ts"],
    passWithNoTests: false,
  },
});
