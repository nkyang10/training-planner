/**
 * SQLite persistence adapter, built on Node's built-in `node:sqlite` (DatabaseSync). No new dependency:
 * the driver ships with Node, and the adapter is synchronous because DatabaseSync is.
 *
 * What this adapter is: a single-connection implementation of `Repository` whose every tenant read and write
 * is keyed by `user_id`, plus SQLite triggers that refuse UPDATE/DELETE on the append-only tables. It is a
 * development/test adapter and a reference for the Postgres adapter.
 *
 * What this adapter does NOT enforce - do not read it as a production tenancy boundary:
 * - Row-level security. SQLite has no `app.tenant_id()` predicate and no role that can be forced through one.
 *   Isolation here is a `WHERE user_id = ?` clause on every tenant statement, which is a code convention, not a
 *   database guarantee: anyone with the database file or a connection can read every tenant's rows. Postgres
 *   RLS (`FORCE ROW LEVEL SECURITY` and the tenant policies in schemas/sql/schema.sql) remains the tenancy
 *   boundary for production.
 * - The operator role and its grants. SQLite has no roles, so `guidelines` is a plain global table: this
 *   adapter can append and read it, and `listGuidelines()` returns internal rows. The rule that a runner
 *   connection cannot even name `guidelines` (ADR-0009 internal visibility) is the API's responsibility here;
 *   in Postgres it is enforced by the operator grants plus RLS.
 * - The TP401 trigger set's role-aware exception. The SQLite triggers below refuse UPDATE/DELETE on
 *   append-only tables for every connection, which is stricter than Postgres for the `purger` role. There is
 *   no `purger`, no `app.deletion_log`, no ordered purge path, and no account-deletion implementation here.
 * - `app.refuse_edit_of_active_plan`, the review decision guard, and the other PL/pgSQL guards. Plan versions
 *   are stored as immutable rows and activation is an append-only log, but there is no plan `status` column
 *   and no role to distinguish a lifecycle move from a content rewrite.
 * - Foreign keys to a users table. `PRAGMA foreign_keys = ON` is set, but this adapter declares no cross-table
 *   foreign keys: the memory contract has no users table, a diff may be stored before the versions it names,
 *   and inventing referential constraints here would refuse writes the reference adapter accepts. Referential
 *   integrity is a Postgres migration concern.
 * - Every CHECK constraint in schemas/sql/schema.sql. Domain objects are stored as JSON; only the keys and
 *   ordering columns the interface needs are projected. The JSON contracts are validated at the edge (the API)
 *   and by the Postgres DDL in production. This adapter re-validates only prompt deliveries, because the memory
 *   adapter does, plus the prompt-delivery CHECKs the DDL states.
 * - Multi-writer concurrency and row locking. DatabaseSync is synchronous and single-connection; a file-backed
 *   database is not a coordination point for several API processes. Production uses the Postgres adapter.
 *
 * Differences from memory.ts, all deliberate: internally, reviews are an append-only history and reads take
 * the latest row per review id, so a decision is a new row rather than an overwrite (the visible result is the
 * same). A replayed pain report keeps the first row, and re-saving an existing plan version keeps the first
 * immutable row, where memory would replace either. The DDL's uniqueness and CHECKs are stricter than memory in
 * three observable places: a duplicate prompt delivery (user_id, day, kind) and a duplicate AI-proposal id are
 * refused instead of appended, and a prompt whose for_day is after day is refused. Those are the only places a
 * caller can observe a difference from the in-memory adapter.
 */
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type {
  AiReviewProposal,
  AthleteProfile,
  CoachMessage,
  Connection,
  DayEntry,
  GuidelineContract,
  LlmConsent,
  PainReport,
  PlanDiff,
  PlanVersion,
  ProfileRevision,
  PromptDelivery,
  Review,
  SyncPreference,
  TrainingEvent,
  WizardAnswerRecord,
} from "@training-planner/domain";
import { promptDeliverySchema } from "@training-planner/domain";
import { DuplicateIdempotencyError, type AppendEntryInput, type CommentRecord, type Repository } from "./types";
import { SQLITE_SCHEMA } from "./sqlite-schema";

/**
 * The coach conversation's table. It is created here, next to the adapter that reads it, because the schema file
 * describes the pre-existing tables and this change is scoped to the coach-message feature.
 */
const COACH_MESSAGES_SCHEMA = `
CREATE TABLE IF NOT EXISTS coach_messages (
  message_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS coach_messages_user_created ON coach_messages (user_id, created_at);
`;

export interface SqliteRepositoryOptions {
  filename: string;
}

/**
 * Vite 5 (and therefore Vitest) does not list `node:sqlite` among its builtins and rewrites the specifier to
 * `sqlite`, which then fails to resolve. `process.getBuiltinModule` is the runtime equivalent of the same
 * built-in and is typed by @types/node, so this adapter still uses Node's own DatabaseSync with no dependency
 * and no bundler-configuration change. A direct `import` would work in plain Node but not under the test runner.
 * Loaded lazily so importing @training-planner/storage for the memory adapter does not require node:sqlite.
 */
const loadDatabaseSync = (): typeof DatabaseSyncType => process.getBuiltinModule("node:sqlite").DatabaseSync;

type SqliteRow = Record<string, string | number | bigint | null | Uint8Array>;

const text = (row: SqliteRow, column: string): string => {
  const value = row[column];
  if (typeof value !== "string") throw new Error(`sqlite: expected text in ${column}`);
  return value;
};

const optionalText = (row: SqliteRow, column: string): string | null => {
  const value = row[column];
  return typeof value === "string" ? value : null;
};

const integer = (row: SqliteRow, column: string): number => {
  const value = row[column];
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  throw new Error(`sqlite: expected an integer in ${column}`);
};

const encode = (value: unknown): string => {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("sqlite: value is not JSON-serialisable");
  return encoded;
};

const decode = <T>(encoded: string): T => JSON.parse(encoded) as T;

/** SQLITE_CONSTRAINT_UNIQUE. The adapter turns this into the domain's duplicate error where it has one. */
const isUniqueConstraint = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null || !("errcode" in error)) return false;
  return (error as { errcode?: unknown }).errcode === 2067;
};

const inTransaction = <T>(database: DatabaseSyncType, work: () => T): T => {
  database.exec("BEGIN");
  try {
    const result = work();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // SQLite may already have rolled the transaction back; the original error is the one that matters.
    }
    throw error;
  }
};

const entryFromRow = (row: SqliteRow): DayEntry => {
  const entry = decode<DayEntry>(text(row, "payload"));
  const supersededBy = optionalText(row, "superseded_by");
  // The column is authoritative when set; otherwise the payload's own value (null or absent) is what
  // memory would have returned.
  return supersededBy === null ? entry : { ...entry, supersededBy };
};

const reviewFromRow = (row: SqliteRow): Review => decode<Review>(text(row, "payload"));

export interface SqliteRepository extends Repository {
  /** Close the connection. Tests and short-lived scripts need this on Windows, where an open file cannot be removed. */
  close(): void;
}

export function createSqliteRepository(options: SqliteRepositoryOptions): SqliteRepository {
  const DatabaseSync = loadDatabaseSync();
  const database = new DatabaseSync(options.filename);
  // Explicit rather than relying on the constructor default: a database whose foreign keys are silently off
  // is the kind of difference that only shows up in production.
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(SQLITE_SCHEMA);
  database.exec(COACH_MESSAGES_SCHEMA);

  const insertPlanVersion = (version: PlanVersion): void => {
    // Plan versions are immutable history. A second save of the same version id keeps the first row rather
    // than rewriting it; activation still records the latest activation below.
    database
      .prepare(
        `INSERT INTO plan_versions (user_id, version_id, generated_at_day, first_day, last_day, payload)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, version_id) DO NOTHING`,
      )
      .run(version.userId, version.versionId, version.generatedAtDay, version.firstDay, version.lastDay, encode(version));
  };

  const activate = (version: PlanVersion): void => {
    inTransaction(database, () => {
      insertPlanVersion(version);
      database
        .prepare("DELETE FROM proposed_plan_versions WHERE user_id = ? AND version_id = ?")
        .run(version.userId, version.versionId);
      database
        .prepare("INSERT INTO plan_activations (user_id, version_id) VALUES (?, ?)")
        .run(version.userId, version.versionId);
    });
  };

  return {
    appendEntryWithEventAndPointer(input: AppendEntryInput): void {
      const userId = input.event.userId;
      const key = input.event.idempotencyKey ?? input.entry.idempotencyKey;
      if (key === undefined || key === null || key.length === 0) {
        throw new Error("an entry write needs an idempotency key");
      }
      // The unique index is the guarantee; this lookup is the readable error. Both exist because a
      // constraint violation without a domain error is a 500 where the API expects a duplicate response.
      const existing = database
        .prepare("SELECT 1 AS present FROM day_entries WHERE user_id = ? AND append_key = ?")
        .get(userId, key);
      if (existing !== undefined) throw new DuplicateIdempotencyError(userId, key);

      try {
        inTransaction(database, () => {
          const pointer = input.superseded;
          if (pointer !== undefined) {
            const original = database
              .prepare("SELECT 1 AS present FROM day_entries WHERE user_id = ? AND entry_id = ?")
              .get(userId, pointer.entryId);
            if (original === undefined) throw new Error(`cannot supersede unknown entry ${pointer.entryId}`);
            // The one UPDATE the store performs, in the same transaction as the new row. The trigger in
            // sqlite-schema.ts permits this column and refuses every other change.
            database
              .prepare("UPDATE day_entries SET superseded_by = ? WHERE user_id = ? AND entry_id = ?")
              .run(pointer.supersededBy, userId, pointer.entryId);
          }

          database
            .prepare(
              `INSERT INTO day_entries
                 (user_id, entry_id, day, revision, idempotency_key, append_key, superseded_by, payload)
               VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
            )
            .run(
              userId,
              input.entry.entryId ?? null,
              input.entry.day,
              input.entry.revision,
              input.entry.idempotencyKey ?? null,
              key,
              encode(input.entry),
            );

          database
            .prepare(
              `INSERT INTO events (user_id, event_id, training_day, occurred_at, idempotency_key, payload)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(
              userId,
              input.event.eventId,
              input.event.trainingDay,
              input.event.occurredAt,
              input.event.idempotencyKey ?? null,
              encode(input.event),
            );
        });
      } catch (error) {
        if (isUniqueConstraint(error)) throw new DuplicateIdempotencyError(userId, key);
        throw error;
      }
    },

    findEntryByIdempotencyKey(userId: string, idempotencyKey: string): DayEntry | undefined {
      const row = database
        .prepare(
          `SELECT payload, superseded_by FROM day_entries
            WHERE user_id = ? AND idempotency_key = ?
            ORDER BY seq ASC LIMIT 1`,
        )
        .get(userId, idempotencyKey);
      return row === undefined ? undefined : entryFromRow(row);
    },

    listEntriesForDay(userId: string, day: string): DayEntry[] {
      return database
        .prepare(
          `SELECT payload, superseded_by FROM day_entries
            WHERE user_id = ? AND day = ?
            ORDER BY revision ASC, seq ASC`,
        )
        .all(userId, day)
        .map(entryFromRow);
    },

    listEntries(userId: string): DayEntry[] {
      return database
        .prepare(
          `SELECT payload, superseded_by FROM day_entries
            WHERE user_id = ?
            ORDER BY day ASC, revision ASC, seq ASC`,
        )
        .all(userId)
        .map(entryFromRow);
    },

    listEvents(userId: string): TrainingEvent[] {
      return database
        .prepare("SELECT payload FROM events WHERE user_id = ? ORDER BY seq ASC")
        .all(userId)
        .map((row) => decode<TrainingEvent>(text(row, "payload")));
    },

    savePlanVersion(version: PlanVersion): void {
      inTransaction(database, () => {
        insertPlanVersion(version);
        database
          .prepare("INSERT INTO plan_activations (user_id, version_id) VALUES (?, ?)")
          .run(version.userId, version.versionId);
      });
    },

    saveProposedPlanVersion(version: PlanVersion): void {
      // Staging is not history: a re-offer replaces the staged payload, matching memory's Map.set.
      database
        .prepare(
          `INSERT INTO proposed_plan_versions (user_id, version_id, payload) VALUES (?, ?, ?)
           ON CONFLICT (user_id, version_id) DO UPDATE SET payload = excluded.payload`,
        )
        .run(version.userId, version.versionId, encode(version));
    },

    getProposedPlanVersion(userId: string, versionId: string): PlanVersion | undefined {
      const row = database
        .prepare("SELECT payload FROM proposed_plan_versions WHERE user_id = ? AND version_id = ?")
        .get(userId, versionId);
      return row === undefined ? undefined : decode<PlanVersion>(text(row, "payload"));
    },

    getActivePlanVersion(userId: string): PlanVersion | undefined {
      const row = database
        .prepare(
          `SELECT p.payload
             FROM plan_activations a
             JOIN plan_versions p ON p.user_id = a.user_id AND p.version_id = a.version_id
            WHERE a.user_id = ?
            ORDER BY a.seq DESC
            LIMIT 1`,
        )
        .get(userId);
      return row === undefined ? undefined : decode<PlanVersion>(text(row, "payload"));
    },

    activatePlanVersion(userId: string, versionId: string): void {
      const staged = database
        .prepare("SELECT payload FROM proposed_plan_versions WHERE user_id = ? AND version_id = ?")
        .get(userId, versionId);
      if (staged === undefined) throw new Error(`cannot activate ${versionId}: it was never proposed`);
      activate(decode<PlanVersion>(text(staged, "payload")));
    },

    activatePlanVersionForDiff(userId: string, diffId: string): PlanVersion {
      const diffRow = database
        .prepare("SELECT payload FROM plan_diffs WHERE user_id = ? AND diff_id = ?")
        .get(userId, diffId);
      if (diffRow === undefined) throw new Error(`cannot activate: no diff ${diffId} for this user`);
      const diff = decode<PlanDiff>(text(diffRow, "payload"));

      const staged = database
        .prepare("SELECT payload FROM proposed_plan_versions WHERE user_id = ? AND version_id = ?")
        .get(userId, diff.toVersionId);
      if (staged === undefined) {
        throw new Error(`cannot activate: diff ${diffId} predicts ${diff.toVersionId}, which was never proposed`);
      }
      const version = decode<PlanVersion>(text(staged, "payload"));
      activate(version);
      return version;
    },

    getPlanVersion(userId: string, versionId: string): PlanVersion | undefined {
      const row = database
        .prepare("SELECT payload FROM plan_versions WHERE user_id = ? AND version_id = ?")
        .get(userId, versionId);
      return row === undefined ? undefined : decode<PlanVersion>(text(row, "payload"));
    },

    latestPlanVersionFor(userId: string, day: string): PlanVersion | undefined {
      // The active plan wins when it covers the day, even if an older version also covers it: an accepted
      // review must change what the runner sees.
      const active = database
        .prepare(
          `SELECT p.payload
             FROM plan_activations a
             JOIN plan_versions p ON p.user_id = a.user_id AND p.version_id = a.version_id
            WHERE a.user_id = ?
            ORDER BY a.seq DESC
            LIMIT 1`,
        )
        .get(userId);
      if (active !== undefined) {
        const version = decode<PlanVersion>(text(active, "payload"));
        if (version.firstDay <= day && day <= version.lastDay) return version;
      }

      const covering = database
        .prepare(
          `SELECT payload FROM plan_versions
            WHERE user_id = ? AND first_day <= ? AND last_day >= ?
            ORDER BY generated_at_day DESC, seq ASC
            LIMIT 1`,
        )
        .get(userId, day, day);
      return covering === undefined ? undefined : decode<PlanVersion>(text(covering, "payload"));
    },

    savePlanDiff(diff: PlanDiff): void {
      // A diff is evidence and may be re-offered; memory replaces it by diffId, so this is an upsert.
      database
        .prepare(
          `INSERT INTO plan_diffs (user_id, diff_id, payload) VALUES (?, ?, ?)
           ON CONFLICT (user_id, diff_id) DO UPDATE SET payload = excluded.payload`,
        )
        .run(diff.userId, diff.diffId, encode(diff));
    },

    getPlanDiff(userId: string, diffId: string): PlanDiff | undefined {
      const row = database.prepare("SELECT payload FROM plan_diffs WHERE user_id = ? AND diff_id = ?").get(userId, diffId);
      return row === undefined ? undefined : decode<PlanDiff>(text(row, "payload"));
    },

    savePromptDelivery(delivery: PromptDelivery): void {
      // The same backstop the memory adapter has: a row the contract rejects is not storable. The DDL
      // CHECKs cover at_minute and for_day <= day; this call is what produces the readable contract error.
      const parsed = promptDeliverySchema.safeParse(delivery);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "delivery"}: ${issue.message}`);
        throw new Error(`prompt delivery does not satisfy prompt-delivery.schema.json: ${issues.join("; ")}`);
      }
      database
        .prepare(
          `INSERT INTO prompt_deliveries (user_id, day, kind, for_day, at_minute, payload)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(delivery.userId, delivery.day, delivery.kind, delivery.forDay, delivery.atMinute, encode(delivery));
    },

    listPromptDeliveries(userId: string): PromptDelivery[] {
      return database
        .prepare("SELECT payload FROM prompt_deliveries WHERE user_id = ? ORDER BY seq ASC")
        .all(userId)
        .map((row) => decode<PromptDelivery>(text(row, "payload")));
    },

    saveReview(review: Review): void {
      // A decision is a new row, not an UPDATE. The review id is stable, so getReview/listReviews take the
      // latest row per id; the opening row remains readable history instead of being overwritten.
      database
        .prepare(
          `INSERT INTO reviews (user_id, review_id, opened_at_day, status, payload)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(review.userId, review.reviewId, review.openedAtDay, review.status, encode(review));
    },

    getReview(userId: string, reviewId: string): Review | undefined {
      const row = database
        .prepare(
          `SELECT payload FROM reviews
            WHERE user_id = ? AND review_id = ?
            ORDER BY seq DESC
            LIMIT 1`,
        )
        .get(userId, reviewId);
      return row === undefined ? undefined : reviewFromRow(row);
    },

    listReviews(userId: string): Review[] {
      return database
        .prepare(
          `SELECT payload
             FROM (
               SELECT payload,
                      opened_at_day,
                      ROW_NUMBER() OVER (PARTITION BY user_id, review_id ORDER BY seq DESC) AS position,
                      MIN(seq) OVER (PARTITION BY user_id, review_id) AS first_seq
                 FROM reviews
                WHERE user_id = ?
             )
            WHERE position = 1
            ORDER BY opened_at_day DESC, first_seq ASC`,
        )
        .all(userId)
        .map(reviewFromRow);
    },

    saveComment(comment: CommentRecord): void {
      database
        .prepare("INSERT INTO system_comments (user_id, comment_id, day, payload) VALUES (?, ?, ?, ?)")
        .run(comment.userId, comment.commentId, comment.day, encode(comment));
    },

    listComments(userId: string, day?: string): CommentRecord[] {
      const rows =
        day === undefined
          ? database.prepare("SELECT payload FROM system_comments WHERE user_id = ? ORDER BY seq ASC").all(userId)
          : database
              .prepare("SELECT payload FROM system_comments WHERE user_id = ? AND day = ? ORDER BY seq ASC")
              .all(userId, day);
      return rows.map((row) => decode<CommentRecord>(text(row, "payload")));
    },

    appendCoachMessage(message: CoachMessage): void {
      database
        .prepare("INSERT INTO coach_messages (message_id, user_id, created_at, payload) VALUES (?, ?, ?, ?)")
        .run(message.messageId, message.userId, message.createdAt, encode(message));
    },

    listCoachMessages(userId: string, limit?: number): CoachMessage[] {
      const rows =
        limit === undefined
          ? database
              .prepare("SELECT payload FROM coach_messages WHERE user_id = ? ORDER BY created_at ASC, rowid ASC")
              .all(userId)
          : database
              .prepare(
                `SELECT payload FROM (
                   SELECT payload, created_at, rowid
                     FROM coach_messages
                    WHERE user_id = ?
                    ORDER BY created_at DESC, rowid DESC
                    LIMIT ?
                 )
                 ORDER BY created_at ASC, rowid ASC`,
              )
              .all(userId, Math.max(0, limit));
      return rows.map((row) => decode<CoachMessage>(text(row, "payload")));
    },

    saveAiReviewProposal(record: AiReviewProposal): void {
      database
        .prepare("INSERT INTO ai_review_proposals (user_id, id, payload) VALUES (?, ?, ?)")
        .run(record.userId, record.id, encode(record));
    },

    listAiReviewProposals(userId: string): AiReviewProposal[] {
      return database
        .prepare("SELECT payload FROM ai_review_proposals WHERE user_id = ? ORDER BY seq ASC")
        .all(userId)
        .map((row) => decode<AiReviewProposal>(text(row, "payload")));
    },

    getLlmConsent(userId: string): LlmConsent | undefined {
      const row = database.prepare("SELECT payload FROM llm_consent WHERE user_id = ?").get(userId);
      return row === undefined ? undefined : decode<LlmConsent>(text(row, "payload"));
    },

    getConnection(userId: string, provider: Connection["provider"]): Connection | undefined {
      const row = database.prepare("SELECT payload FROM connections WHERE user_id = ? AND provider = ?").get(userId, provider);
      return row === undefined ? undefined : decode<Connection>(text(row, "payload"));
    },

    listConnections(userId: string): Connection[] {
      return database
        .prepare("SELECT payload FROM connections WHERE user_id = ? ORDER BY provider ASC")
        .all(userId)
        .map((row) => decode<Connection>(text(row, "payload")));
    },

    saveConnection(connection: Connection): void {
      database
        .prepare(
          `INSERT INTO connections (user_id, provider, payload) VALUES (?, ?, ?)
           ON CONFLICT (user_id, provider) DO UPDATE SET payload = excluded.payload`,
        )
        .run(connection.userId, connection.provider, encode(connection));
    },

    getSyncPreference(userId: string): SyncPreference | undefined {
      const row = database.prepare("SELECT payload FROM sync_preferences WHERE user_id = ?").get(userId);
      return row === undefined ? undefined : decode<SyncPreference>(text(row, "payload"));
    },

    saveSyncPreference(preference: SyncPreference): void {
      database
        .prepare(
          `INSERT INTO sync_preferences (user_id, payload) VALUES (?, ?)
           ON CONFLICT (user_id) DO UPDATE SET payload = excluded.payload`,
        )
        .run(preference.userId, encode(preference));
    },

    saveLlmConsent(consent: LlmConsent): void {
      // A switch, not a log: a grant and a later revocation are the same row, and no row means never granted.
      database
        .prepare(
          `INSERT INTO llm_consent (user_id, payload) VALUES (?, ?)
           ON CONFLICT (user_id) DO UPDATE SET payload = excluded.payload`,
        )
        .run(consent.userId, encode(consent));
    },

    getAthleteProfile(userId: string): AthleteProfile | undefined {
      const row = database.prepare("SELECT payload FROM athlete_profiles WHERE user_id = ?").get(userId);
      return row === undefined ? undefined : decode<AthleteProfile>(text(row, "payload"));
    },

    saveAthleteProfile(
      profile: AthleteProfile,
      change: {
        changedBy: ProfileRevision["changedBy"];
        source: ProfileRevision["source"];
        diff: ProfileRevision["diff"];
        occurredAt: string;
      },
    ): ProfileRevision {
      return inTransaction(database, () => {
        // The revision id is per user and starts at "1", matching memory.ts. The DDL identity column is
        // global, which would make two users' first revisions disagree with the reference adapter.
        const maxRow = database
          .prepare("SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) AS max_id FROM profile_revisions WHERE user_id = ?")
          .get(profile.userId);
        const nextId = (maxRow === undefined ? 0 : integer(maxRow, "max_id")) + 1;
        const revision: ProfileRevision = {
          userId: profile.userId,
          id: String(nextId),
          changedBy: change.changedBy,
          source: change.source,
          diff: change.diff,
          occurredAt: change.occurredAt,
        };

        database
          .prepare(
            `INSERT INTO athlete_profiles (user_id, payload) VALUES (?, ?)
             ON CONFLICT (user_id) DO UPDATE SET payload = excluded.payload`,
          )
          .run(profile.userId, encode(profile));
        database
          .prepare("INSERT INTO profile_revisions (user_id, id, occurred_at, payload) VALUES (?, ?, ?, ?)")
          .run(revision.userId, revision.id, revision.occurredAt, encode(revision));
        return revision;
      });
    },

    listProfileRevisions(userId: string): ProfileRevision[] {
      return database
        .prepare("SELECT payload FROM profile_revisions WHERE user_id = ? ORDER BY seq ASC")
        .all(userId)
        .map((row) => decode<ProfileRevision>(text(row, "payload")));
    },

    saveWizardAnswer(userId: string, record: WizardAnswerRecord): void {
      database
        .prepare("INSERT INTO wizard_answers (user_id, step_id, revision, payload) VALUES (?, ?, ?, ?)")
        .run(userId, record.stepId, record.revision, encode(record));
    },

    listWizardAnswers(userId: string): WizardAnswerRecord[] {
      return database
        .prepare("SELECT payload FROM wizard_answers WHERE user_id = ? ORDER BY seq ASC")
        .all(userId)
        .map((row) => decode<WizardAnswerRecord>(text(row, "payload")));
    },

    saveGuideline(guideline: GuidelineContract): void {
      // Global, not tenant-scoped. A duplicate (id, version) is an error with the same message memory uses:
      // silently overwriting a version would rewrite history.
      const duplicateMessage = `guideline ${guideline.guidelineId}@${guideline.version} already exists; write a new version`;
      const existing = database
        .prepare("SELECT 1 AS present FROM guidelines WHERE guideline_id = ? AND version = ?")
        .get(guideline.guidelineId, guideline.version);
      if (existing !== undefined) throw new Error(duplicateMessage);
      try {
        database
          .prepare("INSERT INTO guidelines (guideline_id, version, payload) VALUES (?, ?, ?)")
          .run(guideline.guidelineId, guideline.version, encode(guideline));
      } catch (error) {
        if (isUniqueConstraint(error)) throw new Error(duplicateMessage);
        throw error;
      }
    },

    listGuidelines(): GuidelineContract[] {
      return database
        .prepare("SELECT payload FROM guidelines ORDER BY seq ASC")
        .all()
        .map((row) => decode<GuidelineContract>(text(row, "payload")));
    },

    savePainReport(report: PainReport): void {
      // Keyed by the derived id, so a replay stores one row. The table is append-only, so a replay keeps the
      // first row rather than replacing it; a changed report needs a new derived id.
      database
        .prepare(
          `INSERT INTO pain_reports (user_id, id, day, site, payload) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (user_id, id) DO NOTHING`,
        )
        .run(report.userId, report.id, report.day, report.site, encode(report));
    },

    listPainReports(userId: string): PainReport[] {
      return database
        .prepare("SELECT payload FROM pain_reports WHERE user_id = ? ORDER BY day ASC, site ASC, seq ASC")
        .all(userId)
        .map((row) => decode<PainReport>(text(row, "payload")));
    },

    listPlanVersions(userId: string): PlanVersion[] {
      return database
        .prepare("SELECT payload FROM plan_versions WHERE user_id = ? ORDER BY generated_at_day ASC, seq ASC")
        .all(userId)
        .map((row) => decode<PlanVersion>(text(row, "payload")));
    },

    close(): void {
      database.close();
    },
  };
}
