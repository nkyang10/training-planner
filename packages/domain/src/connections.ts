/**
 * Provider connections and the runner's sync choice (2026-11-05).
 *
 * A connection is a **per-user record of an external account**, not a credential: the record stores a reference to where
 * the secret lives (`credentialRef`) and a boolean, never the key or token itself. That is deliberate - a database row
 * that can leak a token is worse than a row that says where the token is kept.
 */
export type ConnectionProvider = "strava" | "garmin";
export type ConnectionStatus = "not-connected" | "connected" | "expired" | "error";
export type SyncSource = "manual" | "strava" | "garmin" | "both";

export interface Connection {
  userId: string;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  /** The provider's own athlete/user id, when the provider returns one. */
  externalAthleteId: string | null;
  displayName: string | null;
  /** The scopes the provider actually granted (space-delimited for Strava), not the ones we asked for. */
  scope: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: "ok" | "failed" | null;
  lastSyncDetail: string | null;
  /** Where the secret lives, e.g. "env:GARMIN_PERSONAL_API_KEY". Never the secret. */
  credentialRef: string | null;
  hasCredential: boolean;
}

export interface SyncPreference {
  userId: string;
  /** Which provider the runner wants to sync from. "manual" means neither. */
  source: SyncSource;
  updatedAt: string;
}

export const CONNECTION_PROVIDERS: readonly ConnectionProvider[] = ["strava", "garmin"];
export const SYNC_SOURCES: readonly SyncSource[] = ["manual", "strava", "garmin", "both"];

export const isConnectionProvider = (value: string): value is ConnectionProvider =>
  (CONNECTION_PROVIDERS as readonly string[]).includes(value);

export const isSyncSource = (value: string): value is SyncSource => (SYNC_SOURCES as readonly string[]).includes(value);
