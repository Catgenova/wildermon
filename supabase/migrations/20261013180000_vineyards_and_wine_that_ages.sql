/*
 * Vineyards, and wine that ages (`src/game/vineyard.ts`, `src/game/ageing.ts`).
 *
 * The definitions crossed the trellis, the grape, the grape cutting, the
 * bucket of grape wine and its brew, the three jobs (`vine_action`) and
 * every number and sentence: `grape_season`, `vine_bears`, `vine_rest`,
 * `grapes_a_pick`, `grapes_base`, `grapes_span`, `vine_soil`, `vine_said`,
 * `vine_season_words`, `vine_planted_said`, `brew_ages`, `wine_age_rate`,
 * `wine_age_cap` and `cellar_ageing`. What is here is the doing of it.
 *
 * ## A vine on a trellis
 *
 *   * `placed.vine_at` and `placed.picked_at`: the moment a vine was planted
 *     at a trellis's foot and the moment it was last picked, in epoch
 *     seconds. The ground read carries every column of a placed row, so both
 *     reach the browser as they are (`vineAt`, `pickedAt`). Picking a trellis
 *     up takes its row and its vine with it;
 *   * `vine_stage`: none, young (`vine_bears` days), waiting for its season
 *     (`grape_season`), picked and resting (`vine_rest` days), or ripe -- the
 *     browser's `vineStage`, read off `vine_now()`;
 *   * Cut a grape cutting (`cut_vine`), off a thorn bush with a sickle, once a
 *     forage cooldown (`is_foraged`, kind 'vine'); Plant a grape cutting
 *     (`plant_vine`), on a trellis standing on the ground on soil
 *     (`vine_soil`); Pick grapes (`pick_grapes`), `grapes_for` of them at
 *     the picker's forestry, refused out of season with when it fruits
 *     (`vine_season_said`). Every refusal in the browser's words and order
 *     (`vine_refusal`, `perform_vine`).
 *
 * ## Wine that ages
 *
 *   * `placed.aged_from`: the moment the brew in a barrel stops working, in
 *     epoch seconds, for a brew that ages (`brew_ages`). It is stamped when a
 *     brew is set going -- water becoming a brew, `since` and `ferment` --
 *     and cleared whenever the barrel's liquid changes otherwise: emptied,
 *     drawn dry, or filled from a bucket into a barrel that held something
 *     else. One trigger on `placed` does it (`placed_aged_from`), so the
 *     brewing, the pouring and the drawing are left as they were;
 *   * `wine_gain`, `wine_age`, `brew_ql`: the QL it has gained, kept so long,
 *     in a cellar or not, and the QL it is at -- the browser's `wineGain`,
 *     `wineAge` and `brewQl`, operation for operation;
 *   * Examine on a barrel says how long it has been kept and what it has
 *     gained (`wine_age_says`, in `vessel_says`), and a drink straight from
 *     the barrel is at that QL (`perform_liquid`).
 *
 * `supabase/test/vineyard.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';
-- The bodies below call what the definitions write out; nothing here runs them.
set check_function_bodies = off;

alter table placed add column if not exists aged_from double precision;
alter table placed add column if not exists vine_at double precision;
alter table placed add column if not exists picked_at double precision;

/* ---- the clock a vine is read at ---------------------------------------------------------------------- */

/**
 * The moment vines are read at, in epoch seconds: now, or the moment a test
 * holds them at (`wurm.vine_now`). Nothing on the island sets it.
 */
create or replace function vine_now() returns double precision language plpgsql stable as $fn$
begin
  return coalesce(nullif(current_setting('wurm.vine_now', true), '')::double precision,
                  extract(epoch from now())::double precision);
end $fn$;

/** Seconds from a moment until `grape_season()` next begins; nought in it (`untilGrapes`). */
create or replace function until_grapes(p_now double precision) returns double precision language plpgsql stable as $fn$
declare v_season text; v_n int; v_k int;
begin
  v_season := season_at(to_timestamp(p_now));
  if v_season = grape_season() then return 0; end if;
  v_n := array_length(seasons(), 1);
  v_k := mod(array_position(seasons(), grape_season()) - array_position(seasons(), v_season) + v_n, v_n);
  return extract(epoch from season_began(to_timestamp(p_now)))::double precision
    + v_k * season_days() * day_seconds() - p_now;
end $fn$;

/** How the vine on a trellis stands at a moment: none, young, waiting, picked or ripe (`vineStage`). */
create or replace function vine_stage(p placed, p_now double precision) returns text language plpgsql stable as $fn$
begin
  if p.vine_at is null then return 'none'; end if;
  if p_now - p.vine_at < vine_bears() * day_seconds() then return 'young'; end if;
  if season_at(to_timestamp(p_now)) <> grape_season() then return 'waiting'; end if;
  if p.picked_at is not null and p_now - p.picked_at < vine_rest() * day_seconds() then return 'picked'; end if;
  return 'ripe';
end $fn$;

/** Grapes a pick gives at this forestry (`grapesFor`). */
create or replace function grapes_for(p_skill double precision) returns int language plpgsql immutable as $fn$
begin
  return greatest(1, floor(grapes_a_pick() * (grapes_base() + p_skill / grapes_span()) + 0.5)::int);
end $fn$;

/** Whether a tile is a thorn bush, which a wild vine grows through. */
create or replace function wild_vine_at(p_world uuid, p_x int, p_y int) returns boolean language plpgsql stable as $fn$
begin
  return coalesce(land_tile(p_world, p_x, p_y) = tile_id('Bush')
    and (select b.name from bush_def b where b.id = bush_species(land_data(p_world, p_x, p_y))) = wild_vine(), false);
end $fn$;

/* ---- the words ------------------------------------------------------------------------------------------ */

/**
 * A number to so many places, rounded half up off the number itself first, so
 * that a tie falls the same way here and in the browser (`fixedTo`).
 */
create or replace function fixed_to(p_x double precision, p_d int) returns text language sql immutable as $fn$
  select to_char(floor(p_x * 10 ^ p_d + 0.5) / 10 ^ p_d, 'FM999999990' || case when p_d > 0 then '.' || repeat('0', p_d) else '' end)
$fn$;

/** Why a vine gives nothing out of season, and when it fruits (`vineSeasonSaid`). */
create or replace function vine_season_said(p_now double precision) returns text language plpgsql stable as $fn$
begin
  return vine_season_words(season_at(to_timestamp(p_now)), time_words(until_grapes(p_now)));
end $fn$;

/** What a pick says (`grapesSaid`). */
create or replace function grapes_said(p_n int, p_ql double precision) returns text language plpgsql stable as $fn$
begin
  return 'You pick ' || p_n || ' ' || lower((select d.name from item_def d where d.id = grape_item()))
    || case when p_n = 1 then '' else 's' end || ' off the vine. (QL ' || fixed_to(p_ql, 1) || ')';
end $fn$;

/** What a cutting says (`cutVineSaid`). */
create or replace function cut_vine_said(p_ql double precision) returns text language plpgsql stable as $fn$
begin
  return 'You cut a ' || lower((select d.name from item_def d where d.id = grape_cutting_item()))
    || ' off the wild vine in the ' || lower(wild_vine()) || '. (QL ' || fixed_to(p_ql, 1) || ')';
end $fn$;

/* ---- the three jobs ----------------------------------------------------------------------------------- */

/**
 * Why a vine cannot be cut, planted or picked now, or null: the browser's
 * `vineRefusal`, question for question. A thorn bush answers for its own
 * reach, as a tile does; a trellis for its own, as a piece does.
 */
create or replace function vine_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare pl placed; pr player; v_x int; v_y int; v_now double precision; v_stage text;
begin
  if p_action = 'cut_vine' then
    v_x := nullif(p_target->>'x', '')::int;
    v_y := nullif(p_target->>'y', '')::int;
    if coalesce(p_target->>'kind', '') <> 'tile' or v_x is null or v_y is null or not wild_vine_at(p_world, v_x, v_y) then
      return vine_said('noWild');
    end if;
    select * into pr from player where world_id = p_world and uid = p_uid;
    if not in_reach(pr.x, pr.y, p_target, false, null) then return 'You are too far away from that.'; end if;
    if is_foraged(p_world, v_x, v_y, 'vine') then return vine_said('cut'); end if;
    if not exists (select 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                     and i.def = cutting_tool()) then
      return vine_said('noTool');
    end if;
    return null;
  end if;
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint
    and kind = 'furniture' and sub = vine_kind();
  if not found then return 'It is gone.'; end if;
  if not placed_in_reach(p_world, p_uid, pl.id) then
    return lamp_too_far_said(lower((select f.name from furniture_def f where f.id = pl.sub)));
  end if;
  v_now := vine_now();
  if p_action = 'plant_vine' then
    if pl.vine_at is not null then return vine_said('has'); end if;
    if coalesce(pl.level, 0) <> 0 or not vine_soil(land_tile(p_world, pl.x::int, pl.y::int)) then return vine_said('soil'); end if;
    if not exists (select 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                     and i.def = grape_cutting_item()) then
      return vine_said('noCutting');
    end if;
    return null;
  end if;
  v_stage := vine_stage(pl, v_now);
  if v_stage = 'none' then return vine_said('none'); end if;
  if v_stage = 'young' then return vine_said('young'); end if;
  if v_stage = 'waiting' then return vine_season_said(v_now); end if;
  if v_stage = 'picked' then return vine_said('picked'); end if;
  return null;
end $fn$;

create or replace function perform_vine(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
declare pl placed; v_x int; v_y int; v_ql double precision; v_skill double precision; v_n int; v_cut item;
begin
  if p_action = 'cut_vine' then
    if vine_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
    v_x := (p_target->>'x')::int;
    v_y := (p_target->>'y')::int;
    v_ql := product_ql(skill_of(p_world, p_uid, vine_skill()), tool_ql(p_world, p_uid, cutting_tool()));
    perform gather(p_world, p_uid, grape_cutting_item(), 1, v_ql);
    perform mark_foraged(p_world, v_x, v_y, 'vine');
    perform skill_raise(p_world, p_uid, vine_skill(), vine_gain());
    perform tell(p_world, p_uid, cut_vine_said(v_ql), 'event');
    return;
  end if;
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint
    and kind = 'furniture' and sub = vine_kind() for update;
  if not found then return; end if;
  -- Asked again as it is done: a vine picked a moment ago is not picked twice (`vineRefusal`, asked by `perform`).
  if vine_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
  if p_action = 'plant_vine' then
    select * into v_cut from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
      and i.def = grape_cutting_item() and not coalesce(i.locked, false) order by i.id limit 1;
    if not found then
      select * into v_cut from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
        and i.def = grape_cutting_item() order by i.id limit 1;
    end if;
    if v_cut.id is null or not consume(p_world, p_uid, grape_cutting_item(), 1, v_cut.id) then return; end if;
    update placed set vine_at = vine_now(), picked_at = null where id = pl.id;
    perform skill_raise(p_world, p_uid, vine_skill(), vine_gain());
    perform tell(p_world, p_uid, vine_planted_said(), 'event');
    perform land_announce(p_world, pl.x::int, pl.y::int);
    return;
  end if;
  -- Pick grapes: so many at this forestry, at a fruit tree's quality, and the vine rests.
  v_skill := skill_of(p_world, p_uid, vine_skill());
  v_n := grapes_for(v_skill);
  v_ql := product_ql(v_skill);
  perform gather(p_world, p_uid, grape_item(), v_n, v_ql);
  update placed set picked_at = vine_now() where id = pl.id;
  perform skill_raise(p_world, p_uid, vine_skill(), vine_gain());
  perform tell(p_world, p_uid, grapes_said(v_n, v_ql), 'event');
  perform land_announce(p_world, pl.x::int, pl.y::int);
end $fn$;

/* ---- wine that ages ------------------------------------------------------------------------------------- */

/**
 * The moment the brew in a barrel stops working, stamped as it is set going
 * and cleared whenever what is in it changes otherwise (`agedFrom`). A brew
 * is set going in water, so water becoming a brew that ages, with its
 * working ahead of it, is the one change that stamps it.
 */
create or replace function placed_aged_from() returns trigger language plpgsql as $fn$
begin
  if new.liquid is distinct from old.liquid then
    new.aged_from := case when old.liquid = 'water' and brew_ages(new.liquid) and coalesce(new.ferment, 0) > 0
                          then extract(epoch from new.since)::double precision + new.ferment end;
  end if;
  return new;
end $fn$;
drop trigger if exists placed_aged_from on placed;
create trigger placed_aged_from before update of liquid on placed
  for each row execute function placed_aged_from();

/** The QL a brew that ages has gained, kept so many seconds, in a cellar or not (`wineGain`). */
create or replace function wine_gain(p_age double precision, p_cellar boolean) returns double precision
language plpgsql immutable as $fn$
begin
  if p_age is null or not (p_age > 0) then return 0; end if;
  return least(wine_age_cap(), wine_age_rate() * (case when p_cellar then cellar_ageing() else 1 end) * (p_age / day_seconds()));
end $fn$;

/** Seconds the brew in a barrel has been kept since it stopped working, at a moment; null for one that does not age (`wineAge`). */
create or replace function wine_age(p placed, p_now double precision) returns double precision language plpgsql stable as $fn$
begin
  if not coalesce(brew_ages(p.liquid), false) or p.aged_from is null or coalesce(p.litres, 0) <= 0 then return null; end if;
  return greatest(0, p_now - p.aged_from);
end $fn$;

/** The QL of what is in a barrel at a moment: what it was brewed at and what it has gained since (`brewQl`). */
create or replace function brew_ql(p placed, p_now double precision) returns double precision language plpgsql stable as $fn$
declare v_age double precision;
begin
  v_age := wine_age(p, p_now);
  if v_age is null then return p.ql; end if;
  return least(100, p.ql + wine_gain(v_age, coalesce(p.level, 0) < 0));
end $fn$;

/** What Examine adds of a barrel of wine: kept how long and where, gained what at what rate, and the QL it is at (`wineAgeSays`). */
create or replace function wine_age_says(p placed, p_now double precision) returns text language plpgsql stable as $fn$
declare v_age double precision; v_cellar boolean;
begin
  v_age := wine_age(p, p_now);
  if v_age is null or p_now < p.aged_from then return ''; end if;
  v_cellar := coalesce(p.level, 0) < 0;
  return ' Kept ' || fixed_to(v_age / day_seconds(), 1) || ' days' || case when v_cellar then ' in a cellar' else '' end
    || ', at ' || fixed_to(wine_age_rate() * (case when v_cellar then cellar_ageing() else 1 end), 2) || ' QL a day'
    || case when v_cellar then ' (' || cellar_ageing() || ' × ' || fixed_to(wine_age_rate(), 2) || ')' else '' end
    || ' up to +' || fixed_to(wine_age_cap(), 2) || ': +' || fixed_to(wine_gain(v_age, v_cellar), 2) || ' QL, so the '
    || (select l.name from liquid_def l where l.id = p.liquid) || ' in it is QL ' || fixed_to(brew_ql(p, p_now), 2) || '.';
end $fn$;

/* ---- vessel_says: from 20261010020350_dye_is_mixed_by_pouring.sql, the newest that defines it. With a wine's age. ---- */

CREATE OR REPLACE FUNCTION public.vessel_says(p placed)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select placed_name(p) || ': QL ' || to_char(p.ql, 'FM990.00') || ', '
      || round(placed_litres(p))::bigint || ' of ' || round(liquid_capacity(p))::bigint || ' litres. '
      || case when placed_litres(p) <= 0 or placed_liquid(p) is null then 'It is empty.'
              when placed_dye(p) is not null then 'It holds ' || dye_says(placed_dye(p), placed_litres(p))
              else 'It holds ' || round(placed_litres(p))::bigint || ' litres of '
                   || (select name from liquid_def where id = placed_liquid(p)) || '.' end
      -- And a wine kept in it: how long and where, and what it has gained (`wineAgeSays`).
      || wine_age_says(p, extract(epoch from now())::double precision)
$function$;

/* ---- perform_liquid: from 20261010020350_dye_is_mixed_by_pouring.sql, the newest. A drink from the barrel at its aged QL. ---- */

CREATE OR REPLACE FUNCTION public.perform_liquid(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare it item; p placed; v_kind text; v_from placed; v_full text; v_room double precision;
        v_poured double precision; v_favour text; v_full_msg text; v_thirst double precision;
        v_dye dye_mix; v_mixed dye_mix; v_had double precision; v_n int; v_aged double precision;
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
      if not draw_from(v_from.id, bucket_litres()) then return; end if;
    elsif near_water(p_world, p_uid) then
      v_kind := 'water';
    else
      return;
    end if;
    select item into v_full from vessel_def where liquid = v_kind limit 1;
    -- What the barrel's brewer put into it goes into the bucket (a Cook's Strong Brew).
    if not vessel_becomes(it.id, v_full, v_from.knack) then return; end if;
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
    if not vessel_becomes(it.id, (select empty from vessel_def where item = it.def)) then return; end if;
    update placed set litres = placed_litres(v_from) + v_poured, liquid = v_kind, since = now(),
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

/* ---- last_action: from 20261011060546_memorial_stones.sql, the newest that defines it. With a vine's jobs. ---- */

CREATE OR REPLACE FUNCTION public.last_action(p_action text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select p_action in ('plan_bridge', 'build_bridge', 'demolish_bridge',
                      'ring_bell', 'sleep', 'set_home', 'pair_creature', 'read_blood',
                      'dye_item', 'strip_dye', 'start_brew', 'set_bauble', 'sacrifice', 'absorb_mote')
      -- Enchant: a scroll into a melee weapon (`enchanting.ts`).
      or p_action = enchant_action()
      -- A memorial stone's two: cutting a line into it, and reading it (`memorial.ts`).
      or memorial_action(p_action)
      -- A vine's three: a cutting off a thorn bush, planting it on a trellis, and picking it (`vineyard.ts`).
      or vine_action(p_action)
      -- A skep's two: emptying it of its honey, and looking into it (`bees.ts`).
      or bee_action(p_action)
$function$;

/* ---- last_refusal: from 20261013003000_ranks_of_your_own.sql, the newest that defines it. With a vine's jobs. ---- */

CREATE OR REPLACE FUNCTION public.last_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare v_rank text; p player; pc placed; b bridge; d bridge_def; s bridge_span; c creature; mate creature;
        it item; dye item; bd brew_def; v_kind text; v_short text;
begin
  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action = 'set_bauble' then
    return bauble_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = 'sacrifice' then
    return sacrifice_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = 'absorb_mote' then
    return absorb_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = enchant_action() then
    return enchant_refusal(p_world, p_uid, p_target);
  end if;
  if memorial_action(p_action) then
    return memorial_refusal(p_world, p_uid, p_action, p_target);
  end if;
  if vine_action(p_action) then
    return vine_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- A skep's two: emptying it of its honey, and looking into it (`bees.ts`).
  if bee_action(p_action) then
    return skep_refusal(p_world, p_uid, p_action, p_target);
  end if;

  if p_action = 'plan_bridge' then
    v_kind := coalesce(p_target->>'material', 'rope');
    return bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
      (p_target->>'x')::int, (p_target->>'y')::int);

  elsif p_action in ('build_bridge', 'demolish_bridge') then
    select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return 'It is gone.'; end if;
    select * into d from bridge_def where id = b.kind;
    if p_action = 'build_bridge' then
      select * into s from bridge_span sp where sp.world_id = p_world and sp.bridge = b.id
        and not span_done(sp.needed) order by sp.n limit 1;
      if not found then return 'It is finished.'; end if;
      if tool_ql(p_world, p_uid, d.tool) <= 0 then
        return 'You need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || '.';
      end if;
      if sqrt((s.x + 0.5 - p.x) ^ 2 + (s.y + 0.5 - p.y) ^ 2) > 4.5 then
        return 'Work from one end. Walk to the open part of the span.';
      end if;
      select e.key into v_short from jsonb_each(s.needed) e
        where (e.value)::int > 0 and pack_count(p_world, p_uid, e.key) < 1 order by e.key limit 1;
      if v_short is not null then
        return 'That span wants ' || span_wants(s.needed) || '; you are carrying no '
          || lower((select coalesce(name, v_short) from item_def where id = v_short)) || '.';
      end if;
    else
      -- gates: the far end's row, quoted: a record's field named by a reserved word is not found unquoted, so
      -- this refused nothing and raised "record b has no field by" instead, and nobody could pull a bridge down;
      -- and the reach, written once (`bridge_pull_reach`, `PULL_REACH`).
      if sqrt((b.ax + 0.5 - p.x) ^ 2 + (b.ay + 0.5 - p.y) ^ 2) > bridge_pull_reach()
         and sqrt((b.bx + 0.5 - p.x) ^ 2 + (b."by" + 0.5 - p.y) ^ 2) > bridge_pull_reach() then
        return 'Stand at one end of it.';
      end if;
      -- gates: where either end stands on a settlement, only its builders pull a bridge down, as only they take
      -- down a building's wall there (`may_shape`); anywhere else anybody may (`pullDownRefusal`).
      select dd.name, rank_lacks(p_world, dd.founded_by, p_uid, 'shape') into v_short, v_rank
        from (values (1, b.ax, b.ay), (2, b.bx, b."by")) v(o, x, y)
        cross join lateral deed_covering(p_world, v.x, v.y) dd
       where not may_shape(p_world, p_uid, v.x, v.y)
       order by v.o, dd.founded_at limit 1;
      if v_short is not null then
        return coalesce(v_rank, 'That is part of ' || v_short || '. Only its builders may '
            || lower((select a.label from action_def a where a.id = p_action)) || ' there.');
      end if;
      -- gates: a padlock on a drawbridge's winch keeps it from being pulled down as from being worked.
      v_short := lock_refusal(p_world, p_uid, b.lock, b.ax, b.ay);
      if v_short is not null then return v_short; end if;
    end if;
    return null;

  elsif p_action = 'ring_bell' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    if not found or not coalesce((select f.bell from furniture_def f where f.id = pc.sub), false) then
      return 'That is not a bell.';
    end if;
    if not near_piece(p_world, p_uid, pc) then return 'Stand next to it.'; end if;
    if not on_my_deed(p_world, p_uid, pc.x, pc.y) then
      return 'Ring it on a settlement of yours; a bell in the wild calls nobody.';
    end if;
    return null;

  elsif p_action in ('sleep', 'set_home') then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    if not found or not is_bed(pc) then return 'That is not a bed.'; end if;
    if not near_piece(p_world, p_uid, pc) then return 'Stand next to it.'; end if;
    if p_action = 'sleep' and not is_night(p_world) then
      return 'It is ' || world_clock(p_world) || ' and broad daylight. Sleep when it is dark.';
    end if;
    if p_action = 'set_home' and p.home_x = pc.x and p.home_y = pc.y then
      return 'You already wake up here.';
    end if;
    return null;

  elsif p_action in ('pair_creature', 'read_blood') then
    perform creature_settle(p_world, (p_target->>'id')::int);
    perform herd_settle(p_world);
    c := target_creature(p_world, p_target);
    if c.world_id is null then return 'It is gone.'; end if;
    if p_action = 'read_blood' then return null; end if;
    if (my_deed(p_world, p_uid)).world_id is null then
      return 'Breeding is settled work. Found a settlement first: the young one goes to the token.';
    end if;
    if not creature_in_reach(p_world, p_uid, c, 2.4) then return 'Stand next to ' || c.name || '.'; end if;
    if c.due is not null then return c.name || ' is already in young.'; end if;
    mate := mate_for(p_world, c);
    if mate.id is null then
      return 'There is no ' || lower((select name from species_def where id = c.species))
        || ' of the other sex within ' || round(pair_range()) || ' tiles. ' || c.name
        || ' is ' || c.sex || '.';
    end if;
    return pair_refuses(p_world, c, mate);

  elsif p_action in ('dye_item', 'strip_dye') then
    select * into it from item where world_id = p_world and id = target_item(p_target)
      and holder = 'player' and holder_uid = p_uid;
    if p_action = 'dye_item' then
      if not found then return 'It is gone.'; end if;
      if not takes_dye(it.def) then return 'Nothing will take on that.'; end if;
      -- Out of the bucket or barrel chosen (`dyeFrom`), or the only one that holds enough (`dyeReason`).
      return dye_reason(p_world, p_uid, dye_litres_for(it.def), p_target, it.dye);
    else
      if not found or it.dye is null or not takes_dye(it.def) then return 'It has taken no colour.'; end if;
      if pack_count(p_world, p_uid, 'lye_bucket') <= 0 then
        return 'You need a bucket of lye to strip it.';
      end if;
    end if;
    return null;

  elsif p_action = 'start_brew' then
    select * into bd from brew_def where id = p_target->>'brew';
    if not found then return 'Choose what to brew.'; end if;
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    return brew_reason(p_world, p_uid, pc, bd);
  end if;
  return null;
end $function$;

/* ---- perform_last: from 20261011060546_memorial_stones.sql, the newest that defines it. With a vine's jobs. ---- */

CREATE OR REPLACE FUNCTION public.perform_last(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_took boolean; p player; pc placed; b bridge; d bridge_def; s bridge_span; c creature; mate creature;
        dam creature; sire creature; it item; dye item; bd brew_def; dd dye_def; v_from text;
        v_kind text; v_id bigint; v_h int; v_n int; v_left int; v_want text; v_back jsonb;
        v_parts text[]; v_half int; e record; r record; v_skill double precision;
        v_care double precision; v_one bigint; v_stock item; v_ql double precision;
begin
  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action = 'set_bauble' then
    perform perform_bauble(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'sacrifice' then
    perform perform_sacrifice(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'absorb_mote' then
    perform perform_absorb(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = enchant_action() then
    perform perform_enchant(p_world, p_uid, p_target);
    return;
  end if;
  if memorial_action(p_action) then
    perform perform_memorial(p_world, p_uid, p_action, p_target);
    return;
  end if;
  if vine_action(p_action) then
    perform perform_vine(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- A skep's two: emptying it of its honey, and looking into it (`bees.ts`).
  if bee_action(p_action) then
    perform perform_skep(p_world, p_uid, p_action, p_target);
    return;
  end if;

  if p_action = 'plan_bridge' then
    v_kind := coalesce(p_target->>'material', 'rope');
    if bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
         (p_target->>'x')::int, (p_target->>'y')::int) is not null then return; end if;
    select * into d from bridge_def where id = v_kind;
    v_h := round((centre_height(p_world, floor(p.x)::int, floor(p.y)::int)
                + centre_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int)) / 2);
    insert into bridge (world_id, kind, ax, ay, bx, by, height, material, made_by)
    values (p_world, v_kind, floor(p.x)::int, floor(p.y)::int,
            (p_target->>'x')::int, (p_target->>'y')::int, v_h,
            case when v_kind = 'stone' then null else 'Oak' end, p_uid)
    returning id into v_id;
    -- gates: the first span, beside the end it is set out from, also takes a drawbridge's winch.
    insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    select p_world, v_id, t.n, t.x, t.y, span_bill(v_kind, t.n), span_bill(v_kind, t.n)
    from span_tiles(floor(p.x)::int, floor(p.y)::int,
                    (p_target->>'x')::int, (p_target->>'y')::int) t;
    select count(*)::int into v_n from bridge_span sp where sp.world_id = p_world and sp.bridge = v_id;
    perform journal_note(p_world, p_uid, 'planned_bridge');
    perform skill_raise(p_world, p_uid, d.skill, 0.4);
    perform tell(p_world, p_uid, 'You set out a ' || lower(d.name) || ' of ' || v_n || ' span'
      || case when v_n > 1 then 's' else '' end || ' across. Each one wants '
      || span_wants(span_bill(v_kind)) || '. ' || d.note, 'system');

  elsif p_action = 'build_bridge' then
    select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    select * into d from bridge_def where id = b.kind;
    select * into s from bridge_span sp where sp.world_id = p_world and sp.bridge = b.id
      and not span_done(sp.needed) order by sp.n limit 1;
    if not found then return; end if;
    -- One unit of one thing per go, as with a wall.
    select e2.key into v_want from jsonb_each(s.needed) e2
      where (e2.value)::int > 0 and pack_count(p_world, p_uid, e2.key) > 0 order by e2.key limit 1;
    if v_want is null then return; end if;
    if not consume(p_world, p_uid, v_want, 1) then return; end if;
    update bridge_span sp set needed = jsonb_set(sp.needed, array[v_want],
        to_jsonb(greatest(0, (sp.needed->>v_want)::int - 1)))
      where sp.world_id = p_world and sp.bridge = b.id and sp.n = s.n
      returning * into s;
    perform skill_raise(p_world, p_uid, d.skill, 0.5);
    perform wear_tool((select i.id from item i where i.world_id = p_world and i.holder = 'player'
      and i.holder_uid = p_uid and i.def = d.tool
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1), 0.4);
    if span_done(s.needed) then
      v_left := bridge_left(p_world, b.id);
      if v_left > 0 then
        perform tell(p_world, p_uid, 'That span is decked. ' || v_left || ' still open.', 'event');
      else
        perform journal_note(p_world, p_uid, 'bridged');
        perform tell(p_world, p_uid, 'The last span is decked and the ' || lower(bridge_name(b))
          || ' is open. ' || case when d.carts then 'A cart will cross it.'
                                  else 'Foot traffic only; nothing with a wheel.' end, 'system');
      end if;
    else
      perform tell(p_world, p_uid, 'You work a '
        || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || ' into the span. It still wants ' || span_wants(s.needed) || '.', 'event');
    end if;

  elsif p_action = 'demolish_bridge' then
    select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    -- Half of what went into it comes back, which is what pulling a thing down
    -- is worth anywhere else in the world.
    v_parts := '{}';
    for e in
      select k.key as item, sum((k.value)::int - coalesce((sp.needed->>k.key)::int, 0))::int as used
      from bridge_span sp cross join lateral jsonb_each(sp.total) k
      where sp.world_id = p_world and sp.bridge = b.id
      group by k.key order by k.key
    loop
      v_half := floor(e.used / 2.0)::int;
      if v_half > 0 then
        perform give(p_world, p_uid, e.item, v_half, 20);
        v_parts := v_parts || (v_half || ' ' ||
          lower((select coalesce(name, e.item) from item_def where id = e.item)));
      end if;
    end loop;
    delete from bridge_span where world_id = p_world and bridge = b.id;
    delete from bridge where world_id = p_world and id = b.id;
    perform tell(p_world, p_uid, case when array_length(v_parts, 1) > 0
      then 'You take the ' || lower(bridge_name(b)) || ' down and save '
           || array_to_string(v_parts, ', ') || '.'
      else 'You take the ' || lower(bridge_name(b)) || ' down.' end, 'event');

  elsif p_action = 'ring_bell' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    select * into p from player where world_id = p_world and uid = p_uid;
    r := deed_at(p_world, pc.x, pc.y);
    if r.world_id is null then return; end if;
    v_n := 0;
    -- Every wildermon working the deed drops what it is doing and walks to
    -- whoever rang: a leg to the ringer, and a while standing there before
    -- the work takes it back.
    for e in select cr.*, coalesce(sp.speed, 1) as pace
             from creature cr join species_def sp on sp.id = cr.species
             where cr.world_id = p_world and cr.mode = 'deed' and cr.hitched_to is null
               and cr.keeper in (select m.uid from deed_member m
                                 where m.world_id = p_world and m.founder = r.founded_by
                                 union select r.founded_by)
    loop
      v_ql := greatest(0.5, sqrt(power(p.x - e.to_x, 2) + power(p.y - e.to_y, 2)) / greatest(0.4, e.pace));
      update creature set phase = 'idle', work_x = null, work_y = null, enemy = null,
          from_x = e.to_x, from_y = e.to_y, to_x = p.x, to_y = p.y,
          leg_at = now(), leg_ends = now() + make_interval(secs => v_ql),
          until = now() + make_interval(secs => v_ql + 20)
        where world_id = p_world and id = e.id;
      v_n := v_n + 1;
    end loop;
    -- And every citizen hears where it hangs.
    for e in select m.uid from deed_member m where m.world_id = p_world and m.founder = r.founded_by
             union select r.founded_by
    loop
      if e.uid <> p_uid then
        perform tell(p_world, e.uid, 'The bell rings out over ' || r.name || ' from ' || pc.x || ', ' || pc.y || '.', 'system');
      end if;
    end loop;
    perform journal_note(p_world, p_uid, 'rang');
    perform tell(p_world, p_uid, 'You ring the ' || lower(placed_name(pc)) || ' and it sounds over ' || r.name || '. '
      || case when v_n > 0 then v_n || ' wildermon ' || case when v_n = 1 then 'comes' else 'come' end || ' at the sound'
              else 'Nothing is working the deed to come' end
      || ', and every citizen hears where it hangs: ' || pc.x || ', ' || pc.y || '.', 'event');

  elsif p_action = 'sleep' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    /*
     * A well-made bed is a better night than a cot with a thin mattress — and
     * a bed under a roof, in a room with walls all round it, is a better night
     * again than the same bed standing in a field in the weather.
     */
    perform journal_note(p_world, p_uid, 'slept');
    perform sleep_until_morning(p_world, p_uid,
      (select bed from furniture_def where id = pc.sub) * (0.6 + pc.ql / 250)
        * case when case when pc.level < 0 then cellar_done(p_world, floor(pc.x)::int, floor(pc.y)::int) -- cellar: always indoors
                         else indoors(p_world, 0, floor(pc.x)::int, floor(pc.y)::int) end -- cellar
               then indoors_rest() else 1 end, -- cellar
      lower(placed_name(pc)),
      -- And a Dreamweave set into it banks more of the night.
      placed_enchant(pc, 'dream'));

  elsif p_action = 'set_home' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
    update player set home_x = pc.x, home_y = pc.y where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, 'You make up the ' || lower(placed_name(pc))
      || '. This is where you will wake, whatever happens to you.', 'event');

  elsif p_action = 'pair_creature' then
    c := target_creature(p_world, p_target);
    mate := mate_for(p_world, c);
    if c.world_id is null or mate.id is null or pair_refuses(p_world, c, mate) is not null then return; end if;
    if c.sex = 'female' then dam := c; sire := mate; else dam := mate; sire := c; end if;
    v_skill := skill_of(p_world, p_uid, 'animal_husbandry');
    v_care := (dam.care + sire.care) / 2;
    v_took := random() < breed_chance(v_skill, v_care);
    perform skill_raise(p_world, p_uid, 'animal_husbandry', try_gain(v_took, breed_gain()));
    if not v_took then
      -- A failed pairing costs both of them a rest, but only half of one.
      -- Half a shorter one for the breeder's Short Rest.
      update creature set bred_at = now() - make_interval(secs => breed_rest() * (1 - pk(p_world, p_uid, 'breed:rest', 1) / 2))
        where world_id = p_world and id in (dam.id, sire.id);
      perform tell(p_world, p_uid, dam.name || ' and ' || sire.name
        || ' will have nothing to do with one another. Brush them, feed them, and try again.', 'error');
      return;
    end if;
    perform pair_them(p_world, dam.id, sire.id, v_skill, p_uid, p_target->>'sex');
    perform journal_note(p_world, p_uid, 'paired');
    perform tell(p_world, p_uid, sire.name || ' is put to ' || dam.name
      || '. She is in young and will drop in about ' || clock_left(gestation() * pk(p_world, p_uid, 'breed:gestation', 1))
      || '. Between them they carry '
      || trait_names((select array_agg(distinct t) from unnest(sire.traits || dam.traits) t))
      || '.', 'event');

  elsif p_action = 'read_blood' then
    c := target_creature(p_world, p_target);
    if c.world_id is null then return; end if;
    perform tell(p_world, p_uid, blood_read(p_world, p_uid, c), 'event');

  elsif p_action = 'dye_item' then
    select * into it from item where world_id = p_world and id = target_item(p_target);
    if it.id is null then return; end if;
    -- The litres the thing takes, out of the bucket or barrel chosen (`pickDye`), and exactly its colour.
    v_n := dye_litres_for(it.def);
    v_from := dye_pick(p_world, p_uid, v_n, p_target);
    if v_from is null then return; end if;
    v_want := dye_source_hex(p_world, p_uid, v_from);
    if not dye_spend(v_from, v_n) then return; end if;
    -- A stack is split so the rest stays as it was.
    if it.count > 1 then
      update item set count = count - 1 where id = it.id;
      insert into item (world_id, holder, holder_uid, def, ql, dmg, count, extra, rare, dye)
      values (p_world, it.holder, it.holder_uid, it.def, it.ql, it.dmg, 1, it.extra, it.rare, v_want);
    else
      update item set dye = v_want where id = it.id;
    end if;
    perform journal_note(p_world, p_uid, 'dyed');
    perform skill_raise(p_world, p_uid, 'alchemy', 0.3);
    perform tell(p_world, p_uid, 'You work ' || litres_word(v_n) || ' of ' || colour_word(v_want)
      || ' dye through it. It comes out ' || colour_word(v_want) || ', ' || v_want || '.', 'event');

  elsif p_action = 'strip_dye' then
    select * into it from item where world_id = p_world and id = target_item(p_target);
    if it.id is null then return; end if;
    select * into dye from item i where i.world_id = p_world and i.holder = 'player'
      and i.holder_uid = p_uid and i.def = 'lye_bucket' order by i.id limit 1;
    if dye.id is null or not consume(p_world, p_uid, 'lye_bucket', 1) then return; end if;
    perform give(p_world, p_uid, 'bucket', 1, dye.ql);
    update item set dye = null where id = it.id;
    perform skill_raise(p_world, p_uid, 'alchemy', 0.2);
    perform tell(p_world, p_uid, 'You boil it out in lye. It is back to the colour of '
      || lower((select coalesce(name, it.def) from item_def where id = it.def)) || '.', 'event');

  elsif p_action = 'start_brew' then
    select * into bd from brew_def where id = p_target->>'brew';
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if bd.id is null or pc.id is null
       or brew_reason(p_world, p_uid, pc, bd) is not null then return; end if;
    -- What goes in decides most of what comes out; the hand only decides how
    -- much of it survives the working.
    select i.* into v_stock from craft_stock(p_world, p_uid) h join item i on i.id = h.id
      where h.def = bd.input order by h.draw limit 1;
    v_ql := coalesce(v_stock.ql, 20);
    if not craft_consume(p_world, p_uid, bd.input, bd.count) then return; end if;
    if not skill_check(skill_of(p_world, p_uid, 'brewing'), bd.difficulty, 0) then
      update placed set litres = greatest(0, placed_litres(pc) - bd.litres), since = now()
        where id = pc.id;
      update placed set liquid = null where id = pc.id and litres <= 0;
      update placed set knack = null where id = pc.id;
      perform skill_raise(p_world, p_uid, 'brewing', try_gain(false, brew_gain()));
      perform tell(p_world, p_uid, 'It will not take. You tip the whole soured lot out of the '
        || lower(placed_name(pc)) || '.', 'event');
      return;
    end if;
    update placed set litres = bd.litres, liquid = bd.id, ferment = bd.seconds, since = now(),
        ql = greatest(1, least(100, (v_ql + skill_of(p_world, p_uid, 'brewing')) / 2)),
        -- Its brewer's hand in it, which goes into every bucket drawn off it (a Cook's Strong Brew).
        knack = nullif(pk(p_world, p_uid, 'brewed:' || bd.id, 1), 1)
      where id = pc.id;
    perform journal_note(p_world, p_uid, 'brew');
    perform journal_note(p_world, p_uid, 'brew:' || bd.id);
    perform skill_raise(p_world, p_uid, 'brewing', try_gain(true, brew_gain()));
    -- Rounded half up, as the browser's `Math.round` does: a wine's 112.5 minutes said 112 here and 113 there.
    perform tell(p_world, p_uid, bd.done || ' (about ' || floor(bd.seconds / 60 + 0.5)::bigint || ' minutes)', 'event');
  end if;
end $function$;

reset check_function_bodies;
select private.lock_doors();
