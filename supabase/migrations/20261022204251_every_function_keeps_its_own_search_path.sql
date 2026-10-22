/*
 * Every function keeps its own search path.
 *
 * Asked for: "Discover and address any red or yellow security concerns on supabase". The project's Security Advisor
 * warned of some 2,650 functions with a role mutable search path (`function_search_path_mutable`): a function that does
 * not pin its own path resolves names by whoever calls it. None of them is open to a browser -- `lock_doors` lets only
 * the `rpc_*` doors in, and every door pins `public` -- so a caller cannot steer one; but pinning them all costs nothing
 * measurable (a step and a round of the clock read the same either way) and closes the question.
 *
 * `private.pin_paths` pins `public, extensions` -- the path every door already gives what it calls, and the schema the
 * project keeps its extensions in -- on every function and procedure of `public` and `private` that has none, and leaves
 * an extension's own alone. And a `language sql` one: Postgres folds those into the query that calls them, which is
 * what keeps `max_health` and its like cheap (the `folded` test), and a function with a setting of its own is never
 * folded -- pinned, `max_health` cost 8 times what its body does. Folded, such a function runs on its caller's path,
 * and every caller that a browser can reach pins its own. `lock_doors` calls it last, so a function made or remade by a later migration is pinned by
 * the end of that migration.
 */

set local lock_timeout = '3s';

create or replace function private.pin_paths() returns int
language plpgsql set search_path = public as $$
declare f record; n int := 0;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname in ('public', 'private') and p.prokind in ('f', 'p') and p.proconfig is null
       and p.prolang <> (select l.oid from pg_language l where l.lanname = 'sql')
       and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter routine %s set search_path = public, extensions', f.sig);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function private.pin_paths() from public, anon, authenticated;

do $do$
declare v_def text;
  v_old text := $a$
  perform set_config('lock_timeout', was, true);
end $a$;
  v_new text := $a$
  perform private.pin_paths();
  perform set_config('lock_timeout', was, true);
end $a$;
begin
  select pg_get_functiondef('private.lock_doors'::regproc) into v_def;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'lock_doors does not end where it was expected to';
  end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
