-- Skill gates, the second set: wagons by driving, boats by sailing, plain stone quarried by mining, and the gates that
-- were already there (seams by mining, kinds by taming, fish by fishing) moved onto the one rule with their numbers kept;
-- and veins named by prospecting.
--
-- Asked for: "Gate using wagons until driving level 30. Gate boat type use by sailing level", the existing gates on the
-- one rule keeping their numbers ("6 8 12 etc"), and "prospecting will still show all glowing veins, but anything above
-- the prospect gates just shows as unidentified metals".
--
-- Every gate is a row of `skill_gate` (`src/game/skillgates.ts`, emitted by `npm run defs`):
--   * vehicle wagon: driving 30, at the reins (`helm_gate_refusal`); the carts are open;
--   * boat: rowing boat 1, sailing boat 20, caravel 50 by sailing, at the helm or the oars; a passenger boards freely;
--   * seam: what `rock_def.level` held, by what the seam yields; Ore Sense lowers it (`ore:below`), the Ironemole line
--     mines any (`any_seam`); `rock_def.level` is emitted from the gate, so a miner's `worker_gatherable`, `mine_idle`
--     and `seam_beyond` read the same numbers;
--   * stone: rock 1, sandstone 10, slate 20, marble 30 by mining, on a bare face (`face_gate_refusal`) and for a
--     quarrier at its own level (`stone_gate`, `stone_idle`);
--   * tame: each kind's first-stage taming, `wild_stage_tame` a stage on top (`tame_needs`); refused in the one rule's
--     words by its stage's name (`tame_gate_refusal`): "Sapgnaw: needs taming 1; have 0.4.";
--   * fish: kept as `fish_def.level` reads it, a pool filter, never a refusal;
--   * vein: each seam's mining level, by prospecting: under it a vein is marked and glows as any other and is called
--     "Unidentified metal" (`seen_vein`, `vein_tip`), per viewer.

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

/* ---- Wagons and boats ---------------------------------------------------------------------------------------------- */

-- Taking the reins of a wagon or the helm or oars of a boat, at its gate (`helmGate`), or null: none, met, or a cart.
create or replace function helm_gate_refusal(p_world uuid, p_uid uuid, p placed) returns text
language sql stable as $$
  select skill_gate_refusal(g.name, g.skill, skill_of(p_world, p_uid, g.skill), g.level)
    from skill_gate g where g.kind in ('vehicle', 'boat') and g.id = p.sub
$$;

-- Asked after "Already driving.", as the browser's `board_vehicle` asks it. Boarding as a passenger is not asked.
select pg_temp.patch_fn('ride_refusal(uuid,uuid,text,jsonb)',
$o$    if (driving(p_world, p_uid)).id is not null then return 'Already driving.'; end if;
    -- A padlock on her keeps her helm, or the reins, to whoever has its key.$o$,
$n$    if (driving(p_world, p_uid)).id is not null then return 'Already driving.'; end if;
    -- A wagon's reins at its driving, a boat's helm or oars at its sailing (`skillgates.ts`).
    if helm_gate_refusal(p_world, p_uid, p) is not null then return helm_gate_refusal(p_world, p_uid, p); end if;
    -- A padlock on her keeps her helm, or the reins, to whoever has its key.$n$);

/* ---- Rock: seams and plain faces by mining ------------------------------------------------------------------------- */

-- A bare face's mining gate for a person (`faceGateRefusal`): a seam's, less Ore Sense, or a plain stone's; null for
-- none, met, or ground that is not bare rock.
create or replace function face_gate_refusal(p_world uuid, p_uid uuid, p_x int, p_y int) returns text
language plpgsql stable as $$
declare r rock_def; g skill_gate;
begin
  if land_tile(p_world, p_x, p_y) <> tile_id('Rock') then return null; end if;
  r := bedrock_at(p_world, p_x, p_y);
  g := skill_gate_of(case when r.seam then 'seam' else 'stone' end, r.yields);
  if g.kind is null then return null; end if;
  return skill_gate_refusal(r.name, g.skill, skill_of(p_world, p_uid, g.skill),
    case when r.seam then greatest(0, g.level - pk(p_world, p_uid, 'ore:below', 0))::int else g.level end);
end $$;

-- Mine and Chip corner: the one check, for a seam and for a plain face alike.
select pg_temp.patch_fn('terrain_refusal(uuid,uuid,text,jsonb)',
$o$    -- A seam only gives up its metal to somebody who knows how to take it.
    if land_tile(p_world, tx, ty) = 4 then
      r := bedrock_at(p_world, tx, ty);
      mining := skill_of(p_world, p_uid, 'mining');
      -- Less of it for a Miner's Ore Sense.
      v_needs := greatest(0, r.level - pk(p_world, p_uid, 'ore:below', 0));
      if r.ore and mining < v_needs then
        -- `FM990.9` leaves "5." on a whole number, which reads as a typo in the
        -- middle of a sentence. The browser prints the number as it is.
        return r.name || ': needs mining ' || rtrim(rtrim(to_char(v_needs, 'FM990.99'), '0'), '.')
          || '; have ' || to_char(mining, 'FM990.0') || '.';
      end if;
    end if;$o$,
$n$    -- A seam gives up its metal, and a plain face its stone, only at its gate (`skillgates.ts`), a seam's less Ore Sense.
    if face_gate_refusal(p_world, p_uid, tx, ty) is not null then return face_gate_refusal(p_world, p_uid, tx, ty); end if;$n$);

-- The gate on a face a quarrier cuts, bare or under snow: its plain stone's; no row for a seam (`quarryGate`).
create or replace function stone_gate(p_world uuid, p_x int, p_y int) returns skill_gate
language sql stable as $$
  select g.* from skill_gate g, bedrock_at(p_world, p_x, p_y) r
   where not r.seam and g.kind = 'stone' and g.id = r.yields
$$;

-- A quarrier takes only a face its own level may cut.
select pg_temp.patch_fn('worker_gatherable(uuid,integer,integer,text,creature)',
$o$    return here in (tile_id('Rock'), tile_id('Snow')) and not rock.seam and rock_height(p_world, p_x, p_y) > -mine_depth()
       and face_reach(p_world, p_x, p_y);$o$,
$n$    return here in (tile_id('Rock'), tile_id('Snow')) and not rock.seam and rock_height(p_world, p_x, p_y) > -mine_depth()
       and face_reach(p_world, p_x, p_y) and worker_gate_open(c, stone_gate(p_world, p_x, p_y));$n$);

-- And never cuts one over it, however it came to be at one.
select pg_temp.patch_fn('worker_do(uuid,integer)',
$o$    rock := bedrock_at(p_world, wx, wy);
    got := case when kind = 'mine' and rock.seam then rock.yields$o$,
$n$    rock := bedrock_at(p_world, wx, wy);
    if kind = 'quarry' and not worker_gate_open(c, stone_gate(p_world, wx, wy)) then return null; end if;
    got := case when kind = 'mine' and rock.seam then rock.yields$n$);

-- Why a quarrier with no face to cut is idle, past its range: a plain face over its own level, the lowest gate then the
-- nearest (`gate`, idle_what ['stone', yields], n its tiles off), as `gate_idle` says a tree. The browser's `stoneIdle`.
create or replace function stone_idle(p_world uuid, p_cx int, p_cy int, p_range int, c creature,
                                      out why text, out n double precision, out what text[])
returns record language plpgsql stable as $fn$
declare v_may boolean[]; v_w int := 2 * p_range + 1; v_best int; v_d int; v_id text; r record; g skill_gate;
begin
  if p_range < 0 then return; end if;
  v_may := private.work_tile_may(p_world, p_cx, p_cy, p_range, 'quarry', c.id);
  if v_may is null then return; end if;
  for r in
    select p_cx + t.dx as gx, p_cy + t.dy as gy, greatest(abs(t.dx), abs(t.dy)) as d
      from (select (u.i - 1)::int % v_w - p_range as dx, (u.i - 1)::int / v_w - p_range as dy
              from unnest(v_may) with ordinality u(m, i) where u.m) t
  loop
    if land_tile(p_world, r.gx, r.gy) not in (tile_id('Rock'), tile_id('Snow')) then continue; end if;
    if c.keeper is not null and not private.worker_ground(p_world, c.keeper, r.gx, r.gy) then continue; end if;
    g := stone_gate(p_world, r.gx, r.gy);
    if worker_gate_open(c, g) then continue; end if;
    if v_best is not null and (g.level > v_best or (g.level = v_best and r.d >= v_d)) then continue; end if;
    if rock_height(p_world, r.gx, r.gy) <= -mine_depth() or not face_reach(p_world, r.gx, r.gy) then continue; end if;
    v_best := g.level; v_d := r.d; v_id := g.id;
  end loop;
  if v_best is not null then
    why := 'gate'; n := v_d; what := array['stone', v_id];
  end if;
end $fn$;

-- An idle quarrier says what is wrong with the faces it has; anything else idle keeps what it said.
select pg_temp.patch_fn('worker_settle(uuid,integer)',
$o$        -- All of it in reach worked and on its wait: the seconds till the soonest is back (`worker_wait_left`).$o$,
$n$        if kind = 'quarry' then
          select * into v_mi from stone_idle(p_world, v_site.x, v_site.y, v_site.radius, c);
          if v_mi.why is not null then c.idle_why := v_mi.why; c.idle_n := v_mi.n; c.idle_what := v_mi.what; end if;
        end if;
        -- All of it in reach worked and on its wait: the seconds till the soonest is back (`worker_wait_left`).$n$);

/* ---- Taming ---------------------------------------------------------------------------------------------------------- */

-- What winning one over asks at its stage: its kind's taming gate, `wild_stage_tame` more a stage past its first. A kind
-- with no gate (a monster, a hybrid: never tamed) keeps its own (`tameNeeds`).
create or replace function tame_needs(c creature, out level double precision, out chance double precision)
returns record language sql stable as $$
  select coalesce((select g.level from skill_gate g where g.kind = 'tame' and g.id = sd.id), sd.tame_level)
           + wild_stage_tame() * stage_of(c),
         sd.tame_chance * wild_stage_chance() ^ stage_of(c)
    from species_def sd where sd.id = c.species
$$;

-- Taming one, or taking it out of a trap, under its gate at its stage, by its stage's name (`tameRefusal`).
create or replace function tame_gate_refusal(c creature, p_have double precision) returns text
language sql stable as $$
  select skill_gate_refusal(kind_name_at(c), 'taming', p_have, (tame_needs(c)).level::int)
$$;

select pg_temp.patch_fn('creature_refusal(uuid,uuid,text,jsonb)',
$o$    if skill_of(p_world, p_uid, 'taming') < (tame_needs(c)).level then
      return 'Need taming ' || to_char((tame_needs(c)).level, 'FM990.#') || '.';
    end if;$o$,
$n$    if tame_gate_refusal(c, skill_of(p_world, p_uid, 'taming')) is not null then
      return tame_gate_refusal(c, skill_of(p_world, p_uid, 'taming'));
    end if;$n$);

select pg_temp.patch_fn('trap_refusal(uuid,uuid,text,jsonb)',
$o$    if skill_of(p_world, p_uid, 'taming') < (tame_needs(c)).level then
      return 'Need taming ' || to_char((tame_needs(c)).level, 'FM990')
        || ' to handle a ' || lower(s.name) || '. Still held.';
    end if;$o$,
$n$    if tame_gate_refusal(c, skill_of(p_world, p_uid, 'taming')) is not null then
      return tame_gate_refusal(c, skill_of(p_world, p_uid, 'taming'));
    end if;$n$);

/* ---- Veins, named by prospecting ----------------------------------------------------------------------------------- */

-- Why a vein is "Unidentified metal" to somebody: "5 prospecting required to identify this vein.", or null (`veinTip`).
create or replace function vein_tip(p_world uuid, p_uid uuid, r rock_def) returns text
language sql stable as $$
  select g.level || ' ' || lower(coalesce((select s.name from skill_def s where s.id = g.skill), g.skill))
         || ' required to identify this vein.'
    from skill_gate g where g.kind = 'vein' and g.id = r.yields and skill_of(p_world, p_uid, g.skill) < g.level
$$;

-- A vein's name as somebody sees it: its own at or over its prospecting gate, else "Unidentified metal" (`seenVein`).
create or replace function seen_vein(p_world uuid, p_uid uuid, r rock_def) returns text
language sql stable as $$
  select case when vein_tip(p_world, p_uid, r) is null then r.name else 'Unidentified metal' end
$$;

-- Prospect: the tally and the reading where you stand, by your prospecting.
select pg_temp.patch_fn('perform_ground(uuid,uuid,text,jsonb)',
$o$    for v_row in select x, y, (bedrock_at(p_world, x, y)).name as nm$o$,
$n$    for v_row in select x, y, seen_vein(p_world, p_uid, bedrock_at(p_world, x, y)) as nm$n$);
select pg_temp.patch_fn('perform_ground(uuid,uuid,text,jsonb)',
$o$    if v_rock.seam then
      perform tell(p_world, p_uid, 'Here: ' || lower(v_rock.name)$o$,
$n$    if v_rock.seam and vein_tip(p_world, p_uid, v_rock) is not null then
      perform tell(p_world, p_uid, 'Here: ' || lower(seen_vein(p_world, p_uid, v_rock)) || '. '
        || vein_tip(p_world, p_uid, v_rock) || ' Max QL ' || to_char(v_ql, 'FM990') || '.' || v_buried, 'event');
    elsif v_rock.seam then
      perform tell(p_world, p_uid, 'Here: ' || lower(v_rock.name)$n$);

-- A prospector's find, told to its keeper by the keeper's prospecting (`Game.readGround`).
create or replace function read_ground(p_world uuid, p_id int, p_x int, p_y int, p_radius int) returns int
language plpgsql as $$
declare c creature; v_size int; v_tiles int[] := '{}'; v_names text[] := '{}'; v_row record;
begin
  select * into c from creature where world_id = p_world and id = p_id;
  if not found or c.keeper is null then return 0; end if;
  v_size := (select size from world where id = p_world);
  for v_row in select x, y, seen_vein(p_world, c.keeper, bedrock_at(p_world, x, y)) as nm
    from generate_series(greatest(0, p_x - p_radius), least(v_size - 1, p_x + p_radius)) x
    cross join generate_series(greatest(0, p_y - p_radius), least(v_size - 1, p_y + p_radius)) y
    where land_tile(p_world, x, y) = tile_id('Rock') and (bedrock_at(p_world, x, y)).ore
    order by y, x
  loop
    v_tiles := v_tiles || (v_row.y * v_size + v_row.x);
    v_names := v_names || lower(v_row.nm);
  end loop;
  if coalesce(array_length(v_tiles, 1), 0) = 0 then return 0; end if;
  perform mark_prospected(p_world, c.keeper, v_tiles);
  perform wtell(p_world, c.keeper, c.name || ' found ore: '
    || (select string_agg(distinct nm, ', ') from unnest(v_names) nm) || '.', 'event');
  return array_length(v_tiles, 1);
end $$;

select private.lock_doors();
