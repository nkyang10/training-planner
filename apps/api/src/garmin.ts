/**
 * The Garmin Connect **Personal API** client (2026-11-05).
 *
 * The personal API is the self-service tier: the runner generates a key on Garmin Connect, the app exchanges it for a
 * 24-hour access token, and reads only that runner's own data. There is no refresh token; a token is re-obtained from
 * the key when needed. The key and the token are secrets and are never logged or returned by the API.
 *
 * Facts verified against the live service on 2026-11-05:
 * - token: POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token
 *   with `Authorization: ApiKey <personal-api-key>` returns a JWT (24 h)
 * - data: GET https://personal.connectapi.garmin.com/userprofile-service/userprofile/settings (Bearer)
 * - activities: GET https://personal.connectapi.garmin.com/activitylist-service/activities/search/activities?start=0&limit=N
 */
export interface GarminProfile {
  displayName: string | null;
}

export interface GarminActivity {
  activityId: number;
  activityName?: string;
  activityType?: { typeKey?: string };
  distance?: number;
  duration?: number;
  startTimeLocal?: string;
}

export interface GarminClient {
  obtainToken(apiKey: string): Promise<string>;
  profile(token: string): Promise<GarminProfile>;
  activities(token: string, from: string, to: string): Promise<GarminActivity[]>;
}

export interface GarminClientOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const TOKEN_URL = "https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token";
const API_BASE = "https://personal.connectapi.garmin.com";

export class GarminError extends Error {
  constructor(
    readonly code: "token-failed" | "profile-failed" | "activities-failed",
    readonly status: number | null,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "GarminError";
  }
}

export function createGarminClient(options: GarminClientOptions = {}): GarminClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;

  const call = async (url: string, init: RequestInit, code: GarminError["code"]): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      if (!response.ok) throw new GarminError(code, response.status, `upstream answered ${response.status}`);
      return response;
    } catch (error) {
      if (error instanceof GarminError) throw error;
      throw new GarminError(code, null, error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async obtainToken(apiKey: string): Promise<string> {
      const response = await call(TOKEN_URL, { method: "POST", headers: { Authorization: `ApiKey ${apiKey}` } }, "token-failed");
      const token = (await response.text()).trim();
      if (token.length === 0) throw new GarminError("token-failed", response.status, "empty token");
      return token;
    },

    async profile(token: string): Promise<GarminProfile> {
      const response = await call(
        `${API_BASE}/userprofile-service/userprofile/settings`,
        { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
        "profile-failed",
      );
      const body = (await response.json()) as { displayName?: unknown };
      return { displayName: typeof body.displayName === "string" ? body.displayName : null };
    },

    async activities(token: string, from: string, to: string): Promise<GarminActivity[]> {
      const response = await call(
        `${API_BASE}/activitylist-service/activities/search/activities?start=0&limit=50`,
        { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
        "activities-failed",
      );
      const body = (await response.json()) as unknown;
      if (!Array.isArray(body)) throw new GarminError("activities-failed", response.status, "activities response is not an array");
      // The list endpoint is used without date parameters on purpose: the service's date filters are not documented on
      // the personal tier, so the range is applied here, where it is testable, rather than guessed in a query string.
      return (body as GarminActivity[]).filter((activity) => {
        const day = typeof activity.startTimeLocal === "string" ? activity.startTimeLocal.slice(0, 10) : "";
        return day >= from && day <= to;
      });
    },
  };
}
