/**
 * The web app's entry point. Like the API's, it is four lines of wiring: the pages are `createWeb`, which is a
 * pure function of its dependencies and is what the tests exercise.
 */
import { createMemoryRepository, createMemorySessions } from "@training-planner/storage";
import { startWeb } from "./server";

const port = Number(process.env["PORT"] ?? "8081");
const tokens = process.env["API_TOKENS"];

if (tokens === undefined || tokens.length === 0) {
  console.error("web: API_TOKENS is required (a JSON object of { token: userId } for development)");
  process.exit(1);
}

const server = startWeb({
  repository: createMemoryRepository(),
  sessions: createMemorySessions(JSON.parse(tokens) as Record<string, string>),
  port,
});
server.on("listening", () => console.log(`web: listening on :${port}`));
