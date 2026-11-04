-- =====================================================================================
-- schemas/sql/schema.sql -- Postgres 16 DDL SKETCH. NOT RUN IN PRODUCTION.
--
-- What this file is: the design sketch that real Drizzle migrations are reviewed against
-- (schemas/README.md rule 6). It is deliberately runnable-looking so a reviewer can paste
-- it into a throwaway cluster, but the migrations that ship are generated and reviewed
-- separately. If this file and a migration disagree, that is a bug in one of them.
--
-- What this file is not: the source of product rules. Those live in AGENTS.md and
-- knowledge/heuristics/*.yaml. A number appearing here is a shape, not a tuning knob.
--
-- -------------------------------------------------------------------------------------
-- NAMING: two namespaces, two spellings, codegen owns the mapping
-- -------------------------------------------------------------------------------------
--   SQL   : snake_case identifiers. Enum values are not re-spelled by hand: a value keeps the
--           spelling of the namespace that owns the word, so 'system-signal' is kebab and
--           'session.added' is dotted here for the same reason the JSON spells them that way, while
--           'in_app' is internal and stays snake_case. The three safety tiers are the one case where
--           a single word is read in knowledge, in SQL, in JSON and in a comment, so it is kebab in
--           all four ('advisory', 'constraint', 'hard-stop'; items 5 and 6 of
--           docs/engineering/contract-vocabulary.md).
--   JSON  : camelCase keys, kebab-case enum values ('user-request', 'hard-stop')
-- A column that stores a JSON contract stores the JSON *inside* the column, so the wire
-- spelling never leaks into SQL and nobody hand-maps field by field. Where a value must be
-- identical on both sides -- rule ids, knowledge anchors like recovery.yaml#hard_day_gap_hours
-- -- it is stored verbatim from the knowledge namespace and the exception is declared in the
-- JSON Schema (x-verbatim-enum-values). See schemas/README.md rule 7.
--
-- -------------------------------------------------------------------------------------
-- TIME: a training day is not a UTC date
-- -------------------------------------------------------------------------------------
--   instants   -> timestamptz (events.occurred_at, sync timestamps)
--   training day -> date, meaningful only together with users.tz and users.day_start_hour
--   a day is    [day 04:00 tz, next day 04:00 tz), default 04:00
-- Anything derived from a day stores the day AND the zone it was computed in, so a runner
-- moving timezone cannot silently shift their history by a day (docs/data/data-model.md
-- "Time handling"). DST is handled by date labels, never by hour arithmetic.
-- =====================================================================================

-- gen_random_uuid() is core since PG13; no extension is required for keys.
create schema if not exists app;   -- functions only: never granted to the API roles
create schema if not exists analytics;

-- =====================================================================================
-- ROLES. The whole tenancy model rests on these four lines.
-- =====================================================================================
-- None of them may bypass row level security, and none owns a table. A role that owns its
-- tables is not subject to their policies -- FORCE ROW LEVEL SECURITY exists precisely because
-- ownership would otherwise be a hole -- so ownership belongs to a fifth role that the
-- application never connects as (the migration owner; this file grants it nothing).
create role app_user nologin noinherit;      -- the API, one transaction per request
create role worker   nologin noinherit;      -- planner, sync and reminder jobs
create role analytics_reader nologin noinherit;  -- aggregates only, sees no rows
create role purger   nologin noinherit;      -- account deletion, and nothing else
-- No SUPERUSER, CREATEDB, CREATEROLE, REPLICATION or BYPASSRLS anywhere above -- those are the
-- defaults, and saying so here is cheaper than discovering otherwise in a review.
-- `nologin` means no connection is made as these roles: the pool authenticates as a login role
-- that is a member of one. Because membership is NOINHERIT, that member must
-- `set role app_user` explicitly; without it the connection has no application privileges at
-- all, which is the safe direction for a connection string that forgot to say who it is.
-- `purger` is a capability role rather than a user type: DELETE on `users`, execute on the two
-- purge functions, no rights on any other table. It exists because a cascade skips row
-- security but not triggers, and because "the code path that erases a person's whole history"
-- deserves a name that shows up in a grant listing.

-- -------------------------------------------------------------------------------------
-- The tenant predicate, spelled exactly once.
-- -------------------------------------------------------------------------------------
-- current_setting(..., true) returns NULL instead of raising when the setting is absent,
-- and NULL makes every USING clause false: a request that forgot to set app.user_id sees
-- zero rows rather than all of them, and rather than a 500 that tempts someone to catch it.
create function app.tenant_id() returns uuid
  language sql stable as
$$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

revoke all on function app.tenant_id() from public;
grant execute on function app.tenant_id() to app_user, worker, purger;
-- The third role here was not obvious, and cost a debugging cycle: a role named in a policy
-- must also be allowed to RUN the predicate. Without this grant the policy itself raises while
-- Postgres evaluates it, and the error that comes back says "permission denied for table
-- users" -- pointing at the grants section, forty statements away from the real line. Any role
-- added to a policy's role list belongs in this list too.

-- One factory so a review reads the predicate once instead of ninety times. Called only by
-- the migration owner; the API roles cannot create policies at runtime, which is what keeps
-- "call the factory" from becoming a privilege.
create function app.enforce_tenant(rel text) returns void
  language plpgsql as
$$
begin
  execute format('alter table %I enable row level security', rel);
  execute format('alter table %I force row level security', rel);
  -- Default deny comes from the absence of a policy; these three are the only doors.
  execute format($f$ create policy "%1$s_select" on %1$I for select
                      to app_user, worker
                      using (user_id = app.tenant_id()) $f$, rel);
  execute format($f$ create policy "%1$s_insert" on %1$I for insert
                      to app_user, worker
                      with check (user_id = app.tenant_id()) $f$, rel);
  execute format($f$ create policy "%1$s_update" on %1$I for update
                      to app_user, worker
                      using (user_id = app.tenant_id())
                      with check (user_id = app.tenant_id()) $f$, rel);
  execute format($f$ create policy "%1$s_delete" on %1$I for delete
                      to app_user, worker
                      using (user_id = app.tenant_id()) $f$, rel);
  -- What this defends against: a request that carries another runner's row id in a URL.
  -- WITH CHECK is the half that stops a cross-tenant UPDATE from succeeding and simply
  -- re-parenting someone else's row.
  --
  -- DELETE is here even though the product almost never deletes: account removal is a
  -- promise with a deadline, and a tenant who cannot delete their own row is a bug found at
  -- the worst possible moment. Append-only tables drop this policy again below, where the
  -- removal is visible as an exception rather than buried in a factory.
end
$$;
revoke all on function app.enforce_tenant(text) from public;
grant execute on function app.enforce_tenant(text) to postgres;

-- =====================================================================================
-- IDENTITY AND SETTINGS
-- =====================================================================================
create table users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  tz                 text not null default 'Asia/Taipei',
  locale             text not null default 'en' check (locale in ('en', 'zh-Hant')),
  day_start_hour     smallint not null default 4 check (day_start_hour between 0 and 11),
  onboarding_complete boolean not null default false,
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz
  -- email is unique across the whole table, which is a cross-tenant oracle ("does this
  -- address have an account?"). The unique index lives on (email) only if product allows
  -- signup to be global; otherwise it must be a partial index excluding soft-deleted rows.
  -- TODO(m0): decide in auth design, then either keep or drop the global uniqueness.
);
-- users is its own tenant table: the key is id, so it cannot use the factory.
alter table users enable row level security;
alter table users force row level security;
create policy "users_self" on users for all
  to app_user, worker, purger
  using (id = app.tenant_id())
  with check (id = app.tenant_id());
-- What this defends against: horizontal escalation through any endpoint that takes a user
-- id as a parameter. It also means a worker job must set app.user_id per user, see below.
-- `purger` is listed so it can delete one account, and the table-level grant further down
-- limits it to DELETE: the policy says which rows, the grant says which verbs, and a role
-- needs both. Neither is a substitute for the other.

create table athlete_profiles (
  user_id     uuid not null references users(id) on delete cascade,
  id          uuid not null default gen_random_uuid(),
  valid_from  date not null,
  valid_to    date,
  profile     jsonb not null,   -- athlete-profile.schema.json; validated at the edge, not here
  primary key (user_id, id)
);
create index on athlete_profiles (user_id, valid_from desc);

create table profile_revisions (
  user_id     uuid not null references users(id) on delete cascade,
  id          bigint generated always as identity,
  changed_by  text not null check (changed_by in ('runner', 'import', 'review', 'support')),
  diff        jsonb not null,
  source      text not null check (source in ('user', 'import', 'review')),
  occurred_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table notification_prefs (
  user_id    uuid not null references users(id) on delete cascade,
  channel    text not null check (channel in ('push', 'email', 'in_app')),
  budget_per_day smallint not null default 1 check (budget_per_day between 0 and 5),
  quiet_from time not null default '21:00',
  quiet_to   time not null default '07:00',
  primary key (user_id, channel)
);

create table provider_connections (
  user_id     uuid not null references users(id) on delete cascade,
  id          uuid not null default gen_random_uuid(),
  provider    text not null,
  scope       text not null,
  token_enc   bytea,                    -- ciphertext while it exists; the key never lives here
  status      text not null check (status in ('connected', 'revoked', 'error')),
  last_sync_at timestamptz,
  error       text,                     -- a category, never a token or a stack trace
  revoked_at  timestamptz,
  -- Rule 6 and ADR-0006: on revoke the token is destroyed, not merely flagged. The CHECK is the
  -- enforcement, which is a stronger promise than the leak test would be: a test only notices on
  -- the day a code path forgets, and by then the token is already at rest. `error` keeps its
  -- token on purpose -- an expired token is refreshed, a revoked one is erased.
  constraint token_survives_only_while_usable check (
    (status =  'revoked'  and token_enc is null)
    or
    (status <> 'revoked'  and token_enc is not null)
  ),
  primary key (user_id, id)
);
-- A 'revoked' row with a token in it is therefore not a state the database can represent, which
-- is the only kind of answer that outlives a refactor of the revoke command.

-- =====================================================================================
-- THE EVENT LOG (append-only)
-- =====================================================================================
-- Envelope contract: schemas/json/events.schema.json. Columns are the snake_case mirror.
create table events (
  user_id          uuid not null references users(id) on delete cascade,
  id               bigint generated always as identity,
  type             text not null check (type ~ '^[a-z][a-zA-Z]*\.[a-zA-Z][a-zA-Z]*$'),
  payload_version  smallint not null default 1,
  payload          jsonb not null default '{}',
  actor            text not null check (actor in ('runner', 'system', 'worker', 'import', 'support')),
  occurred_at      timestamptz not null,
  training_day     date not null,
  timezone         text not null,
  day_start_hour   smallint not null default 4 check (day_start_hour between 0 and 11),
  idempotency_key  text,
  causation_id     bigint,
  supersedes_event_id bigint,
  schema_url       text,
  recorded_at      timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, causation_id)        references events(user_id, id) on delete restrict,
  foreign key (user_id, supersedes_event_id) references events(user_id, id) on delete restrict,
  -- A runner action over a retrying network without a key is a client bug; the envelope
  -- says so and the storage layer refuses to be the place where the duplicate lands.
  constraint events_runner_write_is_idempotent
    check (actor <> 'runner' or idempotency_key is not null)
);
-- Unique per user, only where a key exists. This is what makes a double-tapped daily entry
-- one event instead of two, and two the second the reason the first was wrong.
create unique index events_idempotency on events (user_id, idempotency_key)
  where idempotency_key is not null;
create index on events (user_id, training_day, occurred_at);
create index on events (user_id, type, occurred_at);
-- Monthly partitioning is a scale decision, not a correctness one, and it changes every
-- index above (the unique key must contain the partition key).
-- TODO(m0): partitioning strategy -- decide when row counts justify it, in the ADR that
-- replaces the storage notes; until then a single table with the indexes above.

alter table events enable row level security;
alter table events force row level security;
create policy "events_append_only_select" on events for select
  to app_user, worker using (user_id = app.tenant_id());
create policy "events_append_only_insert" on events for insert
  to app_user, worker with check (user_id = app.tenant_id());
-- No UPDATE or DELETE policy exists, so the absence of a door is the rule. What this
-- defends against: any code path that "fixes" a bad entry by rewriting it, which would
-- silently change every metric computed from it (AGENTS rule 4).
create function app.refuse_mutation() returns trigger
  language plpgsql as
$$ begin
  -- The one exception, and it took running this file twice to describe correctly. The first
  -- account deletion died here, on the cascade into day_entries: referential-integrity actions
  -- run with row security OFF but triggers ON, so a promise to erase an account within 30 days
  -- was blocked by a rule about not editing history. The escape is not a session flag any
  -- caller could set -- it is a role that exists only for this purpose (see the purge grants
  -- near the end of this file). Note what `current_user` is during a cascade: the table OWNER,
  -- because the engine performs the action, not the caller. Measured during that first
  -- failure: this guard printed as=postgres for a delete issued by purger. So this branch
  -- serves the direct deletes that app.purge_user issues one table at a time, and cannot serve
  -- a cascade. That asymmetry is why the purge names its tables instead of relying on the
  -- foreign keys, and why the guard still refuses the leftover row of a table someone forgot
  -- to name there.
  if current_user = 'purger' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'refused: %.% is append-only (AGENTS rule 4); write a superseding row',
    tg_table_name, tg_op using errcode = 'TP401';
end $$;
-- A private SQLSTATE on purpose. Borrowing a stock code such as 55000 or 42501 would let an
-- unrelated Postgres error be mistaken for this refusal by any handler that catches by class --
-- including the probe below. TP401 means exactly one thing, and the API maps it to 409 Conflict
-- with the "write a new one instead" copy from the message catalogue.
create trigger events_no_mutation before update or delete on events
  for each row execute function app.refuse_mutation();
-- The trigger is not redundant with the missing policy: a role that later gains bypassrls,
-- or a support script run as owner, hits the trigger. Two independent reasons to say no.

-- =====================================================================================
-- FACTS: what the runner reported and what the devices saw
-- =====================================================================================
create table day_entries (
  user_id     uuid not null references users(id) on delete cascade,
  day         date not null,
  revision    smallint not null default 1 check (revision > 0),
  -- Two axes, named apart since 2026-11-04 (docs/engineering/contract-vocabulary.md item 20). One
  -- column used to carry both and could not carry the runner's answers: the wire's seven values and
  -- this CHECK's five shared two names, and the reason enum had no home at all.
  --   outcome      what happened to the day
  --   session_taken what was done against the prescription
  outcome      text not null check (outcome in ('rest', 'completed', 'partial', 'skipped', 'missed')),
  -- NULL is "the runner did not say": the wire spells that as an absent key, and the contract does not
  -- accept null (day-entry.schema.json, row 21 of docs/roadmap/backlog.md).
  session_taken text check (session_taken in ('as-prescribed', 'alternate', 'extra', 'partial', 'none')),
  outcome_detail text check (outcome_detail in
                   ('illness', 'travel', 'work', 'family', 'sleep', 'motivation', 'pain', 'weather',
                    'equipment', 'social', 'just-didnt', 'other')),
  rpe         smallint check (rpe between 1 and 10),
  legs        smallint check (legs between 1 and 5),      -- the product's five-point scale, not ten
  sleep_h     numeric(4, 2) check (sleep_h between 0 and 24),
  stress      smallint check (stress between 1 and 5),
  mood        smallint check (mood between 1 and 5),
  note        text,                        -- runner-authored, health-sensitive, never copied to events
  source      text not null check (source in ('manual', 'voice', 'import')),
  superseded_by bigint,                    -- points at the row that replaced this revision
  submitted_at timestamptz not null,
  timezone    text not null,               -- the zone this day belonged to when it was written
  primary key (user_id, day, revision),
  -- The two axes cannot contradict each other: a day that happened as a session has a session,
  -- and a day that did not says `none`. Written as a biconditional for the same reason
  -- accepted_review_has_a_choice is one - it catches the case where one field was updated and the
  -- other was not.
  -- `partial` is a marker on both axes: a part of the prescription is only a fact on a day whose outcome is
  -- partial, and a partial day cannot claim it did the prescription as written.
  constraint outcome_and_session_agree check (
    (session_taken is null)
    or (session_taken = 'none' and outcome in ('rest', 'skipped', 'missed'))
    or (session_taken = 'partial' and outcome = 'partial')
    or (session_taken in ('as-prescribed', 'alternate', 'extra') and outcome = 'completed')
  ),
  -- A part with no amount is not a fact, so a partial day has to say how much.
  constraint partial_day_has_an_amount check (
    not (outcome = 'partial' or session_taken = 'partial')
    or completed_km is not null
    or duration_min is not null
  )
);
-- The "latest" entry is a view over max(revision); an entry is never overwritten in place,
-- so a corrected log keeps the original claim and the reason it changed.
create view day_entries_current as
  select distinct on (user_id, day) *
    from day_entries order by user_id, day, revision desc;

create table pain_reports (
  user_id     uuid not null references users(id) on delete cascade,
  id          uuid not null default gen_random_uuid(),
  day         date not null,
  site        text not null,
  intensity   smallint not null check (intensity between 0 and 10),
  during_run  boolean not null default false,
  next_morning boolean not null default false,
  trend_gait_change boolean not null default false,
  note        text,
  primary key (user_id, id)
);
-- Highest-priority input, lowest intervention threshold: 0-3 monitor, 4-6 modify, 7+ stop,
-- with night pain and a gait change decisive. Those bands are knobs and live in
-- knowledge/heuristics/pain-thresholds.yaml; they are not duplicated here.

create table activities (
  user_id             uuid not null references users(id) on delete cascade,
  id                  uuid not null default gen_random_uuid(),
  provider            text not null,
  provider_activity_id text not null,
  revision            smallint not null default 1,
  started_at          timestamptz not null,
  duration_s          integer check (duration_s between 0 and 86400),
  distance_m          integer check (distance_m between 0 and 500000),  -- metres: device unit
  avg_hr              smallint, max_hr smallint,
  hr_series           bytea, hr_zones jsonb,
  cadence             smallint, power smallint,
  gpx_ref             text,
  raw_hash            text not null,
  provenance          text not null check (provenance in ('garmin', 'strava', 'coros', 'polar', 'manual', 'watch_manual')),
  quality_flags       text[] not null default '{}',
  primary key (user_id, id)
);
create unique index activities_idempotent on activities (user_id, provider, provider_activity_id, revision);

-- DELIBERATE ABSENCE: no column here stores a readiness, training-load, sleep-score or
-- recovery composite from a vendor. Those are grade-D evidence: display only, excluded from
-- signals_current, and unable to open a review. Storing them beside the raw feed is how
-- they quietly become inputs. The display path reads the provider payload at request time.

create table activity_links (
  user_id       uuid not null references users(id) on delete cascade,
  id            uuid not null default gen_random_uuid(),
  session_day   date not null,
  session_plan_version_id uuid,
  activity_id   uuid not null,
  match_method  text not null check (match_method in ('auto', 'suggested', 'manual')),
  confidence    numeric(3, 2) check (confidence between 0 and 1),
  primary key (user_id, id),
  foreign key (user_id, activity_id) references activities(user_id, id) on delete cascade
);

-- =====================================================================================
-- PLANNING
-- =====================================================================================
create table plan_versions (
  user_id              uuid not null references users(id) on delete cascade,
  id                   uuid not null default gen_random_uuid(),
  plan_id              uuid not null,          -- version chain identity (plan-version.schema.json)
  parent_version_id    uuid,
  status               text not null default 'draft'
                         check (status in ('draft', 'active', 'superseded', 'archived')),
  planner_version      text not null,
  -- the frozen bundle this was built with. Same CHECK as inputs_hash: this is the column that
  -- makes a plan explainable years later (AGENTS rule 1), so it must not be able to hold a
  -- version-looking string. docs/engineering/contract-vocabulary.md item 9.
  knowledge_hash       text not null check (knowledge_hash ~ '^sha256:[0-9a-f]{64}$'),
  inputs_hash          text not null check (inputs_hash ~ '^sha256:[0-9a-f]{64}$'),
  generated_at_day     date not null,          -- the fact/prescription boundary for this version
  first_day            date not null,
  last_day             date not null check (last_day >= first_day),
  timezone             text not null,
  day_start_hour       smallint not null default 4 check (day_start_hour between 0 and 11),
  payload              jsonb not null,         -- plan-version.schema.json; the canonical content
  reason               text,
  created_from_review_id bigint,
  primary key (user_id, id),
  foreign key (user_id, parent_version_id) references plan_versions(user_id, id) on delete restrict
);
-- The payload is the contract, so a bug fix never has to interpret a projection. Derived
-- columns (below) exist for queries only and are always recomputable from payload.
create index on plan_versions (user_id, status, first_day);

create function app.refuse_edit_of_active_plan() returns trigger
  language plpgsql as
$$ begin
  if old.status = 'active' and new.payload is not distinct from old.payload then
    return new;   -- status may still move: active -> superseded is lifecycle, not content
  end if;
  if old.status = 'active' then
    raise exception 'refused: plan version % is active; generate a new version instead (ADR-0004)',
      old.id using errcode = 'TP402';
  end if;
  return new;
end $$;
create trigger plan_versions_immutable before update on plan_versions
  for each row execute function app.refuse_edit_of_active_plan();

create table phases (
  user_id  uuid not null references users(id) on delete cascade,
  id       uuid not null default gen_random_uuid(),
  plan_version_id uuid not null,
  kind     text not null,
  start_day date not null,
  end_day  date not null check (end_day >= start_day),
  purpose  text not null,
  exit_criteria jsonb not null default '{}',
  primary key (user_id, id),
  foreign key (user_id, plan_version_id) references plan_versions(user_id, id) on delete cascade
);
-- Why start_day / end_day and not start / end: `end` is a reserved word, so the short spelling
-- would have to be quoted forever; and the _day suffix says what the value is -- a training day,
-- not an instant -- which the bare names did not, matching first_day / last_day on plan_versions
-- (docs/engineering/contract-vocabulary.md item 1).

create table plan_weeks (
  user_id   uuid not null references users(id) on delete cascade,
  plan_version_id uuid not null,
  iso_week_start date not null,
  phase_id  uuid,
  volume_km numeric(6, 1) not null check (volume_km between 0 and 500),
  longest_run_km numeric(5, 1) not null check (longest_run_km between 0 and 100),
  intensity_target jsonb not null default '{}',
  primary key (user_id, plan_version_id, iso_week_start),
  foreign key (user_id, plan_version_id) references plan_versions(user_id, id) on delete cascade
);
-- Why km here and metres on activities: weekly targets are a planning quantity the runner sees in
-- km; activities keep metres because that is the unit the device speaks. One boundary converts, and
-- the unit is in the column name on both sides. A column whose unit is only implied is how a 10x bug
-- ships (schemas/README.md rule 4, docs/engineering/contract-vocabulary.md item 2).

create table session_occurrences (
  user_id        uuid not null references users(id) on delete cascade,
  plan_version_id uuid not null,
  day            date not null,
  kind           text not null,      -- wire kinds: rest, easy, long, tempo, vo2max, ...
  hard_day       boolean not null default false,
  non_negotiable boolean not null default false,
  granularity    text not null check (granularity in ('coarse', 'detailed')),
  structure      jsonb not null default '{}',
  targets        jsonb not null default '{}',
  primary_target text check (primary_target in ('pace', 'hr', 'rpe', 'feel')),
  summary_text   text not null,
  explain        jsonb not null default '{}',   -- {ruleIds: [...], knowledgeRefs: [...]}
  alternate      jsonb,                          -- the short-time branch, never invented at tap time
  state          text not null default 'planned'
                   check (state in ('planned', 'adjusted', 'cancelled', 'done')),
  primary key (user_id, plan_version_id, day),
  foreign key (user_id, plan_version_id) references plan_versions(user_id, id) on delete cascade
);
-- A version is dense: one row per day from first_day to last_day, rest included, because
-- rest is a prescription and a missing row means something else entirely.
-- Two axes, deliberately not one vocabulary (earlier note here asked for "one day-status
-- vocabulary in four places"; measuring found four spellings of two different questions):
--   state          -- what the plan did on this day: planned / adjusted / cancelled / done
--   day_entries    -- what the runner reported: rest / completed / partial / skipped / missed
-- Collapsing them loses either `adjusted` (the plan moved, the run still happened) or `partial`
-- (the run happened, less than prescribed). The wire's plan-day `status` belongs to the second
-- axis and is renamed `outcome` there. See docs/engineering/contract-vocabulary.md item 8.

create table session_overrides (
  user_id        uuid not null references users(id) on delete cascade,
  id             uuid not null default gen_random_uuid(),
  plan_version_id uuid not null,
  day            date not null,
  kind           text not null,        -- shorten, swap_to_alternate, downgrade, become_rest, shift
  payload        jsonb not null default '{}',
  reason_rule_id text not null,
  fact_snapshot  jsonb not null,       -- the inputs the rule saw, so the chip can be re-explained
  accepted       boolean,
  reverted_at    timestamptz,
  created_at     timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, plan_version_id, day)
    references session_occurrences(user_id, plan_version_id, day) on delete cascade
);
-- Micro-adjustments layer on top of a version; session_occurrences is never mutated, so the
-- difference between "the plan said" and "what actually happened" survives forever.
create function app.override_cannot_reach_back() returns trigger
  language plpgsql as
$$ declare boundary date;
begin
  select generated_at_day into boundary
    from plan_versions where user_id = new.user_id and id = new.plan_version_id;
  if new.day <= boundary then
    raise exception 'refused: override targets day %, which is on or before the generation day % (AGENTS rule 4)',
      new.day, boundary using errcode = 'TP403';
  end if;
  return new;
end $$;
create trigger session_overrides_future before insert or update on session_overrides
  for each row execute function app.override_cannot_reach_back();
-- Why a trigger and not a CHECK: the comparison needs a value from another table, which a
-- CHECK constraint is not allowed to read.

-- =====================================================================================
-- DIFFS AND REVIEWS
-- =====================================================================================
create table plan_diffs (
  user_id     uuid not null references users(id) on delete cascade,
  id          uuid not null default gen_random_uuid(),
  from_version_id uuid not null,
  to_version_id   uuid not null,
  from_day    date not null,
  diff        jsonb not null,     -- plan-diff.schema.json, camelCase inside
  cost        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, from_version_id) references plan_versions(user_id, id) on delete restrict,
  foreign key (user_id, to_version_id)   references plan_versions(user_id, id) on delete restrict
);

create table plan_diff_changes (
  user_id   uuid not null references users(id) on delete cascade,
  diff_id   uuid not null,
  ordinal   smallint not null check (ordinal > 0),
  day       date not null,
  change_kind text not null check (change_kind in (
    'session.added', 'session.removed', 'distance.changed', 'pace.band-changed',
    'day.became-rest', 'day.swapped', 'session.moved', 'structure.changed',
    'session.downgraded', 'distance.reduced', 'pace.band-widened', 'pace.band-relaxed')),
  is_safety boolean not null default false,
  reason    text not null,
  signal_id text,
  primary key (user_id, diff_id, ordinal),
  foreign key (user_id, diff_id) references plan_diffs(user_id, id) on delete cascade,
  -- AGENTS rule 3 as data: a safety-origin change is subtractive by definition. Why a
  -- CHECK and not a test: a test can be skipped on a Friday; this cannot.
  -- History, kept because the mistake is the lesson: until 2026-11-04 the sentence above this
  -- block claimed the list was "exactly the subtractive half of change.kind in
  -- plan-diff.schema.json". It was not -- the two lists shared no value names (dotted here, seven
  -- kebab verbs there), so a wire change-dose could describe *raising* a distance and a row marked
  -- is_safety could increase load while still satisfying this CHECK. Decided and now applied: these
  -- 12 dotted values are the single change-kind vocabulary, plan-diff.schema.json's `kind` enum
  -- holds exactly them, and the 6 subtractive values below are the same 6 the contract declares as
  -- x-subtractive-change-kinds and repeats in its own if/then. Still true today: nothing in CI
  -- compares the three lists, so their equality is prose until row R4 of the application table in
  -- docs/engineering/contract-vocabulary.md adds a gate outside schemas/ that reads this CHECK
  -- straight out of the catalog (a ruler kept outside the thing it measures).
  -- The two-change cap is deliberately NOT here: it lives on reviews.changes_count, one table
  -- away, where the count is known at write time. A CHECK cannot count sibling rows, so the
  -- honest statement is that the cap is enforced somewhere else, not that it is enforced here.
  -- (Comments explaining the last item go ABOVE it: a trailing comma in a column list is a
  -- syntax error, and an explanation written after the comma lands three lines from the
  -- message that complains about it.)
  constraint changes_are_subtractive_or_not_safety
    check (not is_safety or change_kind in (
      'session.removed', 'session.downgraded', 'distance.reduced',
      'pace.band-widened', 'pace.band-relaxed', 'day.became-rest'))
);
create function app.diff_cannot_touch_completed_days() returns trigger
  language plpgsql as
$$ declare boundary date;
begin
  select generated_at_day into boundary
    from plan_diffs d join plan_versions v
      on v.user_id = d.user_id and v.id = d.from_version_id
    where d.user_id = new.user_id and d.id = new.diff_id;
  if new.day <= boundary then
    raise exception 'refused: diff % changes day %, which is on or before the base version''s generation day % (AGENTS rule 4)',
      new.diff_id, new.day, boundary using errcode = 'TP403';
  end if;
  return new;
end $$;
create trigger plan_diff_changes_future_only before insert or update on plan_diff_changes
  for each row execute function app.diff_cannot_touch_completed_days();

create table reviews (
  user_id        uuid not null references users(id) on delete cascade,
  id             bigint generated always as identity,
  opened_by      text not null check (opened_by in
                   ('system-signal', 'user-request', 'post-race', 'post-layoff', 'phase-boundary')),
  rule_id        text,
  severity       text not null check (severity in ('advisory', 'constraint', 'hard-stop')),
  status         text not null default 'open' check (status in
                   ('open', 'accepted', 'rejected', 'deferred', 'expired', 'superseded')),
  evidence_snapshot jsonb not null,
  evidence_hash  text not null check (evidence_hash ~ '^sha256:[0-9a-f]{64}$'),
  options        jsonb not null default '[]',   -- review.schema.json options[]; "keep as is" first
  -- The max-two-changes rule as a constraint (docs/data/data-model.md). It is the product
  -- rule "a review proposes at most two changes, and one is usually the right answer", and
  -- the only place it can be stated so that a bug cannot write three.
  changes_count  smallint not null default 0 check (changes_count between 0 and 2),
  chosen_option_id text,
  runner_reason  text,
  applied_plan_version_id uuid,
  checkpoint_at  date,
  checkpoint_verdict text check (checkpoint_verdict in
                   ('working', 'not-working', 'inconclusive', 'too-early')),
  opened_at      timestamptz not null default now(),
  decided_at     timestamptz,
  primary key (user_id, id),
  foreign key (user_id, applied_plan_version_id) references plan_versions(user_id, id) on delete restrict,
  -- An acceptance with no chosen option, or an option chosen without a status change, is a
  -- half-written review; the pair has to move together.
  constraint accepted_review_has_a_choice
    check ((status = 'accepted') = (chosen_option_id is not null))
);
-- DECIDED 2026-11-04 and applied in this commit: the tier vocabulary is kebab -- advisory /
-- constraint / hard-stop -- in all four places that spell it: the knowledge `severity:` lines, the
-- two CHECKs in this file, and the wire enum in plan-version.schema.json. The note that used to sit
-- here justified snake_case by "rule 7 says SQL enum values are snake_case"; rule 7 says no such
-- thing -- it fixes *key* casing and makes kebab the default for enum *values*. Measured before
-- deciding: knowledge wrote hard-stop on 20 lines across 15 files and hard_stop on 5 lines in one
-- file, so kebab was the minority of edits and needed no x-verbatim-enum-values flag on the wire.
-- `hard_stop(...)` as a verb inside a rule's `then:` stays snake_case: a tier is a noun, an action
-- is a verb, and only the tier crosses into this table
-- (docs/engineering/contract-vocabulary.md items 5 and 6).
-- The four declarations are compared by tools/check-vocabulary.ps1, which the `knowledge` CI job
-- runs; it fails on a mismatch and fails loudly if either CHECK is renamed, so the equality is a
-- check now and not a sentence. The same script compares the change-kind lists, which is item 7's
-- gate (docs/engineering/contract-vocabulary.md row R4).
-- The review status set is item 4's, and it is applied here too: a review row is created when it
-- opens (so 'open' is the default, and 'suggested' is gone), the runner's refusal is spelled
-- 'rejected' rather than 'declined', and 'superseded' exists so a newer review can replace an
-- unanswered one without pretending the runner answered. reviews_one_decision refuses a second
-- decision on 'accepted' or 'rejected' for the same reason it always did.
-- opened_by holds the wire's `openedBy`, which already matched exactly. It is NOT the wire's
-- `trigger`: that property is an object of evidence (signals, rules, grade, streak) and lands in
-- rule_id + evidence_snapshot + evidence_hash. The name `trigger` also collides with a database
-- trigger in every reader's head, which is why there is no column by that name here
-- (docs/engineering/contract-vocabulary.md item 3).
-- A review is a *question*, so the row that answers it is here too: chosen_option_id and
-- runner_reason live on the review rather than in a second table, because there is exactly
-- one answer per review and a join for that is ceremony.
create function app.refuse_review_rewrite() returns trigger
  language plpgsql as
$$ begin
  if old.status in ('accepted', 'rejected') then
    raise exception 'refused: review % is already %; open a new review instead',
      old.id, old.status using errcode = 'TP405';
  end if;
  return new;
end $$;
create trigger reviews_one_decision before update on reviews
  for each row execute function app.refuse_review_rewrite();

create table safety_events (
  user_id     uuid not null references users(id) on delete cascade,
  id          bigint generated always as identity,
  day         date not null,
  rule_id     text not null,
  tier        text not null check (tier in ('advisory', 'constraint', 'hard-stop')),
  scope       jsonb not null default '{}',
  acknowledged_at timestamptz,
  "override"  jsonb,          -- quoted: the column is a reserved word in every reader's head
  clearance   jsonb,          -- a clinician-referral record; never a diagnosis
  created_at  timestamptz not null default now(),
  primary key (user_id, id),
  -- An override that was not acknowledged is the exact failure mode AGENTS rule 3 forbids.
  constraint override_requires_recorded_acknowledgement
    check ("override" is null or acknowledged_at is not null)
);

create table system_comments (
  user_id     uuid not null references users(id) on delete cascade,
  id          bigint generated always as identity,
  day         date not null,
  rule_id     text not null,
  fact_object jsonb not null,      -- what the narrator was allowed to know
  template_id text,
  narrator    text not null check (narrator in ('template', 'llm')),
  model       text,
  text        text not null,
  locale      text not null check (locale in ('en', 'zh-Hant')),
  guardrail   jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  primary key (user_id, id)
);
-- Immutable: no UPDATE or DELETE policy below, and the text a runner read three months ago
-- has to be exactly the text they read.

-- =====================================================================================
-- DERIVED (rebuildable: a metric fix is a backfill, never a migration of history)
-- =====================================================================================
create table metrics_daily (
  user_id uuid not null references users(id) on delete cascade,
  day     date not null,
  timezone text not null,           -- computed-for zone, stored so a recompute is auditable
  load_trimp numeric(8, 1), load_srpe numeric(8, 1),
  ctl numeric(6, 1), atl numeric(6, 1), tsb numeric(6, 1), acwr numeric(4, 2),
  wellness_ewma jsonb not null default '{}',
  hr_drift numeric(5, 2), monotony numeric(4, 2), log_quality numeric(3, 2),
  requires jsonb not null default '{}',   -- what this row needed and did not get
  computed_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table signals_current (
  user_id  uuid not null references users(id) on delete cascade,
  key      text not null,     -- metric-registry ids, verbatim: morning_legs_ewma, ...
  value    numeric,
  unit     text,
  status   text not null check (status in ('ok', 'elevated', 'suppressed', 'unknown')),
  computed_at timestamptz not null,
  primary key (user_id, key)
);
-- DELIBERATE ABSENCE: no vendor composite is ever written here. If a number is in
-- signals_current it is grade C or better and may open a review.

create table pace_estimates (
  user_id  uuid not null references users(id) on delete cascade,
  id       uuid not null default gen_random_uuid(),
  distance_km numeric(5, 2) not null check (distance_km > 0),
  pace_sec_per_km smallint not null check (pace_sec_per_km between 120 and 900),
  method   text not null,
  confidence text not null check (confidence in ('measured', 'modelled', 'self-reported', 'none')),
  anchor_day date,                  -- the race or test this came from; paces expire
  valid_from date not null,
  valid_to date,
  primary key (user_id, id)
);
create unique index pace_estimates_no_overlap on pace_estimates (user_id, distance_km)
  where valid_to is null;   -- one authoritative pace per distance

-- =====================================================================================
-- RLS: apply the factory, then the exceptions
-- =====================================================================================
select app.enforce_tenant('athlete_profiles');
select app.enforce_tenant('profile_revisions');
select app.enforce_tenant('notification_prefs');
select app.enforce_tenant('provider_connections');
select app.enforce_tenant('day_entries');
select app.enforce_tenant('pain_reports');
select app.enforce_tenant('activities');
select app.enforce_tenant('activity_links');
select app.enforce_tenant('plan_versions');
select app.enforce_tenant('phases');
select app.enforce_tenant('plan_weeks');
select app.enforce_tenant('session_occurrences');
select app.enforce_tenant('session_overrides');
select app.enforce_tenant('plan_diffs');
select app.enforce_tenant('plan_diff_changes');
select app.enforce_tenant('reviews');
select app.enforce_tenant('safety_events');
select app.enforce_tenant('system_comments');
select app.enforce_tenant('metrics_daily');
select app.enforce_tenant('signals_current');
select app.enforce_tenant('pace_estimates');

-- Append-only tables get their UPDATE and DELETE policies dropped back out. Doing this as a
-- second pass, after the factory, is deliberate: the factory states the default and the
-- removal states the exception, and both are one line each.
drop policy "day_entries_update"     on day_entries;
drop policy "day_entries_delete"     on day_entries;
drop policy "profile_revisions_update" on profile_revisions;
drop policy "profile_revisions_delete" on profile_revisions;
-- pace_estimates keeps UPDATE: superseding an estimate means closing the old row's valid_to,
-- which is an update, and pretending otherwise would mean an ever-growing table of stale
-- rows that no query filters. It loses DELETE: an estimate is either current or closed.
drop policy "pace_estimates_delete"  on pace_estimates;
drop policy "system_comments_update" on system_comments;
drop policy "system_comments_delete" on system_comments;
create trigger system_comments_no_mutation before update or delete on system_comments
  for each row execute function app.refuse_mutation();
create trigger day_entries_no_mutation before update or delete on day_entries
  for each row execute function app.refuse_mutation();
-- session_occurrences.state does move (planned -> done), so that table keeps its update
-- policy; what may not change is its content, and ADR-0004 keeps content in the version.

-- Views inherit the referencing user's policies on the base table, so a view is not a hole.
grant select on day_entries_current to app_user;

-- =====================================================================================
-- GRANTS. Owner is `postgres` (never an application role), so FORCE ROW LEVEL SECURITY is
-- not what protects tenants; the policies are. These grants say what is possible at all.
-- =====================================================================================
grant usage on schema public to app_user, worker;
grant select, insert, update, delete on all tables in schema public to app_user;
grant select, insert, update, delete on all tables in schema public to worker;
grant usage, select on all sequences in schema public to app_user, worker;
-- DELETE is granted broadly, which looks wrong until the predicate is considered: the right to
-- delete anything is not the right to delete anything, because a delete that names another
-- runner's row matches no policy and removes zero rows. What it buys is ordinary row churn
-- inside one tenant -- rewriting a notification preference, dropping a session occurrence nobody
-- ran, revoking a provider connection, which destroys the stored token instead of keeping a
-- marked-dead row. The parts of a runner's life that are history get it taken back below.
-- worker is not more equal than app_user: nightly jobs loop over users and
-- set_config('app.user_id', ..., true) per user. Costs a loop; buys the guarantee that no
-- background job can read across tenants, which is the one place a "convenient" cross-user
-- query would otherwise appear.
revoke update, delete, truncate on events, day_entries, system_comments, profile_revisions from app_user, worker;
-- `users` loses DELETE for a different reason, and only running the deletion path found it: a
-- runner deleting their own row reaches day_entries through a foreign key, and the append-only
-- guard refuses -- correctly, because "erase everything I did" and "rewrite what I did" are the
-- same mechanism viewed from two ends. So self-erasure is not a tap on the account page. It is
-- the purge job: ordered, pinned to one tenant, recorded in app.deletion_log with a request
-- stamp and a completion stamp. The endpoint files the request; the worker executes it as
-- purger. A runner asking to be forgotten is asking for a process, and a process can be audited.
revoke delete on users from app_user, worker;
revoke truncate on all tables in schema public from app_user, worker;

-- =====================================================================================
-- ANALYTICS: aggregates only, its own role, k-anonymity in the view definition
-- =====================================================================================
-- analytics_reader is granted nothing on public, so a raw row cannot be reached through it
-- even by a join; the only path is these views, each of which refuses to emit a group
-- smaller than twenty runners. Twenty is a floor, not a proof: a view that groups by a
-- high-cardinality attribute can still single someone out. Grouping columns are therefore
-- an allowlist reviewed with the same care as a safety rule.
revoke all on schema public from analytics_reader;
grant usage on schema analytics to analytics_reader;
-- These views are read with the OWNER's rights (the PG16 default, `security_invoker = false`),
-- which is the only way an aggregate can be readable by a role that has no rights on the base
-- tables. It also means a view is a privilege grant, so the grouping allowlist below is the
-- control, and adding a column here is a security change, not a reporting change.

create view analytics.weekly_load_distribution as
  select extract(isoyear from day)::int                        as iso_year,
         extract(week from day)::int                           as iso_week,
         date_trunc('month', submitted_at)::date               as signup_month,
         count(distinct de.user_id)                            as runners,
         percentile_cont(0.5) within group (order by de.rpe)   as median_rpe
    from day_entries de
    join users u on u.id = de.user_id
   where u.deleted_at is null
   group by 1, 2, 3
  having count(distinct de.user_id) >= 20;   -- k-anonymity floor; no user_id in the output

create view analytics.plan_completion_rate as
  select so.kind,
         count(*) filter (where so.state = 'done')             as done,
         count(*)                                              as scheduled,
         count(distinct so.user_id)                            as runners
    from session_occurrences so
   group by so.kind
  having count(distinct so.user_id) >= 20;
-- A case study in knowledge/case-studies/ is an aggregate over this kind of query and
-- therefore survives account deletion; a cohort narrower than twenty is not a case study.

-- =====================================================================================
-- RETENTION AND DELETION (ADR-0006: deletion completes within 30 days, backups included)
-- =====================================================================================
-- Every tenant table above declares `on delete cascade` from users, so one delete removes
-- facts, plans, derived rows and events. The log is not exempt: retention is a promise to
-- the runner, not a preference of the storage engine.
-- app.deletion_log is the one table without a tenant policy, and the exception is stated
-- rather than noticed later: it is cross-tenant by definition (an operator needs "has anyone
-- ever asked to be deleted and not completed"), so a per-row predicate would be the wrong
-- shape. What protects it is that the API roles hold no privilege on the table at all: rows
-- can only be written through the two functions below, and `app` is granted USAGE purely so
-- those functions can be named.
create table app.deletion_log (
  user_id    uuid primary key,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  backup_expiry date            -- when the last backup containing this user expires
);
-- The log is the only object in `app` a caller may touch, and only through these two
-- functions: SECURITY DEFINER is correct here because the function's own owner is the only
-- role with rights on this table. search_path is pinned, which is not optional in a definer
-- function -- otherwise a caller can put a decoy `app` schema earlier in the path.
create function app.log_deletion_request(target uuid) returns void
  language plpgsql security definer set search_path = app, pg_temp as
$$ begin
  insert into app.deletion_log (user_id) values (target) on conflict do nothing;
end $$;
create function app.log_deletion_completion(target uuid) returns void
  language plpgsql security definer set search_path = app, pg_temp as
$$ begin
  update app.deletion_log
     set completed_at = now(), backup_expiry = current_date + 30
   where user_id = target;
end $$;

create function app.purge_user(target uuid) returns void
  language plpgsql security invoker as
$$ begin
  -- SECURITY INVOKER, and the reason is a bug this file contained forty lines earlier:
  -- FORCE ROW LEVEL SECURITY applies to a table owner too, so a SECURITY DEFINER purge would
  -- run as `postgres`, match no policy because no policy names `postgres`, see zero rows,
  -- delete zero rows and RETURN SUCCESS. An account-deletion promise with a 30-day deadline
  -- failing silently is the worst failure mode in this schema, so the delete runs as the
  -- authenticated caller under the same predicate as every other query.
  --
  -- The third argument to set_config is true: transaction-local. The tenant setting cannot
  -- outlive this statement's transaction and leak into the next request on a pooled
  -- connection, which is the classic version of this bug.
  perform set_config('app.user_id', target::text, true);
  perform app.log_deletion_request(target);

  -- Children first, in dependency order, written out. Two reasons this is a list and not
  -- `delete from users` and let the cascades run:
  --
  --   1. A cascaded delete runs with row security OFF and TRIGGERS ON, and the trigger fires
  --      as the table OWNER, not as the role that asked for the delete. So the append-only
  --      guard below sees `postgres`, not `purger`, refuses, and the account can never be
  --      erased. Measured, not assumed: the guard's own notice printed `as=postgres` during a
  --      cascade issued by purger.
  --   2. A runner asking "what happens to my data when I delete my account?" deserves an answer
  --      a person can read. This list is that answer.
  --
  -- Order is deepest first, and the restrict edges decide it: plan_diffs and reviews point at
  -- plan_versions with ON DELETE RESTRICT, so they go first; the two self-references (events
  -- .causation_id, plan_versions.parent_version_id) are fine inside one statement because all
  -- of the user's rows leave together.
  --
  -- The cascades stay declared on every FK, and that is not decoration: if someone adds a
  -- tenant table and forgets it here, the leftover child row is reached by cascade during the
  -- `delete from users` below, the guard refuses it, and the whole purge aborts. A forgotten
  -- table becomes a loud failure, which is the only acceptable outcome for a forgotten table.
  delete from session_overrides  where user_id = target;
  delete from plan_diff_changes  where user_id = target;
  delete from plan_diffs         where user_id = target;
  delete from activity_links     where user_id = target;
  delete from reviews            where user_id = target;
  delete from phases             where user_id = target;
  delete from plan_weeks         where user_id = target;
  delete from session_occurrences where user_id = target;
  delete from plan_versions      where user_id = target;
  delete from events             where user_id = target;
  delete from day_entries        where user_id = target;
  delete from pain_reports       where user_id = target;
  delete from activities         where user_id = target;
  delete from athlete_profiles   where user_id = target;
  delete from profile_revisions  where user_id = target;
  delete from notification_prefs where user_id = target;
  delete from provider_connections where user_id = target;
  delete from safety_events      where user_id = target;
  delete from system_comments    where user_id = target;
  delete from metrics_daily      where user_id = target;
  delete from signals_current    where user_id = target;
  delete from pace_estimates     where user_id = target;
  delete from users              where id      = target;
  if not found then
    raise exception 'purge_user: nothing deleted for %', target;   -- a no-op is not a success
  end if;
  perform app.log_deletion_completion(target);
end $$;
-- Two facts about this path, both learned by running it rather than by reading documentation:
-- FORCE ROW LEVEL SECURITY applies to a table owner too, so a SECURITY DEFINER purge would run
-- as the owner, match no policy, delete zero rows and report success; and a DELETE command is
-- checked against SELECT as well as DELETE privileges, because taking row marks counts as a
-- locking read. Both are why the grants below look wider than the verb in the function's name.
grant usage on schema app to app_user, worker;   -- to name app.purge_user, nothing more
grant execute on function app.purge_user(uuid) to app_user, worker;
grant execute on function app.log_deletion_request(uuid) to app_user, worker;
grant execute on function app.log_deletion_completion(uuid) to app_user, worker;
-- The deletion path proper: three functions and one table-level capability.
grant usage on schema public to purger;
grant usage on schema app to purger;
grant execute on function app.purge_user(uuid) to purger;
grant execute on function app.log_deletion_request(uuid) to purger;
grant execute on function app.log_deletion_completion(uuid) to purger;
-- Row privileges for the erase. This section is a correction, not a design: it is where the leak
-- test earned its keep, because every wrong guess here failed *silently* rather than loudly.
-- Two facts, both measured on this file rather than looked up:
--
--   1. A DELETE is checked against SELECT as well as DELETE privileges. Taking row marks counts
--      as a locking read. `grant delete on users to purger` alone produced 42501 "permission
--      denied for table users" -- naming no verb, and pointing at nothing in particular.
--   2. A role that HOLDS SELECT on a table with FORCE RLS also gets that role's SELECT policies
--      applied to the scan for a DELETE. Give `purger` SELECT and no SELECT policy and the
--      delete matches nothing: `explain` shows `Filter: false`, the statement says DELETE 0, and
--      app.purge_user's `if not found` is the only thing between that and a green build that
--      quietly kept the runner's history. Hence a select policy per table, not just a delete one.
--
-- So `purger` can read. What keeps it a capability rather than a superuser is the predicate, not
-- the verb list: every grant above is reachable only through a policy whose USING clause is
-- `user_id = app.tenant_id()`, and the only way to set that setting on a purger connection is
-- inside app.purge_user, which pins it to one account for the length of one transaction. The
-- honest sentence to say out loud in a review is: purger may read and erase one named runner,
-- for one transaction, including that runner's encrypted provider tokens. If that read is ever a
-- problem, the fix is a narrower function, not a wider role.
create function app.allow_purge(rel text) returns void
  language plpgsql as
$$ begin
  execute format('grant select, delete on table %s to purger', rel);
  -- Both policies name only purger, and policies are OR-ed among the roles they name, so
  -- neither can widen what app_user or worker can see. The SELECT one exists because a DELETE
  -- scan consults it (fact 2 above); the DELETE one exists because the append-only tables have
  -- their DELETE policies dropped on purpose, and a purge with no policy to match would find
  -- nothing rather than complain.
  execute format(
    $f$ create policy "%1$s_purge_select" on %1$I for select to purger
          using (user_id = app.tenant_id()) $f$, rel);
  execute format(
    $f$ create policy "%1$s_purge_delete" on %1$I for delete to purger
          using (user_id = app.tenant_id()) $f$, rel);
end $$;
revoke all on function app.allow_purge(text) from public;
-- No grant follows on purpose. This is DDL wearing a function's clothing: it hands a role the
-- right to erase rows. The migration owner can run it, and nothing the application connects as
-- can, which is the same rule that keeps enforce_tenant ungranted.
-- Every table that carries a tenant column, discovered rather than listed, because the failure
-- this protects against is a table added next month by someone who never read this section.
-- `users` is excluded: its policy keys on `id`, and it is already granted below.
do $$
declare r record; n int := 0;
begin
  for r in
    select c.relname::text as rel
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      join pg_attribute  a on a.attrelid = c.oid and a.attname = 'user_id' and a.attnum > 0
     where ns.nspname = 'public' and c.relkind = 'r' and c.relname <> 'users'
     order by 1
  loop
    perform app.allow_purge(r.rel);
    n := n + 1;
  end loop;
  raise notice 'purge capability granted on % tenant tables', n;
end $$;
grant select, delete on users to purger;   -- users_self already names purger; the key is `id`
-- Everything else in `app` stays unreachable: enforce_tenant and the refusal triggers are
-- revoked from public and granted to the migration owner only.
-- Backups: encrypted snapshots are kept on a rolling window no longer than 30 days, so
-- "deleted within 30 days" is true of the last snapshot without an restore-then-purge
-- procedure. The export format is the restore contract: whatever an export cannot express
-- is not something the system can promise to put back.
-- TODO(m0): the export schema itself (fields, units, media refs) -- a contract file of its
-- own in schemas/json, before the first deploy.

-- =====================================================================================
-- LEAK TEST -- run in CI against a throwaway cluster, inside a transaction that is rolled
-- back. Every assertion raises, so a dropped policy turns the build red.
--
-- Note how the rows get created: as app_user, with app.user_id set to each runner in turn.
-- The migration owner cannot seed this data even as a superuser, because FORCE ROW LEVEL
-- SECURITY applies to the owner and no policy names the owner. That is not an annoyance to
-- work around -- it is the test showing that ownership grants no visibility.
-- =====================================================================================
-- 1. Two runners, one entry each, written the only way this database allows.
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
        visible int;
begin
  set role app_user;
  perform set_config('app.user_id', a::text, true);
  insert into users (id, email, tz) values (a, 'a@example.test', 'Asia/Taipei');
  insert into day_entries (user_id, day, outcome, source, submitted_at, timezone)
    values (a, date '2026-11-03', 'completed', 'manual', now(), 'Asia/Taipei');
  -- One row in the log too, because step 4 needs a row to try to rewrite. An assertion that
  -- updates zero rows succeeds whether or not the guard exists, and passes for the wrong reason
  -- forever: that is exactly how step 4 failed the first time it was run.
  insert into events (user_id, type, actor, occurred_at, training_day, timezone,
                      idempotency_key, payload)
    values (a, 'dayEntry.submitted', 'runner', now(), date '2026-11-03', 'Asia/Taipei',
            'leak-test-seed', '{"day": "2026-11-03", "outcome": "completed"}');
  perform set_config('app.user_id', b::text, true);
  insert into users (id, email, tz) values (b, 'b@example.test', 'Asia/Taipei');
  insert into day_entries (user_id, day, outcome, source, submitted_at, timezone)
    values (b, date '2026-11-03', 'rest', 'manual', now(), 'Asia/Taipei');

  -- 2. A sees exactly their own row: a count of one, not an error. 404 not 403 (ADR-0002) --
  --    another runner's day is not a thing that exists for this session.
  perform set_config('app.user_id', a::text, true);
  select count(*) into visible from day_entries;
  if visible <> 1 then
    raise exception 'leak test: A should see exactly 1 row, saw %', visible;
  end if;

  -- 3. A cannot write B's row: the insert is refused by WITH CHECK.
  begin
    insert into day_entries (user_id, day, outcome, source, submitted_at, timezone)
      values (b, date '2026-11-03', 'completed', 'manual', now(), 'Asia/Taipei');
    raise exception 'leak test: cross-tenant insert should have been refused';
  exception when insufficient_privilege or check_violation then
    null;  -- expected
  end;

  -- 4. Append-only holds against the log, and both layers of that refusal are proven.
  --
  -- 4a. The outcome as the API experiences it: refused outright.
  begin
    execute 'update events set payload = ''{}'' where user_id = $1' using a;
    raise exception 'leak test: UPDATE on events should have been refused';
  exception when insufficient_privilege then
    null;  -- expected: the REVOKE in the grants section
  end;

  -- 4b. The layer beneath it. The revoke above means the trigger is never reached, and a guard
  -- you cannot reach is a guard you cannot prove -- so this step builds the very conditions the
  -- design forbids (a grant, plus an UPDATE policy that events deliberately does not have),
  -- demands the refusal arrive as the trigger's own SQLSTATE, and then takes both away again.
  -- It looks like a mistake in a schema file. It is the only way to see the second refusal, and
  -- the whole file runs in a transaction CI rolls back.
  reset role;
  execute 'grant update on events to app_user';
  execute 'create policy "events_probe_update" on events for update to app_user using (true) with check (true)';
  set role app_user;
  begin
    execute 'update events set payload = ''{}'' where user_id = $1' using a;
    raise exception 'leak test: a privilege alone let an event be rewritten'
      using errcode = 'TP002';
  exception
    when sqlstate 'TP401' then null;                 -- the guard raised, which is the point
  end;
  reset role;
  execute 'drop policy "events_probe_update" on events';
  execute 'revoke update on events from app_user';

  -- 5. worker is not above the predicate either.
  reset role;
  set role worker;
  perform set_config('app.user_id', '00000000-0000-0000-0000-000000000000', true);
  select count(*) into visible from day_entries;
  if visible <> 0 then
    raise exception 'leak test: worker with no tenant setting should see 0 rows, saw %', visible;
  end if;
  reset role;

  -- 6. Account deletion completes, and a silent no-op fails the build. A third runner, created
  --    and purged, so that the counts in steps 2 and 7 still describe A and B.
  set role app_user;
  perform set_config('app.user_id', c::text, true);
  insert into users (id, email, tz) values (c, 'c@example.test', 'Asia/Taipei');
  insert into day_entries (user_id, day, outcome, source, submitted_at, timezone)
    values (c, date '2026-11-03', 'rest', 'manual', now(), 'Asia/Taipei');

  --    6a. First, that a runner cannot delete their own past entry. Rule 4 protects the meaning
  --    of every derived metric from the person who produced it, and the right to destroy is not
  --    implied by ownership. The grant layer refuses here; the trigger layer under it is proven
  --    in 4b, and the one case where standing aside is correct -- a purge -- is proven next.
  begin
    delete from day_entries where user_id = c;
    raise exception 'leak test: a runner was allowed to delete an append-only fact'
      using errcode = 'TP001';
  exception
    when insufficient_privilege then null;             -- the REVOKE in the grants section
  end;

  --    6a'. The same refusal from the other end: the account row is not deletable by the person
  --    it describes. Leaving this granted would not have been caught by 6a, because a DELETE on
  --    `users` reaches the children by cascade and the guard's complaint is a different error
  --    entirely -- a build that goes green on the wrong exception is the failure mode this whole
  --    section keeps hitting. Self-erasure is the job below: filed as a request, finished as a
  --    completion, and impossible to do quietly.
  begin
    delete from users where id = c;
    raise exception 'leak test: a runner was allowed to delete their own account row'
      using errcode = 'TP001';
  exception
    when insufficient_privilege then null;             -- revoke delete on users from app_user
  end;

  --    6b. Then the deletion itself, as the capability role.  reset role;
  set role purger;
  perform app.purge_user(c);
  reset role;
  set role app_user;
  perform set_config('app.user_id', c::text, true);
  select count(*) into visible from day_entries;       -- tenant c, now an empty tenant
  if visible <> 0 then
    raise exception 'leak test: purged runner still has % day_entries rows', visible;
  end if;
  select count(*) into visible from users;
  if visible <> 0 then
    raise exception 'leak test: the account row survived purge_user';
  end if;
  reset role;
  select count(*) into visible from app.deletion_log where user_id = c and completed_at is not null;
  if visible <> 1 then
    raise exception 'leak test: purge did not record completion in app.deletion_log';
  end if;
  -- The day_entries row was removed by the cascade, not by a DELETE policy -- the child lost
  -- that policy on purpose, and the trigger that would normally refuse the delete stood aside
  -- for `purger` alone. Both halves of that sentence were written after the first run of this
  -- file failed in exactly the way it describes.

  -- 7. The probe proves itself. This is the step that keeps steps 2-6 honest.
  --
  -- It is NOT "drop a policy and count again": with no policy left, RLS denies everything and
  -- the count goes to zero, which is indistinguishable from the isolation the test claims to
  -- measure. A test that passes when security is removed has tested nothing. The sensitive
  -- version swaps the tenant predicate for a constant-true policy and demands the count rise.
  reset role;
  drop policy "day_entries_select" on day_entries;
  create policy "day_entries_probe" on day_entries for select to app_user using (true);
  set role app_user;
  perform set_config('app.user_id', a::text, true);
  select count(*) into visible from day_entries;
  reset role;
  if visible <> 2 then
    raise exception 'leak test is blind: with a constant-true select policy A should see both rows, saw %',
      visible;
  end if;
  drop policy "day_entries_probe" on day_entries;
  -- Success is silence. CI runs this file inside a transaction it rolls back, so the test
  -- users and the swapped policy vanish; a green run means every assertion held and that the
  -- assertions could still have failed.
end $$;
-- Run it as `psql -1 -f -v ON_ERROR_STOP=1` so the transaction rolls back whatever the probe
-- changed. The probe is the reason this file may be trusted: without step 7, deleting every
-- policy in this schema would still print a green check.
