/**
 * The HTTP model port: the one place a real provider is called (ADR-0009 P3).
 *
 * It is deliberately small and deliberately paranoid: a budget per runner per day, a circuit breaker so a provider
 * outage cannot turn into a retry storm, a timeout, and a strict parse. Everything it returns is still just a claim -
 * `packages/advisor`'s validator decides whether the claim is askable, and the runner decides whether to accept it.
 *
 * No API key is read here: the composition root passes the config, so a deployment that has no key simply has no port
 * (and `POST /reviews/advisor` answers `503 no-model`, which is the honest state).
 */
import type { AdvisorCall, ModelPort } from "@training-planner/advisor";

export interface ProviderConfig {
  /** Full chat-completions URL, e.g. https://api.example.com/v1/chat/completions. Exactly one of endpoint/baseUrl. */
  endpoint?: string;
  /** An OpenAI-compatible base URL, e.g. http://host:8102/v1; the port appends /chat/completions. */
  baseUrl?: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  /** Per runner per local day (ADR-0009's budget). Default 10. */
  maxCallsPerDayPerUser?: number;
  /** Consecutive failures that open the breaker. Default 3. */
  failureThreshold?: number;
  /** How long the breaker stays open, in ms. Default 60_000. */
  cooldownMs?: number;
}

export class ProviderError extends Error {
  constructor(
    readonly code: "http-error" | "invalid-json" | "timeout" | "budget-exceeded" | "circuit-open" | "missing-context",
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "ProviderError";
  }
}

export interface ProviderPort extends ModelPort {
  /** Calls left for this runner today, for the route to report without calling the model. */
  budgetRemaining(userId: string, nowMs: number): number;
}

export interface ProviderOptions {
  fetchImpl?: typeof fetch;
  /** Injected clock, in ms. The budget day and the breaker cooldown both read it. */
  now?: () => number;
}

const SYSTEM_PROMPT = [
  "You are a training-review assistant. Answer with ONE JSON object and nothing else - no prose, no markdown, no extra keys.",
  'The object has exactly these keys: "decision" (one of "no-change", "propose-change"), "reasonCode" (one of the request\'s allowedReasonCodes),',
  '"facts" (array of {key, value} pairs, max 20; every number must appear in the request), "proposedChanges" (array, max 2; each item has exactly',
  '"day", "kind", "fromKm", "toKm", "costKey", "costSlots"; fromKm must equal the plan\'s value and costKey must be in allowedCostKeys),',
  '"confidence" ("low", "medium" or "high"), "needsHuman" (boolean).',
  "If no change is needed, answer decision no-change with an empty proposedChanges array. You never invent a number, a day, a kind or a reason.",
].join(" ");

/**
 * The chat-completions URL for a base URL. A provider that names its base (the common OpenAI-compatible shape) should
 * not have to also name the path, and a base that already ends in /chat/completions is not doubled.
 */
export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

export function createHttpModelPort(config: ProviderConfig, options: ProviderOptions = {}): ProviderPort {
  const endpoint = config.endpoint ?? (config.baseUrl === undefined ? undefined : chatCompletionsUrl(config.baseUrl));
  if (endpoint === undefined || endpoint.length === 0) {
    throw new ProviderError("missing-context", "the provider config needs an endpoint or a baseUrl");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const timeoutMs = config.timeoutMs ?? 20_000;
  const maxCallsPerDayPerUser = config.maxCallsPerDayPerUser ?? 10;
  const failureThreshold = config.failureThreshold ?? 3;
  const cooldownMs = config.cooldownMs ?? 60_000;

  const callsByDay = new Map<string, number>();
  let consecutiveFailures = 0;
  let openUntilMs = 0;

  const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

  return {
    budgetRemaining(userId: string, nowMs: number): number {
      const used = callsByDay.get(`${userId}:${dayOf(nowMs)}`) ?? 0;
      return Math.max(0, maxCallsPerDayPerUser - used);
    },

    async complete(call: AdvisorCall, context?: { userId: string }): Promise<unknown> {
      if (context === undefined || context.userId.length === 0) {
        throw new ProviderError("missing-context", "the port needs the runner's id to enforce the budget");
      }
      const nowMs = now();
      if (nowMs < openUntilMs) {
        throw new ProviderError("circuit-open", `the provider breaker is open until ${new Date(openUntilMs).toISOString()}`);
      }

      const budgetKey = `${context.userId}:${dayOf(nowMs)}`;
      const used = callsByDay.get(budgetKey) ?? 0;
      if (used >= maxCallsPerDayPerUser) {
        throw new ProviderError("budget-exceeded", `${used} calls already today for this runner`);
      }
      callsByDay.set(budgetKey, used + 1);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            temperature: 0,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: JSON.stringify(call.request) },
            ],
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new ProviderError("http-error", `${response.status} ${response.statusText}`);
        }
        const body = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
          throw new ProviderError("invalid-json", "the provider answered without a string message content");
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          throw new ProviderError("invalid-json", "the provider's content is not JSON");
        }
        consecutiveFailures = 0;
        return parsed;
      } catch (error) {
        if (error instanceof ProviderError) {
          if (error.code !== "budget-exceeded") {
            consecutiveFailures += 1;
            if (consecutiveFailures >= failureThreshold) openUntilMs = nowMs + cooldownMs;
          }
          throw error;
        }
        consecutiveFailures += 1;
        if (consecutiveFailures >= failureThreshold) openUntilMs = nowMs + cooldownMs;
        const aborted = error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted"));
        throw new ProviderError(aborted ? "timeout" : "http-error", error instanceof Error ? error.message : String(error));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * The deployment's port, from environment variables. Unset variables mean no port: a deployment without a key must
 * not pretend a model exists.
 */
export function modelPortFromEnv(
  env: Record<string, string | undefined>,
  options: ProviderOptions = {},
): ProviderPort | undefined {
  const endpoint = env["TRAINING_PLANNER_MODEL_ENDPOINT"];
  const baseUrl = env["TRAINING_PLANNER_MODEL_BASE_URL"];
  const apiKey = env["TRAINING_PLANNER_MODEL_API_KEY"];
  const model = env["TRAINING_PLANNER_MODEL_NAME"];
  if (
    (endpoint === undefined || endpoint.length === 0) &&
    (baseUrl === undefined || baseUrl.length === 0)
  ) {
    return undefined;
  }
  if (apiKey === undefined || apiKey.length === 0 || model === undefined || model.length === 0) return undefined;
  return createHttpModelPort(
    {
      ...(endpoint === undefined || endpoint.length === 0 ? { baseUrl } : { endpoint }),
      apiKey,
      model,
      ...(env["TRAINING_PLANNER_MODEL_TIMEOUT_MS"] === undefined ? {} : { timeoutMs: Number(env["TRAINING_PLANNER_MODEL_TIMEOUT_MS"]) }),
    },
    options,
  );
}
