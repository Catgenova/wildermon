-- Iron and rock outcroppings (`outcrops.ts`).
--
-- Asked for: iron and rock outcroppings that spawn at random within the Runestone safe zones on grass daily, and can
-- be mined 20 times before breaking and going away until the next daily reset spawns more; everything mined off one at
-- QL 5, whatever the skill or the pickaxe.
--
--   * Each is a placed piece of the island's: kind furniture, sub its kind (`outcrop_kinds`), its swings left in
--     `state -> uses`, set down a whole tile, nobody's.
--   * At each daily reset, after the woods and the swirls (`tree_tick`), `outcrop_day` takes every one on the island
--     away and sets `per_ring` of each kind down round each centre of the safe ring -- the spawn and each Runestone
--     (`outcrop_centres`, the points `safe_ring_on` measures from) -- at tiles drawn evenly over the ring's disc, on
--     grass and nowhere else (`outcrop_site_ok`): not on water, a settlement, a building, a Runestone, a crate, a
--     spring or a pool, not beside another placed piece, and not within `outcrop_clear` tiles of the ring's centre,
--     where the stone, its start ring and its landing are (any
--     centre's, where two rings meet).
--   * Mine (`mine_outcrop`) is a go at mining: mining's skill, tool, time, wind and odds (`action_def`), a Miner's
--     Sure Swing passing a failed one as it does at a face. A swing that comes off gives one of its kind's yield at
--     `outcrop_ql`, trains mining as a swing at a face does, and takes a use; at none the piece is gone. Nothing else
--     is done to one (`outcrop_refusal`).
--   * Examine of its tile says it, its uses left and what it gives (`outcrop_says`).
--
-- Every island standing has its first outcroppings now, rather than at its next daily reset.
-- `supabase/test/outcrops.ts` holds the two sides to each other.

set local lock_timeout = '3s';

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

/* ---- What one is ---------------------------------------------------------------------------------------------- */

create or replace function outcrop_action(p_action text) returns boolean language sql immutable as $$
  select p_action = outcrop_mine()
$$;

/** The kind of the outcropping a placed id is, or null for anything else. */
create or replace function outcrop_kind_of(p_world uuid, p_id bigint) returns text language sql stable as $$
  select pl.sub from placed pl
   where pl.world_id = p_world and pl.id = p_id and pl.kind = 'furniture' and pl.sub in (select k.id from outcrop_kinds() k)
$$;

/** "Uses left: 14/20": the browser's `usesSaid`. */
create or replace function outcrop_uses_said(p_uses int) returns text language sql immutable as $$
  select 'Uses left: ' || p_uses || '/' || outcrop_uses()::int
$$;

/** What Examine says of the outcroppings on a tile: " Iron outcropping. Uses left: 14/20. Mine: iron ore, QL 5." (`outcropSays`). */
create or replace function outcrop_says(p_world uuid, p_x int, p_y int) returns text language sql stable as $$
  select coalesce(string_agg(' ' || k.name || '. ' || outcrop_uses_said(coalesce((pl.state->>'uses')::int, outcrop_uses()::int))
                             || '. Mine: ' || lower(coalesce(i.name, k.yields)) || ', QL ' || outcrop_ql()::int || '.', '' order by pl.id), '')
    from placed pl join outcrop_kinds() k on k.id = pl.sub left join item_def i on i.id = k.yields
   where pl.world_id = p_world and pl.kind = 'furniture' and pl.x = p_x and pl.y = p_y
$$;

/* ---- A day's outcroppings ------------------------------------------------------------------------------------- */

/** The centres of an island's safe ring, as `safe_ring_on` measures from them: the spawn tile's middle and each Runestone's. */
create or replace function outcrop_centres(p_world uuid) returns table (x double precision, y double precision) language sql stable as $$
  select w.spawn_x + 0.5::double precision, w.spawn_y + 0.5::double precision from world w where w.id = p_world
  union all
  select c.x + 0.5::double precision, c.y + 0.5::double precision from world w, runestone_centres(w.size) c where w.id = p_world
$$;

/** Whether an outcropping may be set down on a tile, for the ring round (`p_cx`, `p_cy`): `outcropSite` in the help's words. */
create or replace function outcrop_site_ok(p_world uuid, p_x int, p_y int, p_cx double precision, p_cy double precision)
returns boolean language plpgsql stable as $$
declare v_size int;
begin
  select w.size into v_size from world w where w.id = p_world;
  if v_size is null or least(p_x, p_y) < 1 or greatest(p_x, p_y) > v_size - 2 then return false; end if;
  -- Inside the ring, and clear of every centre: where two rings meet, of the other's too.
  if (p_x + 0.5 - p_cx) ^ 2 + (p_y + 0.5 - p_cy) ^ 2 > safe_ring() ^ 2 then return false; end if;
  if exists (select 1 from outcrop_centres(p_world) c
              where greatest(abs(p_x + 0.5 - c.x), abs(p_y + 0.5 - c.y)) <= outcrop_clear()) then
    return false;
  end if;
  -- Grass, and dry.
  if land_tile(p_world, p_x, p_y) <> tile_id('Grass') or has_water(p_world, p_x, p_y) then return false; end if;
  if runestone_on(v_size, p_x, p_y) is not null then return false; end if;
  if on_deed(p_world, p_x, p_y) or building_at(p_world, p_x, p_y) is not null then return false; end if;
  -- Nothing set down on it or beside it; no crate, spring or pool on it.
  if exists (select 1 from placed pl where pl.world_id = p_world and pl.x between p_x - 1 and p_x + 1 and pl.y between p_y - 1 and p_y + 1) then
    return false;
  end if;
  if exists (select 1 from crate c where c.world_id = p_world and c.x between p_x - 1 and p_x + 1 and c.y between p_y - 1 and p_y + 1)
     or exists (select 1 from spring_tile st where st.world_id = p_world and st.x = p_x and st.y = p_y)
     or exists (select 1 from foundation fo where fo.world_id = p_world and fo.x = p_x and fo.y = p_y) then
    return false;
  end if;
  return true;
end $$;

/**
 * Yesterday's outcroppings gone and the day's set down: round each centre of the safe ring, `per_ring` of each kind,
 * at tiles drawn evenly over the ring's disc, up to `outcrop_draws` draws for each one wanted. Returns how many.
 */
create or replace function outcrop_day(p_world uuid) returns int language plpgsql as $$
declare w world; c record; k record; v_n int := 0; v_got int; v_tries int; v_a double precision; v_r double precision; v_x int; v_y int;
begin
  select * into w from world where id = p_world;
  if not found or not w.ready then return 0; end if;
  -- One at a time for an island.
  perform pg_advisory_xact_lock(hashtext('outcrop_day:' || p_world::text)::bigint);
  delete from placed pl where pl.world_id = p_world and pl.kind = 'furniture' and pl.sub in (select ok.id from outcrop_kinds() ok);
  for c in select * from outcrop_centres(p_world) loop
    for k in select * from outcrop_kinds() ok order by ok.id loop
      v_got := 0;
      v_tries := 0;
      while v_got < k.per_ring and v_tries < k.per_ring * outcrop_draws() loop
        v_tries := v_tries + 1;
        v_a := random() * 2 * pi();
        v_r := safe_ring() * sqrt(random());
        v_x := floor(c.x + cos(v_a) * v_r)::int;
        v_y := floor(c.y + sin(v_a) * v_r)::int;
        if outcrop_site_ok(p_world, v_x, v_y, c.x, c.y) then
          insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, facing, state)
          values (p_world, 'furniture', k.id, v_x, v_y, 0, 0, v_x + 0.5, v_y + 0.5, outcrop_ql(),
                  (array['n', 'e', 's', 'w'])[1 + floor(random() * 4)::int], jsonb_build_object('uses', outcrop_uses()::int));
          v_got := v_got + 1;
        end if;
      end loop;
      v_n := v_n + v_got;
    end loop;
  end loop;
  return v_n;
end $$;

/* ---- Mining one ---------------------------------------------------------------------------------------------- */

/**
 * Why Mine at an outcropping is refused, in the browser's words and order (`outcropRefusal`); and for anything else
 * aimed at one, that it is mined and nothing else.
 */
create or replace function outcrop_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $$
declare v_kind text; v_tool text;
begin
  if outcrop_action(p_action) then
    if p_target->>'kind' is distinct from 'furniture' then return outcrop_said_gone(); end if;
    v_kind := outcrop_kind_of(p_world, nullif(p_target->>'id', '')::bigint);
    if v_kind is null then return outcrop_said_gone(); end if;
    if not placed_in_reach(p_world, p_uid, (p_target->>'id')::bigint) then return 'You are too far away from that.'; end if;
    select d.tool into v_tool from action_def d where d.id = p_action;
    if v_tool is not null and tool_ql(p_world, p_uid, v_tool) <= 0 then
      return 'Need a ' || lower((select coalesce(name, v_tool) from item_def where id = v_tool)) || '.';
    end if;
    return null;
  end if;
  if p_target->>'kind' = 'furniture' then
    v_kind := outcrop_kind_of(p_world, nullif(p_target->>'id', '')::bigint);
  elsif p_target ? 'into' then
    v_kind := outcrop_kind_of(p_world, nullif(p_target->>'into', '')::bigint);
  end if;
  if v_kind is null then return null; end if;
  return (select k.name from outcrop_kinds() k where k.id = v_kind) || ': ' || outcrop_said_only();
end $$;

/**
 * A swing at an outcropping: mining's check, its yield at `outcrop_ql`, a use taken, and the piece gone at none. Said
 * in the browser's words (`outcropMinedSays`, `outcropBrokeSays`).
 */
create or replace function perform_outcrop(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $$
declare d action_def; pl placed; k record; s double precision; tq double precision; v_tool bigint; v_left int; v_name text;
begin
  select * into d from action_def where id = p_action;
  select * into pl from placed where world_id = p_world and id = nullif(p_target->>'id', '')::bigint for update;
  select * into k from outcrop_kinds() ok where ok.id = pl.sub;
  if pl.id is null or k.id is null or pl.kind <> 'furniture' then
    perform tell(p_world, p_uid, outcrop_said_gone(), 'error');
    return;
  end if;
  s := skill_of(p_world, p_uid, d.skill);
  tq := tool_ql(p_world, p_uid, d.tool);
  select i.id into v_tool from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = d.tool
   order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
  if v_tool is not null then perform wear_tool(v_tool); end if;
  -- A Miner's Sure Swing passes some of the swings that fail, as at a face.
  if not perk_pass(skill_check(s, d.difficulty, tq), pk(p_world, p_uid, 'fail:mine', 1)) then
    perform skill_raise(p_world, p_uid, d.skill, try_gain(false));
    perform tell(p_world, p_uid, 'Mining failed.', 'event');
    return;
  end if;
  if k.yields like '%\_ore' then
    perform journal_note(p_world, p_uid, 'ore');
    perform journal_note(p_world, p_uid, 'ore:' || k.yields);
  end if;
  perform gather(p_world, p_uid, k.yields, 1, outcrop_ql());
  v_name := lower(coalesce((select i.name from item_def i where i.id = k.yields), k.yields));
  v_left := greatest(0, coalesce((pl.state->>'uses')::int, outcrop_uses()::int) - 1);
  if v_left <= 0 then
    delete from placed where world_id = p_world and id = pl.id;
  else
    update placed set state = state || jsonb_build_object('uses', v_left) where world_id = p_world and id = pl.id;
  end if;
  perform tell(p_world, p_uid, 'Mined: ' || v_name || ', QL ' || outcrop_ql()::int || '. ' || outcrop_uses_said(v_left) || '.', 'event');
  if v_left <= 0 then
    perform tell(p_world, p_uid, k.name || ': broken. New outcroppings at the ' || daily_reset_words() || '.', 'event');
  end if;
  perform skill_raise(p_world, p_uid, d.skill, 1);
end $$;

/* ---- Into the doors ------------------------------------------------------------------------------------------ */

select pg_temp.patch_fn('act_ported(text)',
  $o$      or swirl_action(p_action)$o$,
  $n$      or swirl_action(p_action)
      -- Mine, at an outcropping (`outcrops.ts`).
      or outcrop_action(p_action)$n$);

select pg_temp.patch_fn('act_refusal(uuid, uuid, text, jsonb)',
  $o$  why := lair_refusal(p_world, p_uid, p_action, p_target);
  if why is not null then return why; end if;$o$,
  $n$  why := lair_refusal(p_world, p_uid, p_action, p_target);
  if why is not null then return why; end if;
  -- An outcropping is mined and nothing else (`outcrop_refusal`).
  why := outcrop_refusal(p_world, p_uid, p_action, p_target);
  if why is not null then return why; end if;$n$);

select pg_temp.patch_fn('act_refusal_rules(uuid, uuid, text, jsonb)',
  $o$  if swirl_action(p_action) then
    return swirl_refusal(p_world, p_uid, p_action, p_target);
  end if;$o$,
  $n$  if swirl_action(p_action) then
    return swirl_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- And Mine at an outcropping, for its own reach and tool, and whether it is still there (`outcrops.ts`).
  if outcrop_action(p_action) then
    return outcrop_refusal(p_world, p_uid, p_action, p_target);
  end if;$n$);

select pg_temp.patch_fn('act_perform(uuid, uuid, text, jsonb)',
  $o$  if swirl_action(p_action) then
    perform perform_swirl(p_world, p_uid, p_action, p_target);
    return;
  end if;$o$,
  $n$  if swirl_action(p_action) then
    perform perform_swirl(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- Mine, at an outcropping (`outcrops.ts`).
  if outcrop_action(p_action) then
    perform perform_outcrop(p_world, p_uid, p_action, p_target);
    return;
  end if;$n$);

select pg_temp.patch_fn('examine_tile_text(uuid, integer, integer, uuid)',
  $o$  v_extra := v_extra || lair_says(p_world, p_x, p_y);$o$,
  $n$  v_extra := v_extra || lair_says(p_world, p_x, p_y);
  -- And an outcropping on it, with its uses left (`outcrop_says`).
  v_extra := v_extra || outcrop_says(p_world, p_x, p_y);$n$);

-- The day's outcroppings with the day's swirls, after the woods.
select pg_temp.patch_fn('tree_tick()',
  $o$    if v_grew is not null then perform swirl_day(v_world); end if;$o$,
  $n$    if v_grew is not null then perform swirl_day(v_world); end if;
    -- And the day's outcroppings in place of yesterday's (`outcrop_day`).
    if v_grew is not null then perform outcrop_day(v_world); end if;$n$);

-- Every island standing has its first now, rather than at its next daily reset.
select outcrop_day(w.id) from world w where w.ready;

select private.lock_doors();
