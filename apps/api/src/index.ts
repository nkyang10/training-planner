/**
 * The API's entry point: read the port, build the composition root, start listening.
 *
 * Nothing else lives here. The server is `createApi` in server.ts, which is a pure function of its dependencies,
 * so the process wrapper is the only untested-by-vitest part of the app - and it is four lines of wiring.
 */
import { createMemorySessions, createRepositoryFromSpec } from "@training-planner/storage";
import { coachChatPortFromEnv, modelPortFromEnv } from "./provider";
import { startApi } from "./server";

const port = Number(process.env["PORT"] ?? "8080");
const tokens = process.env["API_TOKENS"];

if (tokens === undefined || tokens.length === 0) {
  console.error("api: API_TOKENS is required (a JSON object of { token: userId } for development)");
  process.exit(1);
}

const sessions = createMemorySessions(JSON.parse(tokens) as Record<string, string>);
const database = createRepositoryFromSpec(process.env["TRAINING_PLANNER_DB"]);
const modelPort = modelPortFromEnv(process.env);
const coachChatPort = coachChatPortFromEnv(process.env);
const modelId = process.env["TRAINING_PLANNER_MODEL_NAME"];
const server = startApi({
  repository: database.repository,
  sessions,
  port,
  ...(modelPort === undefined ? {} : { modelPort, ...(modelId === undefined ? {} : { modelId }) }),
  ...(coachChatPort === undefined ? {} : { coachChatPort }),
});
server.on("listening", () =>
  console.log(`api: listening on :${port} (database: ${database.kind}${modelPort === undefined ? ", no model port" : `, model: ${modelId ?? "configured"}`})`),
);

// The SQLite adapter holds the file open; releasing it on the way out is the difference between a clean stop and a
// database file a Windows machine cannot remove.
const shutdown = (): void => {
  database.close();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
