-- Player text, cleaned on the island with one function, and no name that reads
-- as a keeper or as staff.
--
-- Everything somebody writes for others to read goes through
-- `private.clean_text(p, max)`: talk, letters and a parcel's note, notices, a
-- report's note, a memorial's line, a signature, the names of things, crates,
-- buildings, settlements, wildermon, ranks, bodies and islands. It removes
-- control characters, zero-width and invisible characters, bidi overrides and
-- isolates and tag characters; turns every other space and line break into one
-- space; trims; NFC; cuts at `max` code points (as talk always was: trimmed, then cut).
--
-- A name (not a line of talk) is also refused, in `private.name_reserved_said()`,
-- when it reads as staff or as a keeper (`private.name_refusal`): folded for
-- look-alikes (Cyrillic, Greek, small capitals, accents, digits and signs read
-- as letters), a word of it or all of it run together begins with keeper,
-- admin, moderator or system, or all of it is a keeper's name. Keepers are not
-- asked. The browser's half is `src/game/playertext.ts`; the two are held to
-- each other by `supabase/test/playertext.ts`.

-- ---------------------------------------------------------------- the rule

create or replace function private.clean_text(p text, p_max int default null) returns text
language sql immutable parallel safe set search_path = '' as $fn$
  select left(normalize(btrim(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
           '[\u0001-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F\u00AD\u034F\u061C\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\uFFF9-\uFFFB\U000E0000-\U000E007F]', '', 'g'),
           '[\u0009-\u000D \u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+', ' ', 'g'),
           ' {2,}', ' ', 'g'), ' '), NFC), case when p_max is null then 2147483647 else greatest(p_max, 0) end)
$fn$;

create or replace function private.name_fold(p text) returns text
language plpgsql immutable parallel safe set search_path = '' as $fn$
declare s text; w text; outp text := ''; run text := '';
begin
  s := private.clean_text(p, 200);
  s := regexp_replace(normalize(s, NFKD), '[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]', '', 'g');
  s := translate(s, E'\u0410\u0412\u0415\u0417\u041A\u041C\u041D\u041E\u0420\u0421\u0422\u0423\u0425\u0406\u0408\u0405\u0430\u0435\u043E\u0440\u0441\u0443\u0445\u0456\u0458\u0455\u04BB\u0501\u051B\u051D\u04CF\u0261\u043A\u043C\u0442\u0432\u043D\u0391\u0392\u0395\u0396\u0397\u0399\u039A\u039C\u039D\u039F\u03A1\u03A4\u03A5\u03A7\u03B1\u03B5\u03B9\u03BA\u03BD\u03BF\u03C1\u03C4\u03C5\u03C7\u0131\u0251\u1D00\u0299\u1D04\u1D05\u1D07\u0262\u029C\u026A\u1D0A\u1D0B\u029F\u1D0D\u0274\u1D0F\u1D18\u0280\uA731\u1D1B\u1D1C\u1D20\u1D21\u028F\u1D22',
                    'ABE3KMHOPCTYXIJSaeopcyxijshdqwlgkmtbhABEZHIKMNOPTYXaeikvoptuxiaabcdeghijklmnoprstuvwyz');
  s := regexp_replace(s, '([a-z])(?=[A-Z])', '\1 ', 'g');
  s := translate(s, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz');
  s := translate(s, '0123456789@$|!i', 'olzeasbtbgaslll');
  s := replace(replace(s, 'rn', 'm'), 'vv', 'w');
  s := btrim(regexp_replace(s, '[^a-z]+', ' ', 'g'), ' ');
  if s = '' then return ''; end if;
  for w in select t from regexp_split_to_table(s, ' ') with ordinality x(t, o) order by o loop
    if length(w) = 1 then
      run := run || w;
    else
      if run <> '' then outp := outp || ' ' || run; run := ''; end if;
      outp := outp || ' ' || w;
    end if;
  end loop;
  if run <> '' then outp := outp || ' ' || run; end if;
  return btrim(outp, ' ');
end $fn$;

create or replace function private.staff_words() returns text[]
language sql immutable parallel safe set search_path = '' as $fn$
  select array['keeper', 'admin', 'moderator', 'system']
$fn$;

create or replace function private.name_reserved_said() returns text
language sql immutable parallel safe set search_path = '' as $fn$
  select 'Reserved name: keepers and staff.'::text
$fn$;

-- The actions whose asked text (`p_target->>'name'`) is a name.
create or replace function private.names_asked() returns text[]
language sql immutable parallel safe set search_path = '' as $fn$
  select array['name_thing', 'plan_building', 'rename_building', 'rename_creature', 'found_settlement', 'rename_deed']
$fn$;

create or replace function private.name_poses(p text) returns boolean
language sql immutable parallel safe set search_path = '' as $fn$
  select f <> '' and exists (
    select 1 from unnest(string_to_array(f, ' ') || replace(f, ' ', '')) t, unnest(private.staff_words()) s
     where starts_with(t, private.name_fold(s)))
  from (select private.name_fold(p) as f) x
$fn$;

/*
 * Why a name will not be taken here, or null. Keepers of the island (or of
 * every island, with no island given) are not asked; anybody else is refused a
 * name that poses as staff, or one that folds to a keeper's name.
 */
create or replace function private.name_refusal(p_world uuid, p_uid uuid, p text) returns text
language plpgsql stable set search_path = '' as $fn$
declare f text;
begin
  if p_uid is not null and (exists (select 1 from private.island_owner o where o.uid = p_uid)
                            or (p_world is not null and private.is_island_owner(p_world, p_uid))) then
    return null;
  end if;
  if private.name_poses(p) then return private.name_reserved_said(); end if;
  f := replace(private.name_fold(p), ' ', '');
  if f <> '' and exists (
    select 1
      from (select o.uid from private.island_owner o
            union select w.made_by from public.world w where w.id = p_world and w.made_by is not null) k
      left join public.account a on a.uid = k.uid
      left join public.player pl on pl.uid = k.uid and pl.world_id = p_world
     where f in (replace(private.name_fold(a.name), ' ', ''), replace(private.name_fold(a.display), ' ', ''),
                 replace(private.name_fold(pl.name), ' ', ''))) then
    return private.name_reserved_said();
  end if;
  return null;
end $fn$;

revoke all on function private.clean_text(text, int) from public, anon, authenticated;
revoke all on function private.name_fold(text) from public, anon, authenticated;
revoke all on function private.staff_words() from public, anon, authenticated;
revoke all on function private.name_reserved_said() from public, anon, authenticated;
revoke all on function private.names_asked() from public, anon, authenticated;
revoke all on function private.name_poses(text) from public, anon, authenticated;
revoke all on function private.name_refusal(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- where it is used
--
-- Each one patched in place, the line that takes the text and nothing else, so
-- that whatever else has been done to the function since stays. An anchor must
-- be there exactly once; a patch already in is left alone.

do $do$
declare r record; def text; n int;
begin
  for r in select * from (values
    -- Talk, a letter (and a parcel's note, which is a letter), a report's note, a notice.
    ('public.rpc_say(uuid,text)'::regprocedure,
     $a$v_text := btrim(regexp_replace(
    regexp_replace(coalesce(p_text, ''), '[\r\n\t]+', ' ', 'g'), '\s{2,}', ' ', 'g'));$a$,
     $b$v_text := private.clean_text(p_text, say_max()::int);$b$),
    ('public.rpc_letter(uuid,uuid,text)'::regprocedure,
     $a$v_text := btrim(regexp_replace(
    regexp_replace(coalesce(p_text, ''), '[\r\n\t]+', ' ', 'g'), '\s{2,}', ' ', 'g'));$a$,
     $b$v_text := private.clean_text(p_text, 400);$b$),
    ('public.rpc_report_player(uuid,uuid,text,text)'::regprocedure,
     $a$v_note := btrim(regexp_replace(
    regexp_replace(coalesce(p_note, ''), '[\r\n\t]+', ' ', 'g'), '\s{2,}', ' ', 'g'));$a$,
     $b$v_note := private.clean_text(p_note, private.report_note_max()::int);$b$),
    ('public.rpc_notice_post(uuid,uuid,text)'::regprocedure,
     $a$v_text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));$a$,
     $b$v_text := private.clean_text(p_text);$b$),
    -- A memorial's line and a signature.
    ('public.memorial_clean(text)'::regprocedure,
     $a$select left(btrim(regexp_replace(
    regexp_replace(coalesce(p_text, ''), '[\r\n\t]+', ' ', 'g'), '\s{2,}', ' ', 'g')), engrave_max())$a$,
     $b$select private.clean_text(p_text, engrave_max()::int)$b$),
    ('public.sign_clean(text)'::regprocedure,
     $a$return left(btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[\r\n\t]+', ' ', 'g'), '\s{2,}', ' ', 'g')), sign_max());$a$,
     $b$return private.clean_text(p_text, sign_max()::int);$b$),
    -- An action's asked name: cleaned before it is judged, queued or kept...
    ('public.rpc_act(uuid,text,jsonb,integer)'::regprocedure,
     $a$  why := act_refusal(p_world, me, p_action, p_target);$a$,
     $b$  -- Player text: an asked name cleaned before it is judged, queued or kept (`private.clean_text`).
  if jsonb_typeof(p_target) = 'object' and jsonb_typeof(p_target->'name') = 'string' then
    p_target := jsonb_set(p_target, '{name}', to_jsonb(private.clean_text(p_target->>'name', 200)));
  end if;
  why := act_refusal(p_world, me, p_action, p_target);$b$),
    -- ...refused when it reads as a keeper or staff...
    ('public.act_refusal(uuid,uuid,text,jsonb)'::regprocedure,
     $a$  why := body_refusal(p_world, p_uid, p_action);
  if why is not null then return why; end if;$a$,
     $b$  why := body_refusal(p_world, p_uid, p_action);
  if why is not null then return why; end if;
  -- Player text: an asked name that reads as a keeper or staff (`private.name_refusal`).
  if p_action = any (private.names_asked()) then
    why := private.name_refusal(p_world, p_uid, p_target->>'name');
    if why is not null then return why; end if;
  end if;$b$),
    -- ...and cleaned again where it is kept.
    ('public.perform_building(uuid,uuid,text,jsonb)'::regprocedure,
     $a$nm := left(coalesce(nullif(btrim(coalesce(p_target->>'name', '')), ''), 'House'), 32);$a$,
     $b$nm := coalesce(nullif(private.clean_text(p_target->>'name', 32), ''), 'House');$b$),
    ('public.perform_building(uuid,uuid,text,jsonb)'::regprocedure,
     $a$nm := left(btrim(p_target->>'name'), 32);$a$,
     $b$nm := private.clean_text(p_target->>'name', 32);$b$),
    ('public.perform_creature(uuid,uuid,text,jsonb)'::regprocedure,
     $a$nm := left(btrim(p_target->>'name'), 24);$a$,
     $b$nm := private.clean_text(p_target->>'name', 24);$b$),
    ('public.perform_deed(uuid,uuid,text,jsonb)'::regprocedure,
     $a$nm := nullif(btrim(coalesce(p_target->>'name', '')), '');$a$,
     $b$nm := nullif(private.clean_text(p_target->>'name', 32), '');$b$),
    ('public.perform_hands(uuid,uuid,text,jsonb)'::regprocedure,
     $a$v_name := left(btrim(coalesce(p_target->>'name', '')), 28);$a$,
     $b$v_name := private.clean_text(p_target->>'name', 28);$b$),
    ('public.perform_settlement(uuid,uuid,text,jsonb)'::regprocedure,
     $a$v_name := left(btrim(p_target->>'name'), 32);$a$,
     $b$v_name := private.clean_text(p_target->>'name', 32);$b$),
    -- Ranks: cleaned before they are judged, and refused when they read as a keeper or staff.
    ('public.rpc_rank_add(uuid,text)'::regprocedure,
     $a$  v_why := rank_name_refusal(p_world, me, p_name);$a$,
     $b$  p_name := private.clean_text(p_name);  -- Player text (`private.clean_text`).
  v_why := rank_name_refusal(p_world, me, p_name);$b$),
    ('public.rpc_rank_rename(uuid,bigint,text)'::regprocedure,
     $a$  v_why := rank_name_refusal(p_world, me, p_name, p_id);$a$,
     $b$  p_name := private.clean_text(p_name);  -- Player text (`private.clean_text`).
  v_why := rank_name_refusal(p_world, me, p_name, p_id);$b$),
    ('public.rank_name_refusal(uuid,uuid,text,bigint)'::regprocedure,
     $a$    when lower(btrim(p_name)) = 'founder' then 'Founder is not a rank name.'$a$,
     $b$    when lower(btrim(p_name)) = 'founder' then 'Founder is not a rank name.'
    when private.name_refusal(p_world, p_founder, p_name) is not null then private.name_refusal(p_world, p_founder, p_name)$b$),
    -- A body's name: cleaned, at most an account name's length, and none that reads as a keeper or staff.
    ('public.rpc_join(uuid,text)'::regprocedure,
     $a$  select a.look into v_look from account a where a.uid = me;$a$,
     $b$  select a.look into v_look from account a where a.uid = me;
  -- Player text: a name that reads as a keeper or staff is not taken (`private.name_refusal`).
  p_name := private.clean_text(p_name, 20);
  if private.name_refusal(p_world, me, p_name) is not null then p_name := null; end if;$b$),
    -- An account's name, the first time it is seen, and whether one is free.
    ('public.rpc_my_name()'::regprocedure,
     $a$  if v_name is null or not name_ok(v_name) then return null; end if;$a$,
     $b$  if v_name is null or not name_ok(v_name) then return null; end if;
  -- Player text: no new account whose name reads as a keeper or staff (`private.name_refusal`).
  if not exists (select 1 from account a where a.uid = v_uid)
     and private.name_refusal(null, v_uid, v_name) is not null then return null; end if;$b$),
    ('public.rpc_name_free(text)'::regprocedure,
     $a$  if not name_ok(v_name) then return false; end if;$a$,
     $b$  if not name_ok(v_name) then return false; end if;
  if private.name_poses(v_name) then return false; end if;  -- Player text (`private.name_poses`).$b$),
    -- An island's name.
    ('public.rpc_found(text,bigint,integer,integer,integer,integer)'::regprocedure,
     $a$  values (coalesce(nullif(trim(p_name), ''), 'An island'),$a$,
     $b$  values (coalesce(nullif(private.clean_text(p_name, 40), ''), 'An island'),$b$),
    ('public.rpc_found(text,bigint,integer,integer,integer,integer)'::regprocedure,
     $a$  insert into world (name, seed, size, spawn_x, spawn_y, ready, made_by, lasts_until)$a$,
     $b$  -- Player text: an island's name that reads as a keeper or staff (`private.name_refusal`).
  if private.name_refusal(null, me, p_name) is not null then raise exception '%', private.name_reserved_said(); end if;
  insert into world (name, seed, size, spawn_x, spawn_y, ready, made_by, lasts_until)$b$)
  ) v(fn, anchor, repl)
  loop
    def := pg_get_functiondef(r.fn);
    if strpos(def, r.repl) > 0 then continue; end if;
    n := (length(def) - length(replace(def, r.anchor, ''))) / length(r.anchor);
    if n <> 1 then raise exception '%: anchor found % times: %', r.fn, n, left(r.anchor, 80); end if;
    execute replace(def, r.anchor, r.repl);
  end loop;
end $do$;

select private.lock_doors();
