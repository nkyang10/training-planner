/**
 * The SQLite DDL for the persistence adapter.
 *
 * This is the Postgres schema's rules translated, not copied: there are no policies, roles or PL/pgSQL here.
 * What survives is the shape the Repository interface reads (`user_id` on every tenant table), the uniqueness
 * the memory adapter enforces (an append key per user, a guideline id@version), and triggers that refuse
 * UPDATE/DELETE on append-only tables. `guidelines` is the deliberate exception: it is global, not tenant-scoped
 * (ADR-0009), exactly as it is in the memory adapter.
 *
 * The comment block at the top of sqlite.ts states what this file does NOT enforce. It is not a second tenancy
 * boundary and must not be read as one.
 */
export const SQLITE_SCHEMA = `
-- ---------------------------------------------------------------------------------------
-- Tenant tables. Every read in sqlite.ts filters on user_id; the columns here are the ones
-- the interface needs for filtering, ordering and uniqueness, while the domain object itself
-- is kept as JSON so a field the interface does not query is not silently dropped.
-- ---------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS day_entries (
  user_id         TEXT NOT NULL,
  seq             INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id        TEXT,
  day             TEXT NOT NULL,
  revision        INTEGER NOT NULL,
  -- The entry's own idempotency key, used by findEntryByIdempotencyKey.
  idempotency_key TEXT,
  -- The key the append was actually guarded by (event key, else entry key). Memory keeps one
  -- set per user, so the unique rule is here rather than on the event row.
  append_key      TEXT NOT NULL,
  -- The only mutable column in the store: a correction points the old row forward in the same
  -- transaction that writes the new row. The trigger below allows this field and nothing else.
  superseded_by   TEXT,
  payload         TEXT NOT NULL,
  UNIQUE (user_id, append_key)
);
CREATE INDEX IF NOT EXISTS day_entries_user_day ON day_entries (user_id, day, revision);
CREATE INDEX IF NOT EXISTS day_entries_user_key ON day_entries (user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS day_entries_user_entry ON day_entries (user_id, entry_id);

CREATE TABLE IF NOT EXISTS events (
  user_id         TEXT NOT NULL,
  seq             INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id        TEXT NOT NULL,
  training_day    TEXT NOT NULL,
  occurred_at     TEXT NOT NULL,
  idempotency_key TEXT,
  payload         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_user_order ON events (user_id, seq);

CREATE TABLE IF NOT EXISTS plan_versions (
  user_id          TEXT NOT NULL,
  seq              INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id       TEXT NOT NULL,
  generated_at_day TEXT NOT NULL,
  first_day        TEXT NOT NULL,
  last_day         TEXT NOT NULL,
  payload          TEXT NOT NULL,
  UNIQUE (user_id, version_id)
);
CREATE INDEX IF NOT EXISTS plan_versions_window ON plan_versions (user_id, first_day, last_day);
CREATE INDEX IF NOT EXISTS plan_versions_order ON plan_versions (user_id, generated_at_day, seq);

-- A version a review offered but the runner has not accepted. Staging is mutable (a re-offer
-- replaces the staged payload); activation moves it into plan_versions, which is append-only.
CREATE TABLE IF NOT EXISTS proposed_plan_versions (
  user_id    TEXT NOT NULL,
  version_id TEXT NOT NULL,
  payload    TEXT NOT NULL,
  PRIMARY KEY (user_id, version_id)
);

-- Which version was made active, in order. Memory keeps one activeVersionId; this log keeps the
-- history so "latest activated" is a query rather than a mutable flag on an append-only row.
CREATE TABLE IF NOT EXISTS plan_activations (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  version_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS plan_activations_user_order ON plan_activations (user_id, seq);

CREATE TABLE IF NOT EXISTS plan_diffs (
  user_id TEXT NOT NULL,
  diff_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (user_id, diff_id)
);

CREATE TABLE IF NOT EXISTS prompt_deliveries (
  user_id   TEXT NOT NULL,
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  day       TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('nudge', 'review', 'weekly-summary')),
  for_day   TEXT NOT NULL,
  at_minute INTEGER NOT NULL CHECK (at_minute BETWEEN 0 AND 1439),
  payload   TEXT NOT NULL,
  UNIQUE (user_id, day, kind),
  -- The DDL rule that a prompt cannot ask about a future day. ISO dates compare correctly.
  CHECK (for_day <= day)
);
CREATE INDEX IF NOT EXISTS prompt_deliveries_user_order ON prompt_deliveries (user_id, seq);

-- Reviews are stored as an append-only history: opening a review writes one row and a decision
-- writes another, so a status change is never an UPDATE. Reads take the latest row per review id,
-- which gives the same visible result as memory's Map.set without mutating a stored decision.
CREATE TABLE IF NOT EXISTS reviews (
  user_id       TEXT NOT NULL,
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id     TEXT NOT NULL,
  opened_at_day TEXT NOT NULL,
  status        TEXT NOT NULL,
  payload       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_user_review ON reviews (user_id, review_id, seq);
CREATE INDEX IF NOT EXISTS reviews_user_order ON reviews (user_id, opened_at_day, seq);

CREATE TABLE IF NOT EXISTS system_comments (
  user_id    TEXT NOT NULL,
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id TEXT NOT NULL,
  day        TEXT NOT NULL,
  payload    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS system_comments_user_day ON system_comments (user_id, day, seq);

CREATE TABLE IF NOT EXISTS ai_review_proposals (
  user_id TEXT NOT NULL,
  seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  id      TEXT NOT NULL,
  payload TEXT NOT NULL,
  UNIQUE (user_id, id)
);
CREATE INDEX IF NOT EXISTS ai_review_proposals_user_order ON ai_review_proposals (user_id, seq);

-- The consent switch: no row means never granted, which is not the same as a revoked row.
CREATE TABLE IF NOT EXISTS connections (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (user_id, provider)
);
CREATE TABLE IF NOT EXISTS sync_preferences (
  user_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS llm_consent (
  user_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);

-- The profile is upserted; its history is the append-only profile_revisions table below.
CREATE TABLE IF NOT EXISTS athlete_profiles (
  user_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_revisions (
  user_id     TEXT NOT NULL,
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  id          TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload     TEXT NOT NULL,
  UNIQUE (user_id, id)
);
CREATE INDEX IF NOT EXISTS profile_revisions_user_order ON profile_revisions (user_id, seq);

CREATE TABLE IF NOT EXISTS wizard_answers (
  user_id  TEXT NOT NULL,
  seq      INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id  TEXT NOT NULL,
  revision INTEGER NOT NULL,
  payload  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS wizard_answers_user_order ON wizard_answers (user_id, seq);

-- Global, not tenant-scoped (ADR-0009): the operator's layer for every runner.
CREATE TABLE IF NOT EXISTS guidelines (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  guideline_id TEXT NOT NULL,
  version      INTEGER NOT NULL,
  payload      TEXT NOT NULL,
  UNIQUE (guideline_id, version)
);

-- A pain report is keyed by the id derived from the entry, so a replay stores one row.
CREATE TABLE IF NOT EXISTS pain_reports (
  user_id TEXT NOT NULL,
  seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  id      TEXT NOT NULL,
  day     TEXT NOT NULL,
  site    TEXT NOT NULL,
  payload TEXT NOT NULL,
  UNIQUE (user_id, id)
);
CREATE INDEX IF NOT EXISTS pain_reports_user_order ON pain_reports (user_id, day, site, seq);

-- ---------------------------------------------------------------------------------------
-- Append-only guards. These are SQLite's translation of the no_mutation triggers, with one
-- deliberate difference: day_entries may change superseded_by and nothing else, because the
-- correction pointer is the one update the Repository contract performs. There is no role
-- exception here (no purger), so these guards are stricter than Postgres for account purge.
-- ---------------------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS day_entries_no_delete
BEFORE DELETE ON day_entries
BEGIN
  SELECT RAISE(ABORT, 'day_entries is append-only: a correction writes a new revision, never a delete');
END;

CREATE TRIGGER IF NOT EXISTS day_entries_only_supersede
BEFORE UPDATE ON day_entries
WHEN NOT (
  NEW.user_id IS OLD.user_id
  AND NEW.seq IS OLD.seq
  AND NEW.entry_id IS OLD.entry_id
  AND NEW.day IS OLD.day
  AND NEW.revision IS OLD.revision
  AND NEW.idempotency_key IS OLD.idempotency_key
  AND NEW.append_key IS OLD.append_key
  AND NEW.payload IS OLD.payload
)
BEGIN
  SELECT RAISE(ABORT, 'day_entries is append-only: only superseded_by may be set');
END;

CREATE TRIGGER IF NOT EXISTS events_no_update
BEFORE UPDATE ON events
BEGIN
  SELECT RAISE(ABORT, 'events is append-only');
END;
CREATE TRIGGER IF NOT EXISTS events_no_delete
BEFORE DELETE ON events
BEGIN
  SELECT RAISE(ABORT, 'events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS plan_versions_no_update
BEFORE UPDATE ON plan_versions
BEGIN
  SELECT RAISE(ABORT, 'plan_versions is append-only: activate a version, never rewrite one');
END;
CREATE TRIGGER IF NOT EXISTS plan_versions_no_delete
BEFORE DELETE ON plan_versions
BEGIN
  SELECT RAISE(ABORT, 'plan_versions is append-only: history is kept, not deleted');
END;

CREATE TRIGGER IF NOT EXISTS plan_activations_no_update
BEFORE UPDATE ON plan_activations
BEGIN
  SELECT RAISE(ABORT, 'plan_activations is append-only');
END;
CREATE TRIGGER IF NOT EXISTS plan_activations_no_delete
BEFORE DELETE ON plan_activations
BEGIN
  SELECT RAISE(ABORT, 'plan_activations is append-only');
END;

CREATE TRIGGER IF NOT EXISTS prompt_deliveries_no_update
BEFORE UPDATE ON prompt_deliveries
BEGIN
  SELECT RAISE(ABORT, 'prompt_deliveries is append-only');
END;
CREATE TRIGGER IF NOT EXISTS prompt_deliveries_no_delete
BEFORE DELETE ON prompt_deliveries
BEGIN
  SELECT RAISE(ABORT, 'prompt_deliveries is append-only');
END;

CREATE TRIGGER IF NOT EXISTS reviews_no_update
BEFORE UPDATE ON reviews
BEGIN
  SELECT RAISE(ABORT, 'reviews is append-only: a decision is a new row, never an update');
END;
CREATE TRIGGER IF NOT EXISTS reviews_no_delete
BEFORE DELETE ON reviews
BEGIN
  SELECT RAISE(ABORT, 'reviews is append-only');
END;

CREATE TRIGGER IF NOT EXISTS system_comments_no_update
BEFORE UPDATE ON system_comments
BEGIN
  SELECT RAISE(ABORT, 'system_comments is append-only');
END;
CREATE TRIGGER IF NOT EXISTS system_comments_no_delete
BEFORE DELETE ON system_comments
BEGIN
  SELECT RAISE(ABORT, 'system_comments is append-only');
END;

CREATE TRIGGER IF NOT EXISTS ai_review_proposals_no_update
BEFORE UPDATE ON ai_review_proposals
BEGIN
  SELECT RAISE(ABORT, 'ai_review_proposals is append-only');
END;
CREATE TRIGGER IF NOT EXISTS ai_review_proposals_no_delete
BEFORE DELETE ON ai_review_proposals
BEGIN
  SELECT RAISE(ABORT, 'ai_review_proposals is append-only');
END;

CREATE TRIGGER IF NOT EXISTS profile_revisions_no_update
BEFORE UPDATE ON profile_revisions
BEGIN
  SELECT RAISE(ABORT, 'profile_revisions is append-only');
END;
CREATE TRIGGER IF NOT EXISTS profile_revisions_no_delete
BEFORE DELETE ON profile_revisions
BEGIN
  SELECT RAISE(ABORT, 'profile_revisions is append-only');
END;

CREATE TRIGGER IF NOT EXISTS wizard_answers_no_update
BEFORE UPDATE ON wizard_answers
BEGIN
  SELECT RAISE(ABORT, 'wizard_answers is append-only');
END;
CREATE TRIGGER IF NOT EXISTS wizard_answers_no_delete
BEFORE DELETE ON wizard_answers
BEGIN
  SELECT RAISE(ABORT, 'wizard_answers is append-only');
END;

CREATE TRIGGER IF NOT EXISTS guidelines_no_update
BEFORE UPDATE ON guidelines
BEGIN
  SELECT RAISE(ABORT, 'guidelines is append-only: write a new version');
END;
CREATE TRIGGER IF NOT EXISTS guidelines_no_delete
BEFORE DELETE ON guidelines
BEGIN
  SELECT RAISE(ABORT, 'guidelines is append-only: write a new version');
END;

CREATE TRIGGER IF NOT EXISTS pain_reports_no_update
BEFORE UPDATE ON pain_reports
BEGIN
  SELECT RAISE(ABORT, 'pain_reports is append-only');
END;
CREATE TRIGGER IF NOT EXISTS pain_reports_no_delete
BEFORE DELETE ON pain_reports
BEGIN
  SELECT RAISE(ABORT, 'pain_reports is append-only');
END;
`;
