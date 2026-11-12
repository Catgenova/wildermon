-- Looks for the sculpted bodies: two bodies, the hairstyles there is a mesh for, and the skin, the hair's hue and its
-- brightness as places along a slider.
--
-- Asked for: "revamp the character customization screen for the new models. It will only have the 2 body types, 3
-- hairstyles (2+bald). It needs sliders for hair color and skin tone."
--
-- A look was eight ids out of `look_option`. Now it is five fields (`look_kinds()`): `gender` and `hair` still ids
-- out of `look_option`, and `skin`, `hairColour` (the hair's hue) and `hairBright` numbers from nought to one
-- (`look_tones()`), each turned into a colour by the browser (`src/game/look.ts`: the skin along its ramp, the hair
-- HSL(hue, 60%, 6% to 90% by brightness)), so a free-text colour still never reaches
-- anybody's canvas. `look_clean()` clamps a number to nought to one at three places, and anything that is not a
-- number falls to the field's default (`look_tone_defaults()`).
--
-- A look from before is read through `look_legacy` (the definitions write it, from `legacyLooks()`): an old build or
-- haircut to the nearest there is now, an old skin swatch to the place on its ramp nearest its colour, an old hair
-- colour swatch to the hue and brightness nearest it.
-- Eyes, beards and the two cloths are not part of a look any more, so `look_clean()` leaves them out. Every look kept
-- is cleaned here once, so the rows say what they mean; `rpc_my_look()` and the join clean what they read as well.
--
-- `look_option`'s rows, `look_legacy`'s and the three small functions come from the definitions, stamped by the wall
-- clock; they are made here too (`if not exists`, `create or replace`) so that the two can land in either order.
-- The rows are rewritten only once the legacy table has rows, so a database that has this before the definitions
-- keeps its old ids until the definitions come and the reads clean them.

set local lock_timeout = '3s';

create table if not exists look_legacy (kind text not null, id text not null, becomes jsonb not null, primary key (kind, id));

/** The fields a look has, in the order the creator asks them; those that are numbers; and each number's default. */
create or replace function look_kinds() returns text[] language sql immutable as $fn$
  select array['gender', 'hair', 'skin', 'hairColour', 'hairBright']::text[]
$fn$;
create or replace function look_tones() returns text[] language sql immutable as $fn$
  select array['skin', 'hairColour', 'hairBright']::text[]
$fn$;
create or replace function look_tone_defaults() returns jsonb language sql immutable as $fn$
  select '{"skin": 0.248, "hairColour": 0.083, "hairBright": 0.18}'::jsonb
$fn$;

/**
 * A look from before read as one now: each field holding an old id (not one `look_option` still has) takes what
 * `look_legacy` says it became, in the order of `look_kinds()`. Anything that is not an object is nothing.
 */
create or replace function look_unlegacy(p_look jsonb) returns jsonb language plpgsql stable as $fn$
declare v jsonb; r record;
begin
  if p_look is null or jsonb_typeof(p_look) <> 'object' then return '{}'::jsonb; end if;
  v := p_look;
  for r in
    select l.becomes from unnest(look_kinds()) with ordinality k(kind, n)
      join look_legacy l on l.kind = k.kind and l.id = p_look ->> k.kind
     where jsonb_typeof(p_look -> k.kind) = 'string'
       and not exists (select 1 from look_option o where o.kind = k.kind and o.id = p_look ->> k.kind)
     order by k.n
  loop
    v := v || r.becomes;
  end loop;
  return v;
end $fn$;

/**
 * A look with everything unrecognised replaced.
 *
 * Total, deliberately: it never raises and never returns a partial look. An id field names something in
 * `look_option` or falls to the kind's fallback (and to the first of the list if that is somehow missing too); a
 * number field is a number clamped to nought to one at three places, or its default. The browser does the same in
 * `cleanLook`, which proves nothing; this is the control.
 */
create or replace function look_clean(p_look jsonb) returns jsonb language sql stable as $fn$
  with v as (select look_unlegacy(p_look) as l)
  select coalesce(jsonb_object_agg(k, case
    when k = any(look_tones()) then
      case when jsonb_typeof(v.l -> k) = 'number'
           then to_jsonb(round(least(1, greatest(0, (v.l ->> k)::numeric)), 3))
           else coalesce(look_tone_defaults() -> k, '0'::jsonb) end
    else to_jsonb(coalesce(
      (select o.id from look_option o where o.kind = k and o.id = v.l ->> k),
      (select o.id from look_option o where o.kind = k and o.fallback order by o.ord limit 1),
      (select o.id from look_option o where o.kind = k order by o.ord limit 1)))
    end), '{}'::jsonb)
  from v, unnest(look_kinds()) k
$fn$;

/**
 * Somebody, at random: either body, any hairstyle, any skin, any hair colour (the browser's `randomLook`). From
 * `gen_random_uuid()` rather than `random()`, which the suite seeds (`20260915033000_looks.sql`).
 */
create or replace function look_random() returns jsonb language sql volatile as $fn$
  select look_clean(coalesce(jsonb_object_agg(k, case
    when k = any(look_tones()) then
      to_jsonb(round(('x' || lpad(substr(md5(gen_random_uuid()::text), 1, 8), 16, '0'))::bit(64)::bigint::numeric / 4294967295, 3))
    else to_jsonb((select o.id from look_option o where o.kind = k order by md5(gen_random_uuid()::text) limit 1))
    end), '{}'::jsonb))
  from unnest(look_kinds()) k
$fn$;

/** The face on your account as it is read now, or null if you have not chosen one yet. */
create or replace function rpc_my_look() returns jsonb
  language sql stable security definer set search_path = public as $$
  select case when a.look is null then null else look_clean(a.look) end from account a where a.uid = (select auth.uid())
$$;

/** A face: one field a key, an id or a number (`look_clean` keeps only the fields it has, each cleaned). */
create or replace function private.spec_look() returns jsonb language sql immutable as $fn$ select $j$
{"t": "object", "null": true, "most": 32, "kpat": "^[A-Za-z_]{1,32}$",
 "each": {"or": [{"t": "text", "null": true}, {"t": "num", "min": -1000, "max": 1000}]}}
$j$::jsonb $fn$;
revoke all on function private.spec_look() from public, anon, authenticated;

-- Every look kept, read as one now, once the definitions have said what the old ids became.
update account set look = look_clean(look)
 where look is not null and exists (select 1 from look_legacy) and look is distinct from look_clean(look);
update player set look = look_clean(look)
 where exists (select 1 from look_legacy) and look is distinct from look_clean(look);

select private.lock_doors();
