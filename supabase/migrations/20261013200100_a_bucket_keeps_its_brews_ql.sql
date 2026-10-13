/*
 * A bucket keeps its brew's QL, and mead ages (`src/game/ageing.ts`).
 *
 * The definitions write out which brews age and each one's own rate and cap
 * (`brew_ages`, `age_rate`, `age_cap`, off `BrewDef.ages`): cherry wine and
 * grape wine as before, and mead now too, at its own. What is here:
 *
 *   * `age_gain` in place of `wine_gain`: the QL a brew gains kept so long,
 *     in a cellar or not, at its own rate and up to its own cap -- the
 *     browser's `ageGain`, operation for operation. `brew_ql` and
 *     `wine_age_says` read it, and Examine says each brew's own numbers;
 *   * `drawn_ql`: the QL a bucket drawn off a barrel holds -- a brew's (or
 *     spirit's), aged as it is at that moment, and nothing for anything
 *     else, which leaves the bucket its own (`drawnQl`). `vessel_becomes`
 *     takes it, and `perform_liquid`'s fill puts it in the bucket;
 *   * `poured_ql`: what a barrel of brew is at once a bucket of it is poured
 *     in -- the bucket's QL into an empty barrel, the average of the
 *     barrel's (aged, as it is now) and the bucket's by litres into one of
 *     the same (`pouredQl`). A barrel poured into does not age from then
 *     on: `aged_from` is cleared by the pour, so drawing a brew off and
 *     pouring it back cannot take it past its cap.
 *
 * `supabase/test/aged.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';
-- The bodies below call what the definitions write out; nothing here runs them.
set check_function_bodies = off;

/* ---- the gain, each brew at its own rate and cap ------------------------------------------------------- */

drop function if exists wine_gain(double precision, boolean);

/** The QL a brew that ages has gained, kept so many seconds, in a cellar or not; nothing for one that does not (`ageGain`). */
create or replace function age_gain(p_liquid text, p_age double precision, p_cellar boolean) returns double precision
language plpgsql immutable as $fn$
begin
  if not coalesce(brew_ages(p_liquid), false) or p_age is null or not (p_age > 0) then return 0; end if;
  return least(age_cap(p_liquid), age_rate(p_liquid) * (case when p_cellar then cellar_ageing() else 1 end) * (p_age / day_seconds()));
end $fn$;

/* ---- brew_ql: from 20261013180000_vineyards_and_wine_that_ages.sql. At the brew's own rate and cap. ---- */

/** The QL of what is in a barrel at a moment: what it was brewed at and what it has gained since (`brewQl`). */
create or replace function brew_ql(p placed, p_now double precision) returns double precision language plpgsql stable as $fn$
declare v_age double precision;
begin
  v_age := wine_age(p, p_now);
  if v_age is null then return p.ql; end if;
  return least(100, p.ql + age_gain(p.liquid, v_age, coalesce(p.level, 0) < 0));
end $fn$;

/* ---- wine_age_says: from 20261013180000_vineyards_and_wine_that_ages.sql. Each brew's own rate and cap. ---- */

CREATE OR REPLACE FUNCTION public.wine_age_says(p placed, p_now double precision)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare v_age double precision; v_cellar boolean;
begin
  v_age := wine_age(p, p_now);
  if v_age is null or p_now < p.aged_from then return ''; end if;
  v_cellar := coalesce(p.level, 0) < 0;
  return ' Kept ' || fixed_to(v_age / day_seconds(), 1) || ' days' || case when v_cellar then ' in a cellar' else '' end
    || ', at ' || fixed_to(age_rate(p.liquid) * (case when v_cellar then cellar_ageing() else 1 end), 2) || ' QL a day'
    || case when v_cellar then ' (' || cellar_ageing() || ' × ' || fixed_to(age_rate(p.liquid), 2) || ')' else '' end
    || ' up to +' || fixed_to(age_cap(p.liquid), 2) || ': +' || fixed_to(age_gain(p.liquid, v_age, v_cellar), 2) || ' QL, so the '
    || (select l.name from liquid_def l where l.id = p.liquid) || ' in it is QL ' || fixed_to(brew_ql(p, p_now), 2) || '.';
end $function$;

/* ---- what a bucket drawn holds, and what a barrel poured into is at ------------------------------------ */

/** The QL a bucket drawn off a barrel holds at a moment: a brew's, aged or not; null for anything else, which leaves the bucket its own (`drawnQl`). */
create or replace function drawn_ql(p placed, p_now double precision) returns double precision language plpgsql stable as $fn$
begin
  if not coalesce((select l.brew from liquid_def l where l.id = p.liquid), false) then return null; end if;
  return brew_ql(p, p_now);
end $fn$;

/**
 * What a barrel of brew is at once a bucket of it at `p_ql` is poured in: the
 * bucket's QL into an empty barrel, and the average of the barrel's (aged, as
 * it is now) and the bucket's by litres into one that holds some (`pouredQl`).
 */
create or replace function poured_ql(p placed, p_now double precision, p_poured double precision, p_ql double precision)
returns double precision language plpgsql stable as $fn$
declare v_had double precision := coalesce(p.litres, 0);
begin
  if not (v_had > 0) then return p_ql; end if;
  return (v_had * brew_ql(p, p_now) + p_poured * p_ql) / (v_had + p_poured);
end $fn$;

/* ---- vessel_becomes: from 20261010020350_dye_is_mixed_by_pouring.sql, the newest. With the QL of what it now holds. ---- */

drop function if exists vessel_becomes(bigint, text, double precision);
CREATE OR REPLACE FUNCTION public.vessel_becomes(p_id bigint, p_def text, p_knack double precision DEFAULT NULL::double precision,
                                                 p_ql double precision DEFAULT NULL::double precision)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
declare it item; v_mark jsonb;
begin
  if p_def is null then return false; end if;
  select * into it from item where id = p_id for update;
  if not found or it.count < 1 then return false; end if;
  -- The knack of what it holds goes with what it holds, and out with it (a
  -- Cook's Strong Brew). The rest of its mark is the vessel's and stays.
  v_mark := nullif(coalesce(it.mark, '{}'::jsonb) - 'knack'
    || case when p_knack is not null and p_knack <> 1 then jsonb_build_object('knack', p_knack) else '{}'::jsonb end,
    '{}'::jsonb);
  if it.count = 1 then
    update item set def = p_def, charges = (select charges from item_def where id = p_def), mark = v_mark,
        -- And the dye in a bucket of dye goes out with it.
        dye = case when p_def = 'dye_bucket' then dye end,
        -- And a brew drawn into it is at the brew's QL (`drawnQl`).
        ql = coalesce(p_ql, ql)
      where id = p_id;
    return true;
  end if;
  update item set count = count - 1 where id = p_id;
  insert into item (world_id, holder, holder_uid, gx, gy, inside, def, ql, dmg, count, extra, rare,
                    dye, bless, charges, locked, issued, made_at, crate, lit, lit_at, placed, rot_at, maker, piece, mark)
  values (it.world_id, it.holder, it.holder_uid, it.gx, it.gy, it.inside, p_def, coalesce(p_ql, it.ql), it.dmg, 1, it.extra, it.rare,
          case when p_def = 'dye_bucket' then it.dye end, it.bless, (select charges from item_def where id = p_def), it.locked, it.issued, it.made_at,
          it.crate, it.lit, it.lit_at, it.placed, it.rot_at, it.maker, it.piece, v_mark);
  return true;
end $function$;

/* ---- perform_liquid: from 20261013180000_vineyards_and_wine_that_ages.sql, the newest. A brew's QL drawn into the bucket and poured back. ---- */

CREATE OR REPLACE FUNCTION public.perform_liquid(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare it item; p placed; v_kind text; v_from placed; v_full text; v_room double precision;
        v_poured double precision; v_favour text; v_full_msg text; v_thirst double precision;
        v_dye dye_mix; v_mixed dye_mix; v_had double precision; v_n int; v_aged double precision; v_ql double precision;
begin
  if p_action in ('fill_bucket', 'fill_skin', 'empty_bucket', 'pour_into_barrel') then
    it := carried(p_world, p_uid, target_item(p_target));
    if it.id is null then return; end if;
  else
    select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
  end if;

  if p_action = 'fill_bucket' then
    -- A bucket of dye tops up from dye beside you (`dyeSourceFor`).
    if it.def = 'dye_bucket' then
      select * into v_from from vessels_near(p_world, p_uid, 'dye') v limit 1;
      if v_from.id is not null then perform draw_dye(p_world, p_uid, v_from, it); end if;
      return;
    end if;
    -- A barrel beside you first, and the shore only if there is none; dye however little there is of it.
    select * into v_from from vessels_near(p_world, p_uid) v
      where placed_litres(v) >= bucket_litres() or (placed_liquid(v) = 'dye' and placed_litres(v) >= 1) limit 1;
    if found and placed_liquid(v_from) = 'dye' then
      perform draw_dye(p_world, p_uid, v_from, it);
      return;
    end if;
    if found then
      v_kind := placed_liquid(v_from);
      -- A brew's QL, aged as it is now, goes into the bucket, asked before the draw can empty the barrel (`drawnQl`).
      v_ql := drawn_ql(v_from, extract(epoch from now())::double precision);
      if not draw_from(v_from.id, bucket_litres()) then return; end if;
    elsif near_water(p_world, p_uid) then
      v_kind := 'water';
    else
      return;
    end if;
    select item into v_full from vessel_def where liquid = v_kind limit 1;
    -- What the barrel's brewer put into it goes into the bucket (a Cook's Strong Brew), and a brew's QL.
    if not vessel_becomes(it.id, v_full, v_from.knack, v_ql) then return; end if;
    perform tell(p_world, p_uid, case when v_from.id is not null
      then 'You draw a bucket of ' || (select name from liquid_def where id = v_kind)
           || ' out of the ' || lower(placed_name(v_from)) || '.'
      else 'You dip the bucket full of water.' end, 'event');

  elsif p_action = 'fill_skin' then
    update item set charges = (select charges from item_def where id = it.def) where id = it.id;
    perform tell(p_world, p_uid, 'You fill the '
      || lower((select name from item_def where id = it.def)) || ' with water.', 'event');

  elsif p_action = 'empty_bucket' then
    select empty into v_full from vessel_def where item = it.def;
    if v_full is null then return; end if;
    if not vessel_becomes(it.id, v_full) then return; end if;
    perform tell(p_world, p_uid, 'You tip the '
      || lower((select name from item_def where id = it.def)) || ' out.', 'event');

  elsif p_action = 'pour_into_barrel' then
    select liquid into v_kind from vessel_def where item = it.def;
    v_from := barrel_for(p_world, p_uid, v_kind);
    if v_from.id is null then return; end if;
    v_room := liquid_capacity(v_from) - placed_litres(v_from);
    -- Dye: as much of the bucket as there is room for, mixed into what is there; the rest stays in the bucket.
    v_dye := dye_in(it);
    if v_dye is not null then
      v_n := least(v_dye.litres, floor(v_room))::int;
      if v_n <= 0 then return; end if;
      v_had := placed_litres(v_from);
      v_mixed := case when placed_dye(v_from) is not null and v_had > 0 then dye_mixed(placed_dye(v_from), v_had, v_dye, v_n)
                      else v_dye end;
      if v_dye.litres - v_n <= 0 then
        if not vessel_becomes(it.id, 'bucket') then return; end if;
      else
        update item set dye = dye_text(v_dye, v_dye.litres - v_n) where id = it.id;
      end if;
      update placed set litres = v_had + v_n, liquid = 'dye', dye = dye_text(v_mixed), knack = null, since = now()
        where id = v_from.id;
      perform tell(p_world, p_uid, 'You pour ' || litres_word(v_n) || ' of dye into the '
        || lower(placed_name(v_from)) || '. It holds ' || dye_says(v_mixed, v_had + v_n), 'event');
      return;
    end if;
    v_poured := least(bucket_litres(), v_room);
    if v_poured <= 0 then return; end if;
    -- A brew keeps its QL poured: the bucket's into an empty barrel, the average by litres into one of the same (`pouredQl`).
    if coalesce((select brew from liquid_def where id = v_kind), false) then
      v_ql := poured_ql(v_from, extract(epoch from now())::double precision, v_poured, it.ql);
    end if;
    if not vessel_becomes(it.id, (select empty from vessel_def where item = it.def)) then return; end if;
    update placed set litres = placed_litres(v_from) + v_poured, liquid = v_kind, since = now(),
        ql = coalesce(v_ql, ql),
        -- And a barrel poured into does not age: what went in was kept somewhere else (`ageing.ts`).
        aged_from = null,
        -- What is poured in is only as good as the worst of what it goes into
        -- (a Cook's Strong Brew): nothing plain is made better by the barrel.
        knack = nullif(case when placed_litres(v_from) > 0 then least(coalesce(v_from.knack, 1), mark_of(it.mark, 'knack'))
                            else mark_of(it.mark, 'knack') end, 1)
      where id = v_from.id;
    perform tell(p_world, p_uid, 'You pour ' || to_char(v_poured, 'FM990') || ' litres of '
      || (select name from liquid_def where id = v_kind) || ' into the '
      || lower(placed_name(v_from)) || '. '
      || to_char(placed_litres(v_from) + v_poured, 'FM990') || ' of '
      || to_char(liquid_capacity(v_from), 'FM990') || '.', 'event');

  elsif p_action = 'empty_vessel' then
    v_kind := coalesce((select name from liquid_def where id = placed_liquid(p)), 'it');
    update placed set litres = 0, liquid = null, knack = null, dye = null, since = now() where id = p.id;
    perform tell(p_world, p_uid, 'You tip the ' || v_kind || ' out of the '
      || lower(placed_name(p)) || '.', 'event');

  elsif p_action = 'examine_vessel' then
    perform tell(p_world, p_uid, vessel_says(p), 'event');

  elsif p_action = 'drink_from_vessel' then
    -- A wine at the QL its keeping has brought it to, asked before the drink empties it (`brewQl`).
    v_aged := brew_ql(p, extract(epoch from now())::double precision);
    if not draw_from(p.id, 1) then return; end if;
    v_thirst := coalesce((select (stats->>'thirst')::double precision from player
                          where world_id = p_world and uid = p_uid), 1);
    update player set stats = jsonb_set(stats, '{thirst}', to_jsonb(least(1, v_thirst + 0.5)))
      where world_id = p_world and uid = p_uid;
    -- A brew straight out of the barrel favours a trade like any other.
    if coalesce((select brew from liquid_def where id = placed_liquid(p)), false) then
      select item into v_full from vessel_def where liquid = placed_liquid(p) limit 1;
      -- And for longer for its brewer's hand in it (a Cook's Strong Brew).
      v_favour := grant_boon(p_world, p_uid, v_full, v_aged, coalesce(p.knack, 1));
      v_full_msg := nourish(p_world, p_uid, v_full, v_aged);
    end if;
    perform tell(p_world, p_uid, 'You drink your fill from the ' || lower(placed_name(p)) || '.'
      || coalesce(' ' || v_favour, '') || coalesce(' ' || v_full_msg, ''), 'event');
  end if;
end $function$;

reset check_function_bodies;
select private.lock_doors();
