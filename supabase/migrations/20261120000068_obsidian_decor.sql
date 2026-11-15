/*
 * The obsidian pieces (`src/game/obsidian.ts`, `src/game/obsidiandefs.ts`): a
 * black glass lantern, an obsidian throne, an obsidian obelisk, a dragon-glass
 * fountain, a shard garden, an obsidian vase, a lava lamp column, an obsidian
 * wind chime, an obsidian bust, a glass shard path and an ember orb on a stand.
 *
 * The definitions carried every piece, its recipe and its item, the jobs
 * (`obsidian_action`), a throne's seat, a fountain's well, how a chime hangs
 * and a path lies (`furniture_def.mount` `hang`, `edge`), every number
 * (`lantern_candles`, `black_lantern_reach`, `throne_seats` and the rest), the
 * kinds, the fountains (`is_fountain`) and every sentence (`obsidian_said`,
 * `obsidian_done`). What is here is the doing.
 *
 *   * A black glass lantern takes `lantern_candles` at once, as a paper
 *     lantern pole: its `fuel`, burning `black_lantern_burn` of its QL while
 *     it is `lit` (`placed_fuel`, `placed_lit`), lit off a flame and put out.
 *   * A throne is a seat sat in only by the founder of the settlement it
 *     stands on (`furnish_refusal`); Examine reads that settlement's level,
 *     citizens and workers as they are now (`throne_says`).
 *   * An obelisk is named as a cairn is: its `engraving`.
 *   * A dragon-glass fountain is a fountain to every rule: a well, and the
 *     foot of an aqueduct (`is_fountain`: `aqueduct_plan`, `aqueduct_unfeed`,
 *     `placed_litres`, `settle_spring`, `settle_water`).
 *   * An obsidian vase holds wildflowers by the vase's rule (`furnish_refusal`).
 *   * An obsidian bust is carved as a citizen by the stone bust's rule (`fitting_refusal`).
 *   * A glass shard path lies along a side of its tile, as a hedge, from the
 *     ground and outside a building (`mount_refusal` `edge`).
 *   * The jobs (`obsidian_refusal`, `perform_obsidian`), dispatched at the end
 *     of the line (`last_action`, `last_refusal`, `perform_last`).
 *
 * `supabase/test/obsidian.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

/* ---- a black glass lantern --------------------------------------------------------------------- */

/** Seconds a candle put in a black glass lantern burns: a candle's in a lantern of its QL (`blackLanternBurn`). */
create or replace function black_lantern_burn(p_ql double precision) returns double precision language sql stable as $fn$
  select round(candle_burn(p_ql))::double precision
$fn$;

/* ---- a dragon-glass fountain: a fountain to every rule ------------------------------------------ */

select pg_temp.patch_fn('aqueduct_plan(uuid, uuid, integer, integer, integer, integer)',
  $o$q.kind = 'furniture' and q.sub = 'fountain'$o$,
  $n$q.kind = 'furniture' and is_fountain(q.sub)$n$);
select pg_temp.patch_fn('aqueduct_unfeed(uuid, bigint)',
  $o$q.kind = 'furniture' and q.sub = 'fountain'$o$,
  $n$q.kind = 'furniture' and is_fountain(q.sub)$n$);
select pg_temp.patch_fn('placed_litres(placed)',
  $o$case when p.sub = 'fountain'$o$,
  $n$case when is_fountain(p.sub)$n$);
select pg_temp.patch_fn('settle_spring(uuid, bigint)',
  $o$q.kind = 'furniture' and q.sub = 'fountain'$o$,
  $n$q.kind = 'furniture' and is_fountain(q.sub)$n$);
select pg_temp.patch_fn('settle_water(uuid, integer, integer, integer, integer)',
  $o$q.kind = 'furniture' and q.sub = 'fountain'$o$,
  $n$q.kind = 'furniture' and is_fountain(q.sub)$n$);

/* ---- a glass shard path: along a side, as a hedge ------------------------------------------------ */

select pg_temp.patch_fn('mount_refusal(uuid, uuid, text, integer, integer, text, integer)',
  $o$begin
  -- Curtains on either face of a finished window$o$,
  $n$begin
  -- A glass shard path along a side, from the ground, outside a building, as a hedge (`obsidian.ts`).
  if p_mount = 'edge' then return hedge_refusal(p_world, p_x, p_y, p_level); end if;
  -- Curtains on either face of a finished window$n$);

/* ---- a throne, a vase, a bust: the rules they share ---------------------------------------------- */

select pg_temp.patch_fn('furnish_refusal(uuid, uuid, text, jsonb)',
  $o$when p_action in ('vase_put', 'vase_take') then sub = vase_kind()$o$,
  $n$when p_action in ('vase_put', 'vase_take') then sub in (vase_kind(), obsidian_vase_kind())$n$);
select pg_temp.patch_fn('furnish_refusal(uuid, uuid, text, jsonb)',
  $o$    return case when sitters(p_world, p_uid, pl.id) >= v_n then furnish_said('seatsFull', v_name, v_n, null) end;$o$,
  $n$    if sitters(p_world, p_uid, pl.id) >= v_n then return furnish_said('seatsFull', v_name, v_n, null); end if;
    -- An obsidian throne: its settlement's founder's alone (`obsidian.ts`).
    if pl.sub = obsidian_throne_kind() and (deed_at(p_world, pl.x, pl.y)).founded_by is distinct from p_uid then
      return obsidian_said('founder');
    end if;
    return null;$n$);
select pg_temp.patch_fn('fitting_refusal(uuid, uuid, text, jsonb)',
  $o$when p_action = 'carve_bust' then stone_bust_kind() end;$o$,
  $n$when p_action = 'carve_bust' then case when sub = obsidian_bust_kind() then sub else stone_bust_kind() end end;$n$);

/* ---- a throne: its settlement, now --------------------------------------------------------------- */

/** What a throne's Examine says: the settlement it stands on, its level, its citizens (the founder and the roll) and its workers. */
create or replace function throne_says(p_world uuid, pl placed) returns text language sql stable as $fn$
  select obsidian_done('throne', d.name, d.level,
           1 + (select count(*)::int from deed_member m where m.world_id = p_world and m.founder = d.founded_by),
           (select count(*)::int from private.deed_workers(p_world, d.founded_by)))
    from deed_at(p_world, pl.x, pl.y) d
   where d.world_id is not null
$fn$;

/* ---- the jobs ---------------------------------------------------------------------------------- */

/**
 * Why a job at an obsidian piece cannot be done now, or null: the browser's
 * `obsidianRefusal`, question for question -- there, in reach, and then the piece.
 */
create or replace function obsidian_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare pl placed; v_name text; v_text text; v_why text;
begin
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint and kind = 'furniture'
     and sub = case when p_action in ('black_lantern_candle', 'black_lantern_light', 'black_lantern_douse') then black_lantern_kind()
                    when p_action = 'read_throne' then obsidian_throne_kind()
                    when p_action = 'name_obelisk' then obsidian_obelisk_kind() end;
  if not found then return 'It is gone.'; end if;
  v_name := lower((select f.name from furniture_def f where f.id = pl.sub));
  if not placed_in_reach(p_world, p_uid, pl.id) then return lamp_too_far_said(v_name); end if;
  if p_action = 'black_lantern_candle' then
    if placed_fuel(pl) > 0 then return obsidian_said('candleIn'); end if;
    return case when pack_count(p_world, p_uid, 'candle') >= lantern_candles() then null else obsidian_said('noCandles') end;
  elsif p_action = 'black_lantern_light' then
    if placed_fuel(pl) <= 0 then return obsidian_said('noCandle'); end if;
    if placed_lit(pl) then return obsidian_said('lit'); end if;
    return case when flame_near(p_world, p_uid) is null then no_flame_said() end;
  elsif p_action = 'black_lantern_douse' then
    return case when placed_lit(pl) then null else obsidian_said('notLit') end;
  elsif p_action = 'read_throne' then
    return case when not exists (select 1 from deed_covering(p_world, pl.x, pl.y)) then obsidian_said('noDeed') end;
  elsif p_action = 'name_obelisk' then
    if not may_engrave(p_world, p_uid, pl) then return furnish_said('cairnNotYours', null, null, null); end if;
    v_why := private.muted_why(p_world, p_uid);
    if v_why is not null then return v_why; end if;
    if p_target->>'name' is null then return null; end if;
    v_text := private.clean_text(p_target->>'name', cairn_name_max());
    if v_text = '' then return furnish_said('noName', null, null, null); end if;
    return case when v_text = pl.engraving then furnish_said('sameName', null, null, null) end;
  end if;
  return null;
end $fn$;

/** The jobs done: a candle put in a black glass lantern, lit and put out; a throne's settlement read; an obelisk named. */
create or replace function perform_obsidian(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
declare pl placed; v_left double precision; v_from text; v_text text;
begin
  if obsidian_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
  select * into pl from placed where world_id = p_world and id = (p_target->>'id')::bigint for update;
  if p_action = 'read_throne' then
    perform tell(p_world, p_uid, throne_says(p_world, pl), 'event');
    return;
  elsif p_action = 'black_lantern_candle' then
    if not consume(p_world, p_uid, 'candle', lantern_candles()) then return; end if;
    v_left := black_lantern_burn(pl.ql);
    update placed set fuel = v_left, lit = false, since = now() where id = pl.id;
    perform tell(p_world, p_uid, obsidian_done('candle', time_words(v_left), null, null, null), 'event');
  elsif p_action = 'black_lantern_light' then
    v_from := coalesce(flame_near(p_world, p_uid), 'fire');
    update placed set fuel = placed_fuel(pl), lit = true, since = now() where id = pl.id;
    perform tell(p_world, p_uid, obsidian_done('lit', v_from, null, null, null), 'event');
  elsif p_action = 'black_lantern_douse' then
    v_left := placed_fuel(pl);
    update placed set fuel = v_left, lit = false, since = now() where id = pl.id;
    perform tell(p_world, p_uid, obsidian_done('out', time_words(greatest(0, v_left)), null, null, null), 'event');
  elsif p_action = 'name_obelisk' then
    v_text := private.clean_text(p_target->>'name', cairn_name_max());
    update placed set engraving = v_text where id = pl.id;
    perform tell(p_world, p_uid, obsidian_done('named', v_text, null, null, null), 'event');
  end if;
  perform land_announce(p_world, pl.x, pl.y);
end $fn$;

select pg_temp.patch_fn('last_action(text)',
  $o$      or adorn_action(p_action)
$o$,
  $n$      or adorn_action(p_action)
      -- The obsidian pieces' jobs: a black glass lantern, a throne, an obelisk (`obsidian.ts`).
      or obsidian_action(p_action)
$n$);
select pg_temp.patch_fn('last_refusal(uuid, uuid, text, jsonb)',
  $o$  if adorn_action(p_action) then
    return adorn_refusal(p_world, p_uid, p_action, p_target);
  end if;$o$,
  $n$  if adorn_action(p_action) then
    return adorn_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- The obsidian pieces' jobs (`obsidian.ts`).
  if obsidian_action(p_action) then
    return obsidian_refusal(p_world, p_uid, p_action, p_target);
  end if;$n$);
select pg_temp.patch_fn('perform_last(uuid, uuid, text, jsonb)',
  $o$  if adorn_action(p_action) then
    perform perform_adorn(p_world, p_uid, p_action, p_target);
    return;
  end if;$o$,
  $n$  if adorn_action(p_action) then
    perform perform_adorn(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- The obsidian pieces' jobs (`obsidian.ts`).
  if obsidian_action(p_action) then
    perform perform_obsidian(p_world, p_uid, p_action, p_target);
    return;
  end if;$n$);

select private.lock_doors();
