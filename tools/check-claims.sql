-- Structural read-back for schemas/sql/schema.sql: the security claims that prose makes and that a
-- green "it loaded" does not prove. It lives outside the DDL on purpose -- schema.sql is the thing
-- under test, so it must not also contain the ruler that measures it.
--
-- Scope, learned by running this against a real server: the tenant tables live in `public`, `app`
-- holds plumbing (deletion_log and the purge helpers), `analytics` holds only views. A ruler that
-- looked only in app/analytics would report a clean bill of health for a schema it never measured.
--
-- Run it after loading schema.sql for real:  psql -v ON_ERROR_STOP=1 -f tools/check-claims.sql
-- Silence plus one NOTICE is a pass. Every check raises with the reason in its own words.
do $$
declare
  bad int;
begin
  -- 1. Every tenant table -- every table carrying user_id -- has FORCE, not merely ENABLE. FORCE is
  --    the half that matters, because the table owner otherwise walks past every policy.
  select count(*) into bad from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and a.attnum > 0
   where ns.nspname = 'public' and c.relkind = 'r' and not c.relforcerowsecurity;
  if bad <> 0 then
    raise exception 'tenant tables without FORCE ROW LEVEL SECURITY: %', bad;
  end if;

  -- 2. Exactly one table may have RLS off: app.deletion_log, written only by SECURITY DEFINER
  --    logging functions, holding request metadata and no health data.
  select count(*) into bad from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname in ('public', 'app', 'analytics') and c.relkind = 'r' and not c.relrowsecurity;
  if bad <> 1 then
    raise exception 'tables with row security off: % (expected 1: app.deletion_log)', bad;
  end if;

  -- 2b. And the exempt table must be the one named above. Without this line, check 2 could be
  --     satisfied by turning RLS off on a health table and on again somewhere harmless.
  select count(*) into bad from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname in ('public', 'app', 'analytics') and c.relkind = 'r' and not c.relrowsecurity
     and not (ns.nspname = 'app' and c.relname = 'deletion_log');
  if bad <> 0 then
    raise exception 'a table other than app.deletion_log has row security off: %', bad;
  end if;

  -- 3. No application role may bypass row security. This is the sentence ADR-0002 rests on.
  select count(*) into bad from pg_roles
   where rolname in ('app_user', 'worker', 'analytics_reader', 'purger') and (rolbypassrls or rolsuper);
  if bad <> 0 then
    raise exception 'application roles holding BYPASSRLS or superuser: %', bad;
  end if;

  -- 4. The purge capability must be able to see the rows it deletes. Both silent-deletion bugs in
  --    the history of this schema were a DELETE that matched nothing while reporting success, and
  --    the missing half was always a SELECT policy. So every tenant table needs a purger SELECT
  --    policy, and this check is what stops the third one.
  select count(*) into bad from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and a.attnum > 0
   where ns.nspname = 'public' and c.relkind = 'r'
     and not exists (
       select 1 from pg_policies p
        where p.schemaname = ns.nspname and p.tablename = c.relname
          and 'purger' = any (p.roles) and p.cmd = 'SELECT');
  if bad <> 0 then
    raise exception 'tenant tables with no purger SELECT policy: % (a DELETE that sees nothing deletes nothing)', bad;
  end if;

  -- 5. Analytics is the one place cross-user rows are allowed, so it is allowed only in aggregate:
  --     no view there may expose a user id, whatever else it computes.
  select count(*) into bad from information_schema.columns
   where table_schema = 'analytics' and column_name = 'user_id';
  if bad <> 0 then
    raise exception 'analytics views exposing user_id: % (adding a column there is a security change)', bad;
  end if;

  -- 6. Rule 4 is enforced in two layers on purpose: a REVOKE stops the honest caller, a trigger
  --     stops the one that holds a grant. The trigger half is invisible to a load test unless
  --     somebody counts it.
  select count(*) into bad
    from (values ('events'), ('day_entries'), ('system_comments'), ('prompt_deliveries'), ('pain_reports')) as want(tbl)
   where not exists (
       select 1 from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace ns on ns.oid = c.relnamespace
         join pg_proc p on p.oid = t.tgfoid
        where ns.nspname = 'public' and c.relname = want.tbl
          and p.proname = 'refuse_mutation' and t.tgname not like 'RI%');
  if bad <> 0 then
    raise exception 'append-only tables missing the refuse_mutation trigger: %', bad;
  end if;

  raise notice 'claims hold: forced rls, one named exempt table, no bypass, purge visibility, anonymous analytics, append-only guards';
end $$;
