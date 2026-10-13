/*
 * Every liquid but water carries its QL in and out of a barrel
 * (`src/game/ageing.ts`, `keepsQl`).
 *
 * 20261013200100 carried a brew's QL into a bucket drawn off its barrel and
 * back into a barrel it is poured into. This carries every liquid's but
 * water's -- milk, juice, lye and anything added later -- the same way: a
 * bucket drawn off is at the barrel's QL (aged, for a brew that ages), and a
 * bucket poured in puts an empty barrel at its QL and a barrel of the same at
 * the average of the two by litres. Water takes the QL of whatever holds it,
 * as before. Dye carries its QL in its mix, by its own pouring and drawing.
 *
 * The definitions write out which liquids keep their QL (`keeps_ql`, off the
 * browser's `keepsQl`). `supabase/test/aged.ts` holds the two sides to each
 * other.
 */
set local lock_timeout = '3s';
-- The bodies below call what the definitions write out; nothing here runs them.
set check_function_bodies = off;

/* ---- drawn_ql: from 20261013200100_a_bucket_keeps_its_brews_ql.sql. Every liquid but water. ---- */

/** The QL a bucket drawn off a barrel holds at a moment: what the barrel holds, aged or not; null for water, which leaves the bucket its own (`drawnQl`). */
create or replace function drawn_ql(p placed, p_now double precision) returns double precision language plpgsql stable as $fn$
begin
  if not coalesce(keeps_ql(p.liquid), false) then return null; end if;
  return brew_ql(p, p_now);
end $fn$;

/* ---- perform_liquid: from 20261013200100_a_bucket_keeps_its_brews_ql.sql, the newest. Every liquid but water keeps its QL poured. ---- */

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
      -- The QL of anything but water, aged as it is now, goes into the bucket, asked before the draw can empty the barrel (`drawnQl`).
      v_ql := drawn_ql(v_from, extract(epoch from now())::double precision);
      if not draw_from(v_from.id, bucket_litres()) then return; end if;
    elsif near_water(p_world, p_uid) then
      v_kind := 'water';
    else
      return;
    end if;
    select item into v_full from vessel_def where liquid = v_kind limit 1;
    -- What the barrel's brewer put into it goes into the bucket (a Cook's Strong Brew), and the QL of what it holds.
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
    -- Every liquid but water keeps its QL poured: the bucket's into an empty barrel, the average by litres into one of the same (`pouredQl`).
    if keeps_ql(v_kind) then
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
