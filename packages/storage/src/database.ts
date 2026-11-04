/**
 * The composition root's one decision: which `Repository` the process runs on.
 *
 * It takes the spec as an argument rather than reading `process.env` itself, so the decision is testable and the
 * storage package stays a library. The two apps' entry points pass their own environment in.
 */
import { createMemoryRepository } from "./memory";
import { createSqliteRepository } from "./sqlite";
import type { Repository } from "./types";

export interface RepositoryHandle {
  repository: Repository;
  /** Named so a log line can say what the process is running on instead of implying persistence it may not have. */
  kind: "memory" | "sqlite";
  /** Releases the SQLite file handle; a no-op for memory. Always safe to call once. */
  close(): void;
}

/**
 * `undefined` or `"memory"` -> the in-memory adapter (nothing persists; the honest development default).
 * `"sqlite:<path>"` -> the SQLite adapter. Anything else is a configuration error, not a silent fallback: a typo
 * must not quietly give a runner a database that forgets everything.
 */
export function createRepositoryFromSpec(spec: string | undefined): RepositoryHandle {
  if (spec === undefined || spec.trim().length === 0 || spec.trim() === "memory") {
    return { repository: createMemoryRepository(), kind: "memory", close: () => {} };
  }
  const trimmed = spec.trim();
  if (!trimmed.startsWith("sqlite:")) {
    throw new Error(`TRAINING_PLANNER_DB must be "memory" or "sqlite:<path>", got ${JSON.stringify(spec)}`);
  }
  const filename = trimmed.slice("sqlite:".length);
  if (filename.length === 0) {
    throw new Error("TRAINING_PLANNER_DB is sqlite: but no path follows it");
  }
  const repository = createSqliteRepository({ filename });
  return { repository, kind: "sqlite", close: () => repository.close() };
}
