/**
 * The API's entry point: read the port, build the composition root, start listening.
 *
 * Nothing else lives here. The server is `createApi` in server.ts, which is a pure function of its dependencies,
 * so the process wrapper is the only untested-by-vitest part of the app - and it is four lines of wiring.
 */
import { createMemoryRepository, createMemorySessions } from "@training-planner/storage";
import { startApi } from "./server";

const port = Number(process.env["PORT"] ?? "8080");
const tokens = process.env["API_TOKENS"];

if (tokens === undefined || tokens.length === 0) {
  console.error("api: API_TOKENS is required (a JSON object of { token: userId } for development)");
  process.exit(1);
}

const sessions = createMemorySessions(JSON.parse(tokens) as Record<string, string>);
const server = startApi({ repository: createMemoryRepository(), sessions, port });
server.on("listening", () => console.log(`api: listening on :${port}`));
