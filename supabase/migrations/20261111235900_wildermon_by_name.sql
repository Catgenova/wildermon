-- Wildermon by name, everywhere on the island.
--
-- Asked for: no association with the game's former name anywhere. The repository says Wildermon throughout and
-- the migrations before this one were edited to match, so a database built from them holds nothing of the old
-- name. The island was built from the earlier text, and this carries the same renames onto it:
--
--   * custom settings, set with `set_config` and read with `current_setting`: the `wildermon.*` namespace
--     (`wildermon.season`, `wildermon.pk`, `wildermon.source`, ...);
--   * request headers: `x-wildermon-seat` (`private.seat_header`), `x-wildermon-once` (`private.once_header`);
--   * accounts still under the old `.invalid` suffix: moved to `@catgenova.github.io`, the suffix every account
--     since 20260915200000 was made under, in `auth.users` and `auth.identities` (and any other auth row holding
--     the address); `name_domains()` answers to that suffix alone. A session is held by uid, so it stays good.
--
-- The former name is spelled here only as bytes (`pg_temp.old_word`), so this file does not carry it either.
--
-- What is rewritten, everything whose text holds the word, case ignored: functions and procedures, views,
-- policies, column defaults, check constraints, trigger definitions, comments, pg_cron jobs, role and database
-- settings, and stored text, json and arrays in every table this role may update (the migration history in
-- `supabase_migrations` included). The rewrite keeps case: all capitals, a capital first, or lower case.
--
-- Then it looks again (`pg_temp.old_name_left`) and fails, naming each thing left, if anything in the catalog, in
-- `public`, `private` or `auth`, or in any table this role may update still holds the word. A table this role may
-- not update elsewhere (a platform schema) is named in a notice instead. An account whose own name holds the word
-- stops it before anything is changed: a login name is the player's to choose.
--
-- Run again, it finds nothing and changes nothing. Tested in supabase/test/oldname.ts.

set local lock_timeout = '3s';

create or replace function pg_temp.old_word() returns text language sql immutable as $$
  select convert_from(decode('7775726d', 'hex'), 'UTF8')
$$;

create or replace function pg_temp.holds(p text) returns boolean language sql immutable as $$
  select p is not null and strpos(lower(p), pg_temp.old_word()) > 0
$$;

/** The text with the word renamed: an address under the old suffix to the current one, then case kept. */
create or replace function pg_temp.renamed(p text) returns text language sql immutable as $$
  select regexp_replace(
           replace(replace(
             regexp_replace(p, '@players\.' || pg_temp.old_word() || '\.invalid', '@catgenova.github.io', 'gi'),
             upper(pg_temp.old_word()), 'WILDERMON'),
             initcap(pg_temp.old_word()), 'Wildermon'),
           pg_temp.old_word(), 'wildermon', 'gi')
$$;

/** The tables whose rows are read for the word, and each one's text, json and array columns. */
create or replace function pg_temp.text_columns()
returns table (rel oid, nsp text, cols text[], types text[])
language sql stable as $$
  select c.oid, n.nspname::text,
         array_agg(a.attname::text order by a.attnum),
         array_agg(format_type(a.atttypid, a.atttypmod) order by a.attnum)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
    join pg_type t on t.oid = a.atttypid
    left join pg_type e on e.oid = t.typelem and t.typcategory = 'A'
    left join pg_type b on b.oid = t.typbasetype and t.typtype = 'd'
   where c.relkind = 'r'
     and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_(toast|temp)'
     and not (n.nspname = 'cron' and c.relname = 'job')
     and (t.typcategory = 'S' or t.oid in ('json'::regtype, 'jsonb'::regtype)
          or e.typcategory = 'S' or e.oid in ('json'::regtype, 'jsonb'::regtype)
          or b.typcategory = 'S' or b.oid in ('json'::regtype, 'jsonb'::regtype))
   group by c.oid, n.nspname
$$;

/** Where in a table's columns the word is, as a condition. */
create or replace function pg_temp.where_held(p_cols text[]) returns text language sql immutable as $$
  select string_agg(format('pg_temp.holds(%I::text)', c), ' or ') from unnest(p_cols) c
$$;

/** Everything in the database that still holds the word: what it is, which one, and whether this role may fix it. */
create or replace function pg_temp.old_name_left()
returns table (kind text, what text, strict boolean)
language plpgsql as $$
declare r record; v_n bigint;
begin
  return query
    select 'function', p.oid::regprocedure::text, true from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname not in ('pg_catalog', 'information_schema')
       and (pg_temp.holds(p.prosrc) or pg_temp.holds(p.proname) or pg_temp.holds(array_to_string(p.proconfig, ','))
            or pg_temp.holds(array_to_string(p.proargnames, ',')))
    union all
    select 'view', c.oid::regclass::text, true from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('v', 'm') and n.nspname not in ('pg_catalog', 'information_schema')
       and pg_temp.holds(pg_get_viewdef(c.oid))
    union all
    select 'name', format('%s %s', c.relkind, c.oid::regclass), true from pg_class c
     where pg_temp.holds(c.relname)
    union all
    select 'column', format('%s.%s', a.attrelid::regclass, a.attname), true from pg_attribute a
     where a.attnum > 0 and not a.attisdropped and pg_temp.holds(a.attname)
    union all
    select 'schema or type', x.nm, true from (
      select nspname::text as nm from pg_namespace union all select typname::text from pg_type
      union all select enumlabel::text from pg_enum) x
     where pg_temp.holds(x.nm)
    union all
    select 'policy', format('%s on %s', p.polname, p.polrelid::regclass), true from pg_policy p
     where pg_temp.holds(p.polname) or pg_temp.holds(pg_get_expr(p.polqual, p.polrelid))
        or pg_temp.holds(pg_get_expr(p.polwithcheck, p.polrelid))
    union all
    select 'default', format('%s.%s', d.adrelid::regclass, a.attname), true from pg_attrdef d
      join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
     where pg_temp.holds(pg_get_expr(d.adbin, d.adrelid))
    union all
    select 'constraint', format('%s on %s', c.conname, coalesce(c.conrelid::regclass::text, c.contypid::regtype::text)), true
      from pg_constraint c
     where pg_temp.holds(c.conname) or pg_temp.holds(pg_get_constraintdef(c.oid))
    union all
    select 'trigger', format('%s on %s', t.tgname, t.tgrelid::regclass), true from pg_trigger t
     where not t.tgisinternal and pg_temp.holds(pg_get_triggerdef(t.oid))
    union all
    select 'index', i.indexrelid::regclass::text, true from pg_index i
     where pg_temp.holds(pg_get_indexdef(i.indexrelid))
    union all
    select 'comment', (pg_identify_object(d.classoid, d.objoid, d.objsubid)).identity, true from pg_description d
     where pg_temp.holds(d.description)
    union all
    select 'shared comment', d.objoid::text, true from pg_shdescription d where pg_temp.holds(d.description)
    union all
    select 'setting', coalesce(s.setrole::regrole::text, 'every role') || ' in ' || coalesce(db.datname, 'every database'), true
      from pg_db_role_setting s left join pg_database db on db.oid = s.setdatabase
     where pg_temp.holds(array_to_string(s.setconfig, ','));
  if to_regclass('cron.job') is not null then
    return query execute $q$
      select 'cron job', jobname::text, true from cron.job
       where pg_temp.holds(jobname::text) or pg_temp.holds(command)$q$;
  end if;
  for r in select * from pg_temp.text_columns() loop
    if not has_table_privilege(r.rel, 'SELECT') then
      kind := 'unreadable table'; what := r.rel::regclass::text; strict := r.nsp in ('public', 'private', 'auth');
      return next;
      continue;
    end if;
    execute format('select count(*) from %s where %s', r.rel::regclass, pg_temp.where_held(r.cols)) into v_n;
    if v_n > 0 then
      kind := 'rows'; what := format('%s: %s', r.rel::regclass, v_n);
      strict := has_table_privilege(r.rel, 'UPDATE') or r.nsp in ('public', 'private', 'auth');
      return next;
    end if;
  end loop;
end $$;

do $do$
declare
  w text := pg_temp.old_word();
  r record;
  v_n bigint;
  v_set text;
  v_sql text;
  said jsonb := '{}';
  v_strict text;
  v_loose text;
  v_rows bigint;
begin
  perform set_config('wildermon.source', 'migration', true);

  -- ---- Accounts first: an account named with the word stops everything, and an address under the old suffix moves.
  select count(*) into v_n from auth.users
   where pg_temp.holds(split_part(email, '@', 1));
  if v_n > 0 then
    raise exception 'Not renamed: % account(s) whose own name holds the old word. A new login name is the player''s to choose.', v_n;
  end if;
  select count(*) into v_n from auth.users u
   where u.email ~* ('@players\.' || w || '\.invalid$')
     and exists (select 1 from auth.users o where o.id <> u.id and lower(o.email) = lower(pg_temp.renamed(u.email)));
  if v_n > 0 then
    raise exception 'Not moved: % account(s) under the old suffix whose name is already taken under the current one.', v_n;
  end if;
  update auth.users set email = pg_temp.renamed(email)
   where email ~* ('@players\.' || w || '\.invalid$');
  get diagnostics v_n = row_count;
  said := said || jsonb_build_object('accounts moved', v_n);
  if to_regclass('auth.identities') is not null then
    execute $q$
      update auth.identities
         set identity_data = pg_temp.renamed(identity_data::text)::jsonb,
             provider_id = pg_temp.renamed(provider_id)
       where pg_temp.holds(identity_data::text) or pg_temp.holds(provider_id)$q$;
    get diagnostics v_n = row_count;
    said := said || jsonb_build_object('identities moved', v_n);
  end if;

  -- ---- Functions and procedures.
  v_n := 0;
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname not in ('pg_catalog', 'information_schema') and p.prokind <> 'a'
       and pg_has_role(p.proowner, 'USAGE')
       and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
       and (pg_temp.holds(p.prosrc) or pg_temp.holds(array_to_string(p.proconfig, ',')))
  loop
    execute pg_temp.renamed(pg_get_functiondef(r.oid));
    v_n := v_n + 1;
  end loop;
  said := said || jsonb_build_object('functions', v_n);

  -- The account suffixes: the current one alone.
  create or replace function public.name_domains() returns text[] language sql immutable as $f$
    select array['@catgenova.github.io']
  $f$;

  -- ---- Views (a materialised view is left to the check: none is expected).
  v_n := 0;
  for r in
    select c.oid, c.reloptions from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind = 'v' and n.nspname not in ('pg_catalog', 'information_schema')
       and pg_has_role(c.relowner, 'USAGE') and pg_temp.holds(pg_get_viewdef(c.oid))
  loop
    execute format('create or replace view %s %s as %s', r.oid::regclass,
                   coalesce('with (' || array_to_string(r.reloptions, ', ') || ')', ''),
                   pg_temp.renamed(pg_get_viewdef(r.oid)));
    v_n := v_n + 1;
  end loop;
  said := said || jsonb_build_object('views', v_n);

  -- ---- Policies.
  v_n := 0;
  for r in
    select p.polname, p.polrelid, pg_get_expr(p.polqual, p.polrelid) as q, pg_get_expr(p.polwithcheck, p.polrelid) as c
      from pg_policy p
     where pg_temp.holds(pg_get_expr(p.polqual, p.polrelid)) or pg_temp.holds(pg_get_expr(p.polwithcheck, p.polrelid))
  loop
    execute format('alter policy %I on %s', r.polname, r.polrelid::regclass)
         || coalesce(' using (' || pg_temp.renamed(r.q) || ')', '')
         || coalesce(' with check (' || pg_temp.renamed(r.c) || ')', '');
    v_n := v_n + 1;
  end loop;
  said := said || jsonb_build_object('policies', v_n);

  -- ---- Column defaults.
  v_n := 0;
  for r in
    select d.adrelid, a.attname, pg_get_expr(d.adbin, d.adrelid) as e from pg_attrdef d
      join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
     where pg_temp.holds(pg_get_expr(d.adbin, d.adrelid))
  loop
    execute format('alter table %s alter column %I set default %s', r.adrelid::regclass, r.attname, pg_temp.renamed(r.e));
    v_n := v_n + 1;
  end loop;
  said := said || jsonb_build_object('defaults', v_n);

  -- ---- Check constraints on tables.
  v_n := 0;
  for r in
    select c.conname, c.conrelid, pg_get_constraintdef(c.oid) as def from pg_constraint c
     where c.contype = 'c' and c.conrelid <> 0 and pg_temp.holds(pg_get_constraintdef(c.oid))
  loop
    execute format('alter table %s drop constraint %I', r.conrelid::regclass, r.conname);
    execute format('alter table %s add constraint %I %s', r.conrelid::regclass, r.conname, pg_temp.renamed(r.def));
    v_n := v_n + 1;
  end loop;
  said := said || jsonb_build_object('checks', v_n);

  -- ---- Triggers whose definition (its condition, its arguments) holds the word.
  v_n := 0;
  for r in
    select t.tgname, t.tgrelid, pg_get_triggerdef(t.oid) as def from pg_trigger t
     where not t.tgisinternal and pg_temp.holds(pg_get_triggerdef(t.oid))
  loop
    execute format('drop trigger %I on %s', r.tgname, r.tgrelid::regclass);
    execute pg_temp.renamed(r.def);
    v_n := v_n + 1;
  end loop;
  said := said || jsonb_build_object('triggers', v_n);

  -- ---- Comments.
  v_n := 0;
  for r in
    select o.type, o.identity, d.description from pg_description d,
           lateral pg_identify_object(d.classoid, d.objoid, d.objsubid) o
     where pg_temp.holds(d.description)
  loop
    execute format('comment on %s %s is %L',
                   case when r.type like '%column' then 'column'
                        when r.type = 'table constraint' then 'constraint'
                        when r.type = 'domain constraint' then 'constraint'
                        else r.type end,
                   r.identity, pg_temp.renamed(r.description));
    v_n := v_n + 1;
  end loop;
  said := said || jsonb_build_object('comments', v_n);

  -- ---- pg_cron's jobs, where the project has it.
  if to_regclass('cron.job') is not null then
    v_n := 0;
    for r in execute $q$
      select jobid, jobname, schedule, command, active from cron.job
       where pg_temp.holds(command) or pg_temp.holds(jobname)$q$
    loop
      if pg_temp.holds(r.jobname) then
        execute 'select cron.unschedule($1)' using r.jobid;
        execute 'select cron.schedule($1, $2, $3)' using pg_temp.renamed(r.jobname), r.schedule, pg_temp.renamed(r.command);
        if not r.active then
          execute 'select cron.alter_job(jobid, active := false) from cron.job where jobname = $1' using pg_temp.renamed(r.jobname);
        end if;
      else
        execute 'select cron.alter_job($1, command := $2)' using r.jobid, pg_temp.renamed(r.command);
      end if;
      v_n := v_n + 1;
    end loop;
    said := said || jsonb_build_object('cron jobs', v_n);
  end if;

  -- ---- Role and database settings.
  v_n := 0;
  for r in
    select s.setrole, s.setdatabase, db.datname, c as setting from pg_db_role_setting s
      left join pg_database db on db.oid = s.setdatabase, unnest(s.setconfig) c
     where pg_temp.holds(c)
  loop
    v_sql := case when r.setrole = 0 then format('alter database %I', r.datname)
                  when r.setdatabase = 0 then format('alter role %I', r.setrole::regrole)
                  else format('alter role %I in database %I', r.setrole::regrole, r.datname) end;
    v_set := split_part(r.setting, '=', 1);
    execute v_sql || format(' reset %s', v_set);
    execute v_sql || format(' set %s = %L', pg_temp.renamed(v_set), pg_temp.renamed(substr(r.setting, length(v_set) + 2)));
    v_n := v_n + 1;
  end loop;
  said := said || jsonb_build_object('settings', v_n);

  -- ---- Stored rows: every text, json and array column of every table this role may update.
  v_n := 0;
  for r in select * from pg_temp.text_columns() t where has_table_privilege(t.rel, 'UPDATE') and has_table_privilege(t.rel, 'SELECT') loop
    select string_agg(format('%1$I = case when pg_temp.holds(%1$I::text) then pg_temp.renamed(%1$I::text)::%2$s else %1$I end',
                             c, ty), ', ')
      into v_sql
      from unnest(r.cols, r.types) as x(c, ty);
    execute format('update %s set %s where %s', r.rel::regclass, v_sql, pg_temp.where_held(r.cols));
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      said := said || jsonb_build_object('rows in ' || r.rel::regclass::text, v_rows);
      v_n := v_n + v_rows;
    end if;
  end loop;
  said := said || jsonb_build_object('rows', v_n);

  raise notice 'Renamed: %', said;

  -- ---- And looked at again.
  select string_agg(kind || ' ' || what, '; ') filter (where strict),
         string_agg(kind || ' ' || what, '; ') filter (where not strict)
    into v_strict, v_loose
    from pg_temp.old_name_left();
  if v_loose is not null then
    raise notice 'Left, as this role may not change them: %', v_loose;
  end if;
  if v_strict is not null then
    raise exception 'Still holding the old word: %', v_strict;
  end if;
  raise notice 'Nothing on the island holds the old word.';
end $do$;

select private.lock_doors();
