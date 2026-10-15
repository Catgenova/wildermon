-- A name as you write it.
--
-- Asked: "Players currently can only name themselves in all lowercase for
-- account/player name, please correct to allow some free will there". The
-- name is the address Auth signs you in with, and Auth folds an address to
-- lowercase, so the name read back out of it was only ever lowercase.
--
-- The address stays as it is, so signing in does not care how you type it and
-- nobody can take Alice when alice is spoken for. What is new is the name as
-- you write it: same letters, your capitals. It is kept on the account, and it
-- is only ever kept when it folds back to the account's own name, so it can
-- change how you are shown and nothing else -- whoever wrote it.

set local lock_timeout = '3s';

alter table account add column if not exists display text;
alter table account drop constraint if exists account_display_folds;
alter table account add constraint account_display_folds check (display is null or lower(display) = name);

-- The name as written, when it is a casing of this account's name; null otherwise.
create or replace function name_cased(p_name text, p_display text) returns text
language sql immutable as $fn$
  select case when p_display is not null and lower(btrim(p_display)) = p_name
               and btrim(p_display) ~ '^[A-Za-z][A-Za-z0-9_-]{2,19}$'
         then btrim(p_display) end
$fn$;

-- What everybody sees you called: the name as you wrote it, or the account's own.
create or replace function account_name(p_uid uuid) returns text
language sql stable as $fn$
  select coalesce(a.display, a.name) from account a where a.uid = p_uid
$fn$;

/*
 * Who is signed in, in the casing they chose.
 *
 * The casing written at sign-up rides in with the account (`display` in its
 * metadata), and is taken the first time the account is seen; after that it
 * changes only through `rpc_name_case`.
 */
create or replace function rpc_my_name() returns text
language plpgsql security definer set search_path to 'public' as $fn$
declare v_uid uuid := auth.uid(); v_name text; v_said text;
begin
  if v_uid is null then return null; end if;
  select email_name(u.email), u.raw_user_meta_data->>'display' into v_name, v_said from auth.users u where u.id = v_uid;
  if v_name is null or not name_ok(v_name) then return null; end if;
  insert into account (uid, name, display) values (v_uid, v_name, name_cased(v_name, v_said)) on conflict (uid) do nothing;
  return account_name(v_uid);
end $fn$;

/*
 * Write your own name with the capitals you like.
 *
 * The same letters as the account's name and nothing else: it is how you are
 * shown, not who you are. Every island you are on shows it at once.
 */
create or replace function rpc_name_case(p_display text) returns text
language plpgsql security definer set search_path to 'public' as $fn$
declare v_uid uuid := auth.uid(); v_name text; v_cased text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  perform rpc_my_name();
  select name into v_name from account where uid = v_uid;
  if v_name is null then raise exception 'There is no account here to name.'; end if;
  v_cased := name_cased(v_name, p_display);
  if v_cased is null then raise exception 'Only the capitals can change: % is the name.', v_name; end if;
  update account set display = v_cased where uid = v_uid;
  update player set name = v_cased where uid = v_uid and lower(name) = v_name;
  return v_cased;
end $fn$;

select private.lock_doors();
