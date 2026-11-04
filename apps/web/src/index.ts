/**
 * The web app's entry point. Like the API's, it is four lines of wiring: the pages are `createWeb`, which is a
 * pure function of its dependencies and is what the tests exercise.
 */
import { createMemorySessions, createRepositoryFromSpec } from "@training-planner/storage";
import { startWeb } from "./server";

const port = Number(process.env["PORT"] ?? "8081");
const tokens = process.env["API_TOKENS"];

if (tokens === undefined || tokens.length === 0) {
  console.error("web: API_TOKENS is required (a JSON object of { token: userId } for development)");
  process.exit(1);
}

const database = createRepositoryFromSpec(process.env["TRAINING_PLANNER_DB"]);
const server = startWeb({
  repository: database.repository,
  sessions: createMemorySessions(JSON.parse(tokens) as Record<string, string>),
  port,
});
server.on("listening", () => console.log(`web: listening on :${port} (database: ${database.kind})`));

const shutdown = (): void => {
  database.close();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
