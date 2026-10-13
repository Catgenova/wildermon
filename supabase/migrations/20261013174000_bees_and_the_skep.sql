/*
 * Bees: the skep (`src/game/bees.ts`).
 *
 * The definitions cross the piece (`furniture_def`), its recipe (ropemaking
 * with a carving knife, off thatch and reed), its item, its two jobs -- Take
 * honey and Examine -- and every number and refusal: `bee_action`,
 * `take_honey_action`, `skep_kind`, `skep_reach`, `skep_clump_hours`,
 * `skep_hour`, `skep_holds`, `skep_wax_every`, `skep_idle`, `skep_skill` and
 * `skep_said`. What is here is the doing of it:
 *
 *   * `skep_stamp`: a skep's placed row, as it goes in, gets the moment it
 *     starts filling from (`state -> skep_at`, epoch seconds), which the
 *     ground read carries to every browser with the rest of `state`;
 *   * `skep_flowers`: the clumps within `skep_reach()` tiles each way of the
 *     skep's tile at a moment, each as `flowers_on` counts it then
 *     (`skepFlowers`);
 *   * `skep_made_between` and `skep_made`: what it has made since that
 *     moment, cut at every turn of the season, each stretch at its own
 *     season's flowers, a honey every `skep_clump_hours()` hours a clump,
 *     nothing in `skep_idle()`, up to `skep_holds()` (`skepMadeBetween`);
 *   * Take honey and Examine (`skep_refusal`, `perform_skep`): there, within
 *     reach, whose, and a whole honey in it; every whole honey and a beeswax
 *     for every `skep_wax_every()` of them, at `product_ql` off the taker's
 *     `skep_skill()` with the skep as the tool, which trains it a go's worth;
 *     and Examine says the flowers, the rate an hour, what is in it and what
 *     it holds (`skep_says`, `skepSays`).
 *
 * Every function here is plpgsql, so none of it asks after a definition
 * before it is called: the definitions may land after this file.
 *
 * Rewritten here, from the newest migration that defines each, with one
 * branch for a skep's two jobs:
 *   last_action  -- 20261011060546_memorial_stones.sql
 *   last_refusal -- 20261013003000_ranks_of_your_own.sql
 *   perform_last -- 20261011060546_memorial_stones.sql
 *
 * `supabase/test/bees.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';

/* ---- the moment it fills from ------------------------------------------------------------------------ */

create or replace function skep_stamp() returns trigger language plpgsql as $fn$
begin
  if new.kind = 'furniture' and new.sub = skep_kind() and not (coalesce(new.state, '{}'::jsonb) ? 'skep_at') then
    new.state := coalesce(new.state, '{}'::jsonb) || jsonb_build_object('skep_at', extract(epoch from now())::double precision);
  end if;
  return new;
end $fn$;

drop trigger if exists skep_stamp on placed;
create trigger skep_stamp before insert on placed for each row execute function skep_stamp();

/* ---- what it makes ------------------------------------------------------------------------------------- */

/** The clumps of wildflowers within `skep_reach()` tiles each way of a tile, at a moment (`skepFlowers`). */
create or replace function skep_flowers(p_world uuid, p_x int, p_y int, p_at timestamptz default now()) returns int
language plpgsql stable as $fn$
declare v_r int := skep_reach(); v_n int := 0; tx int; ty int;
begin
  for ty in p_y - v_r .. p_y + v_r loop
    for tx in p_x - v_r .. p_x + v_r loop
      continue when not in_bounds(p_world, tx, ty);
      v_n := v_n + coalesce(flowers_on(p_world, tx, ty, p_at), 0);
    end loop;
  end loop;
  return v_n;
end $fn$;

/** Honey an hour off this many clumps in a season, as it is said: two places, no trailing noughts (`skepRateSaid`). */
create or replace function skep_rate_said(p_flowers int, p_season text) returns text language plpgsql stable as $fn$
begin
  return trim_scale(round((case when p_season = skep_idle() then 0 else p_flowers * 100 end)::numeric
                          / skep_clump_hours()::numeric) / 100)::text;
end $fn$;

/**
 * Honey a skep on this tile has made between two moments, in epoch seconds,
 * up to what it holds: each stretch between turns of the season at its own
 * season's flowers, counted once a season (`skepMadeBetween`, step for step).
 */
create or replace function skep_made_between(p_world uuid, p_x int, p_y int, p_from double precision, p_to double precision)
returns double precision language plpgsql stable as $fn$
declare t double precision := p_from; v_end double precision; v_made double precision := 0; v_season text;
        v_n int; v_seen jsonb := '{}'::jsonb;
begin
  if p_from is null or p_to is null then return 0; end if;
  while t < p_to and v_made < skep_holds() loop
    v_season := season_at(to_timestamp(t));
    v_end := least(p_to, extract(epoch from season_began(to_timestamp(t)))::double precision
                         + season_days()::double precision * day_seconds()::double precision);
    if v_season <> skep_idle() then
      if v_seen ? v_season then
        v_n := (v_seen->>v_season)::int;
      else
        v_n := skep_flowers(p_world, p_x, p_y, to_timestamp(t));
        v_seen := v_seen || jsonb_build_object(v_season, v_n);
      end if;
      v_made := v_made + ((v_end - t) * v_n) / (skep_clump_hours() * skep_hour());
    end if;
    t := v_end;
  end loop;
  return least(skep_holds()::double precision, v_made);
end $fn$;

/** Honey a skep standing has made since it was set down or last emptied (`skepMade`). */
create or replace function skep_made(p_world uuid, pl placed, p_at timestamptz default now()) returns double precision
language plpgsql stable as $fn$
begin
  return skep_made_between(p_world, pl.x, pl.y,
    coalesce((pl.state->>'skep_at')::double precision, extract(epoch from pl.made_at)::double precision),
    extract(epoch from p_at)::double precision);
end $fn$;

/* ---- the words ----------------------------------------------------------------------------------------- */

create or replace function skep_word(p_id text) returns text language plpgsql stable as $fn$
begin
  return lower(coalesce((select d.name from item_def d where d.id = p_id), p_id));
end $fn$;

/** What taking from it says (`skepTookSaid`). */
create or replace function skep_took_said(p_honey int, p_wax int) returns text language plpgsql stable as $fn$
begin
  return 'You take ' || p_honey || ' ' || skep_word('honey')
    || case when p_wax > 0 then ' and ' || p_wax || ' ' || skep_word('wax') else '' end
    || ' from the ' || skep_word(skep_kind()) || '. It starts filling again from empty.';
end $fn$;

/** What Examine says of a skep: its flowers and its rate, or why it makes nothing; and what is in it (`skepSays`). */
create or replace function skep_says(p_flowers int, p_season text, p_made double precision) returns text
language plpgsql stable as $fn$
declare v_honey int := floor(p_made)::int; v_h text := skep_word('honey'); v_w text := skep_word('wax');
        v_s text := skep_word(skep_kind()); v_rate text; v_all text[] := seasons();
begin
  if p_season = skep_idle() then
    v_rate := 'It is ' || p_season || ': the ' || v_s || ' makes nothing until '
      || v_all[array_position(v_all, p_season) % array_length(v_all, 1) + 1] || '.';
  elsif p_flowers <= 0 then
    v_rate := 'No wildflowers are in flower within ' || skep_reach() || ' tiles of the ' || v_s
      || ' this ' || p_season || ': it makes nothing.';
  else
    v_rate := p_flowers || ' ' || case when p_flowers = 1 then 'clump' else 'clumps' end
      || ' of wildflowers within ' || skep_reach() || ' tiles this ' || p_season || ': it makes '
      || skep_rate_said(p_flowers, p_season) || ' ' || v_h || ' an hour, a ' || v_h || ' every '
      || skep_clump_hours() || ' hours for each clump.';
  end if;
  return v_rate || ' In it: ' || v_honey || ' ' || v_h || ' and ' || floor(v_honey::double precision / skep_wax_every())::int
    || ' ' || v_w || ', of the ' || skep_holds() || ' ' || v_h || ' it holds (a ' || v_w || ' for every '
    || skep_wax_every() || ' ' || v_h || ').';
end $fn$;

/* ---- the two jobs -------------------------------------------------------------------------------------- */

/**
 * Why a skep cannot be emptied, or looked at, now, or null: the browser's
 * `skepRefusal`, question for question -- there, in reach, whose, and a whole
 * honey in it.
 */
create or replace function skep_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare pl placed;
begin
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint
    and kind = 'furniture' and sub = skep_kind();
  if not found then return 'It is gone.'; end if;
  if not placed_in_reach(p_world, p_uid, pl.id) then
    return lamp_too_far_said(lower((select f.name from furniture_def f where f.id = pl.sub)));
  end if;
  if p_action <> take_honey_action() then return null; end if;
  if not (coalesce(pl.made_by = p_uid, false) or on_my_deed(p_world, p_uid, pl.x, pl.y)) then
    return skep_said('notYours');
  end if;
  if skep_made(p_world, pl) < 1 then return skep_said('empty'); end if;
  return null;
end $fn$;

create or replace function perform_skep(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
declare pl placed; v_now timestamptz := now(); v_honey int; v_wax int; v_ql double precision;
begin
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint
    and kind = 'furniture' and sub = skep_kind() for update;
  if not found then return; end if;
  if p_action <> take_honey_action() then
    perform tell(p_world, p_uid, skep_says(skep_flowers(p_world, pl.x, pl.y, v_now), season_at(v_now),
      skep_made(p_world, pl, v_now)), 'event');
    return;
  end if;
  v_honey := floor(skep_made(p_world, pl, v_now))::int;
  if v_honey < 1 then return; end if;
  v_wax := floor(v_honey::double precision / skep_wax_every())::int;
  -- The skep is the tool: the taker's trade, and its quality where the roll misses (`productQl`).
  v_ql := product_ql(skill_of(p_world, p_uid, skep_skill()), pl.ql);
  perform gather(p_world, p_uid, 'honey', v_honey, v_ql);
  if v_wax > 0 then perform gather(p_world, p_uid, 'wax', v_wax, v_ql); end if;
  update placed set state = coalesce(state, '{}'::jsonb) || jsonb_build_object('skep_at', extract(epoch from v_now)::double precision)
   where id = pl.id;
  -- A go's worth of the trade, as the browser's finished job gives it.
  perform skill_raise(p_world, p_uid, skep_skill(), 1);
  perform tell(p_world, p_uid, skep_took_said(v_honey, v_wax), 'event');
  perform land_announce(p_world, pl.x, pl.y);
end $fn$;

revoke all on function skep_stamp() from public, anon, authenticated;
revoke all on function skep_flowers(uuid, int, int, timestamptz) from public, anon, authenticated;
revoke all on function skep_rate_said(int, text) from public, anon, authenticated;
revoke all on function skep_made_between(uuid, int, int, double precision, double precision) from public, anon, authenticated;
revoke all on function skep_made(uuid, placed, timestamptz) from public, anon, authenticated;
revoke all on function skep_word(text) from public, anon, authenticated;
revoke all on function skep_took_said(int, int) from public, anon, authenticated;
revoke all on function skep_says(int, text, double precision) from public, anon, authenticated;
revoke all on function skep_refusal(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function perform_skep(uuid, uuid, text, jsonb) from public, anon, authenticated;

/* ---- last_action: from 20261011060546_memorial_stones.sql, the newest that defines it. With a skep. ---- */

/*
 * plpgsql rather than the sql it was, so that it does not ask after
 * `bee_action` (a definition) until it is called: the definitions may land
 * after this file.
 */
CREATE OR REPLACE FUNCTION public.last_action(p_action text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
begin
  return p_action in ('plan_bridge', 'build_bridge', 'demolish_bridge',
                      'ring_bell', 'sleep', 'set_home', 'pair_creature', 'read_blood',
                      'dye_item', 'strip_dye', 'start_brew', 'set_bauble', 'sacrifice', 'absorb_mote')
      -- Enchant: a scroll into a melee weapon (`enchanting.ts`).
      or p_action = enchant_action()
      -- A memorial stone's two: cutting a line into it, and reading it (`memorial.ts`).
      or memorial_action(p_action)
      -- A skep's two: emptying it of its honey, and looking into it (`bees.ts`).
      or bee_action(p_action);
end
$function$;

/* ---- last_refusal: from 20261013003000_ranks_of_your_own.sql, the newest that defines it. With a skep. ---- */

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

/* ---- perform_last: from 20261011060546_memorial_stones.sql, the newest that defines it. With a skep. ---- */

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
    perform tell(p_world, p_uid, bd.done || ' (about ' || round(bd.seconds / 60) || ' minutes)', 'event');
  end if;
end $function$;

select private.lock_doors();
