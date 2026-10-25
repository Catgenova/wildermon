/*
 * Which builds of the site the island takes.
 *
 * Every build hashes itself (scripts/harden.mjs: the first 16 hex digits of
 * the SHA-256 of every script and stylesheet it serves) and writes the hash
 * and its deploy number into assets/version.json. The deploy (the migrate job
 * in .github/workflows/island.yml) hands both to `private.builds_deployed`
 * through supabase/build.sql, as the hashes the site serves now; the browser
 * says its own at the join (`rpc_build_check`, from `Island.join`).
 *
 * Taken:
 *   * a build the deploy handed over that is current, or was retired less than
 *     `build_grace()` ago, so a page open across a deploy is not sent off;
 *   * a build whose deploy number is past every one the island has been told:
 *     the site is served before the deploy's run reaches the island;
 *   * anything at all while the island has no current build (an empty table),
 *     and whenever the check itself fails.
 * Anything else is refused as "Game updated. Reload.", which the page shows
 * with a Reload button. The island is the authority on everything a build
 * asks of it either way; this sends an old or altered page back for the
 * current one, and nothing more.
 */
set local lock_timeout = '3s';

/** How long a build is still taken after the deploy that replaced it. */
create or replace function private.build_grace() returns interval language sql immutable as $fn$ select interval '1 hour' $fn$;
revoke all on function private.build_grace() from public, anon, authenticated;

create table if not exists private.build_ok (
  hash text primary key check (hash ~ '^[0-9a-f]{16}$'),
  deploy int,
  added_at timestamptz not null default now(),
  retired_at timestamptz
);
alter table private.build_ok enable row level security;
revoke all on table private.build_ok from public, anon, authenticated;

/*
 * The deploy: these are the builds the site serves now, as
 * `[{"build": "<16 hex>", "deploy": <n or null>}, ...]`. Every other current
 * build is retired as of now, and taken for `build_grace()` more. A build
 * handed over again comes back as current. Builds retired over 30 days ago go.
 * Returns how many builds are current.
 */
create or replace function private.builds_deployed(p_builds jsonb) returns int
language plpgsql security definer set search_path = public as $fn$
declare v_now text[]; v_n int;
begin
  select coalesce(array_agg(distinct b->>'build'), '{}') into v_now
    from jsonb_array_elements(case when jsonb_typeof(p_builds) = 'array' then p_builds else '[]'::jsonb end) b
   where b->>'build' ~ '^[0-9a-f]{16}$';
  if cardinality(v_now) = 0 then
    select count(*) into v_n from private.build_ok where retired_at is null;
    return v_n;
  end if;
  insert into private.build_ok as k (hash, deploy)
  select d.hash, max(d.deploy)
    from (select b->>'build' as hash,
                 case when b->>'deploy' ~ '^[0-9]{1,9}$' then (b->>'deploy')::int end as deploy
            from jsonb_array_elements(p_builds) b where b->>'build' = any(v_now)) d
   group by d.hash
  on conflict (hash) do update
     set deploy = coalesce(excluded.deploy, k.deploy),
         added_at = case when k.retired_at is null then k.added_at else now() end,
         retired_at = null;
  update private.build_ok set retired_at = now() where retired_at is null and not (hash = any(v_now));
  delete from private.build_ok where retired_at < now() - interval '30 days';
  select count(*) into v_n from private.build_ok where retired_at is null;
  return v_n;
end $fn$;
revoke all on function private.builds_deployed(jsonb) from public, anon, authenticated;

/* Whether the island takes this build: see the head of this file. */
create or replace function private.build_taken(p_build text, p_deploy int) returns boolean
language sql stable security definer set search_path = public as $fn$
  select not exists (select 1 from private.build_ok b where b.retired_at is null)
      or exists (select 1 from private.build_ok b
                  where b.hash = p_build and (b.retired_at is null or b.retired_at > now() - private.build_grace()))
      or (p_deploy is not null and p_deploy > coalesce((select max(b.deploy) from private.build_ok b), p_deploy))
$fn$;
revoke all on function private.build_taken(text, int) from public, anon, authenticated;

/*
 * The browser's build, at the join: `{"ok": true}`, or `{"ok": false, "why":
 * "Game updated. Reload."}`. A check that fails takes the build.
 */
create or replace function public.rpc_build_check(p_build text, p_deploy int default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_ok boolean := true;
begin
  begin
    v_ok := coalesce(private.build_taken(lower(left(coalesce(p_build, ''), 16)), p_deploy), true);
  exception when others then
    v_ok := true;
  end;
  if v_ok then return jsonb_build_object('ok', true); end if;
  return jsonb_build_object('ok', false, 'why', 'Game updated. Reload.');
end $function$;

select private.lock_doors();
