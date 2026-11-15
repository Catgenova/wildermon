-- Volcano Isle as a place to fight, part one: its monsters, obsidian, a seryll vein's summons, sulfur, fire-tempered steel.
--
-- Asked for: new harder monsters that live only on Volcano Isle; obsidian only off monsters killed there; mining seryll
-- with a chance to summon monsters; sulfur and fire-tempered steel. The numbers are the defs' (`volcano.ts`,
-- `lairs.ts`, `creatures.ts`); the rules are here:
--
--   * three kinds, each at a vent of its own (`lair_kinds`: ash vent, magma vent, cinder vent, two of each), sited on
--     the island by its kind (`monster_isle`) on ground with no tree within `vent_clear` (`lair_site_ok`, site
--     `vent`), garrisoned, leashed, bossed, hoarded and restocked by the lairs' own rules;
--   * an ash wraith's blow that lands puts your hit chance at `ash_blind_hit` for `ash_blind_secs` (`ash_blind_put`,
--     `ash_blind_of` in `hit_chance`); burns do nothing to a magma golem (`class_burn`), and a weapon carrying an ice
--     enchantment lands `frost_weak` times its blow on it (`frost_bane`);
--   * a monster's carcass carries the island it was killed on in its `mark` (`died_on_key`), and one killed on
--     Volcano Isle gives its kind's obsidian when butchered (`carcass_obsidian`), at the butchering share;
--   * a go at a seryll vein on the island summons `summon_least`..`summon_most` of one of its kinds at `seryll_summon`
--     (`volcano_mined`, `seryll_summon_at`), round the miner, leashed to the spot and gone after `summon_secs`
--     (`creature.gone_at`, `summon_sweep` on the lairs' clock); none where the spot is in a settlement, the safe ring or
--     a Sanctuary (`summon_refused`);
--   * a go at slate on the island gives sulfur at `sulfur_slate`; and fire-tempered steel is made at a smelter on the
--     island only (`recipe.isle`, `craft_refusal`), its weapons and tools bettered `fire_steel_cap` past the skill
--     (`fire_steel_cap`, `improve_ceiling`'s callers).

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

/** When a summoned one goes, unless it is killed first (`summon_secs`); null for everything else. */
alter table creature add column if not exists gone_at timestamptz;
create index if not exists creature_gone on creature (world_id, gone_at) where gone_at is not null;

/* ---- The vents ------------------------------------------------------------------------------------------------- */

-- A vent: on its kind's island (`monster_isle`, already asked), with no tree within `vent_clear`, and its whole leash on
-- that island too, so none of its garrison ever stands on another.
select pg_temp.patch_fn('lair_site_ok(uuid, text, integer, integer, integer)',
  $o$    else true end;$o$,
  $n$    when 'vent' then not near_tile(p_world, p_x, p_y, 'trees', vent_clear()::int)
                     and not exists (select 1 from generate_series(0, 7) q
                                      where region_at(p_world, p_x + 0.5 + cos(q * pi() / 4) * lair_leash(), p_y + 0.5 + sin(q * pi() / 4) * lair_leash())
                                            is distinct from monster_isle(k.species))
    else true end;$n$);

-- A kind kept to an island looks on that island's chart cells, not the whole map: a vent's island is a tenth of it.
select pg_temp.patch_fn('lair_site(uuid, text, integer, integer)',
  $o$declare k record; v_size int; v_step int; v_fine int; i int; gx int; gy int; c record; f record; v_isle int;$o$,
  $n$declare v_cells int[]; v_c int; k record; v_size int; v_step int; v_fine int; i int; gx int; gy int; c record; f record; v_isle int;$n$);
select pg_temp.patch_fn('lair_site(uuid, text, integer, integer)',
  $o$      gx := 2 + floor(random() * (v_size - 4))::int;
      gy := 2 + floor(random() * (v_size - 4))::int;$o$,
  $n$      -- On its island's chart cells (`monster_isle`), for a kind kept to one; anywhere for any other.
      if i = 1 and monster_isle(k.species) is not null then
        v_cells := array(select r.cy * 256 + a from chart_region r cross join generate_series(0, 255) a
                          where get_byte(r.cells, a) = monster_isle(k.species));
      end if;
      if cardinality(v_cells) > 0 then
        v_c := v_cells[1 + floor(random() * cardinality(v_cells))::int];
        gx := least(v_size - 3, greatest(2, floor(((v_c % 256) + random()) * v_size / 256)::int));
        gy := least(v_size - 3, greatest(2, floor(((v_c / 256) + random()) * v_size / 256)::int));
      else
        gx := 2 + floor(random() * (v_size - 4))::int;
        gy := 2 + floor(random() * (v_size - 4))::int;
      end if;$n$);

/* ---- An ash wraith's blow -------------------------------------------------------------------------------------- */

/** Your hit chance's share while an ash wraith's blow holds (`ash_blind_hit`); one otherwise. */
create or replace function ash_blind_of(p_world uuid, p_uid uuid) returns double precision language sql stable as $$
  select coalesce((select ash_blind_hit() from player p where p.world_id = p_world and p.uid = p_uid
                     and (p.blessings->'ash_blind'->>'until')::timestamptz > now()), 1)
$$;

/** A blow that landed from a kind that blinds (`species_def.blinds`): `ash_blind_secs` of it from now, said. */
create or replace function ash_blind_put(p_world uuid, p_uid uuid, p_from creature) returns boolean language plpgsql as $$
begin
  if p_from.id is null or not coalesce((select sd.blinds from species_def sd where sd.id = p_from.species), false) then return false; end if;
  update player set blessings = coalesce(blessings, '{}'::jsonb) || jsonb_build_object('ash_blind',
      jsonb_build_object('until', now() + make_interval(secs => ash_blind_secs()), 'hit', ash_blind_hit()))
    where world_id = p_world and uid = p_uid;
  perform tell(p_world, p_uid, 'Blinded: hit chance ×' || ash_blind_hit() || ', ' || ash_blind_secs()::int || ' s.', 'fight');
  return true;
end $$;

select pg_temp.patch_fn('hurt_player(uuid, uuid, double precision, text, text)',
  $o$  perform sitting_struck(p_world, p_uid);$o$,
  $n$  perform sitting_struck(p_world, p_uid);
  -- And an ash wraith's blinding, from a kind that blinds (`ash_blind_put`).
  perform ash_blind_put(p_world, p_uid, v_from);$n$);

select pg_temp.patch_fn('hit_chance(uuid, uuid, text, double precision)',
  $o$    * coalesce(p_aim, 1)$o$,
  $n$    * coalesce(p_aim, 1)
    -- And an ash wraith's blinding (`ash_blind_of`), inside the ceiling too.
    * ash_blind_of(p_world, p_uid)$n$);

/* ---- A magma golem: no burns, and ice bites ------------------------------------------------------------------- */

select pg_temp.patch_fn('class_burn(uuid, uuid, integer, double precision, double precision)',
  $o$  if c.id is null or pl.uid is null or p_each <= 0 or p_secs <= 0 or faith_truce(p_world, creature_x(c), creature_y(c)) then$o$,
  $n$  if c.id is null or pl.uid is null or p_each <= 0 or p_secs <= 0 or faith_truce(p_world, creature_x(c), creature_y(c))
     -- Nor on a kind that burns do nothing to (`species_def.fireproof`).
     or coalesce((select sd.fireproof from species_def sd where sd.id = c.species), false) then$n$);

/** What a weapon in hand makes of a kind ice bites (`species_def.frost_weak`): `frost_weak` with an ice enchantment on it. */
create or replace function frost_bane(p_held item, d species_def) returns double precision language sql stable as $$
  select case when coalesce(d.frost_weak, false) and p_held.id is not null and p_held.enchant is not null
                   and exists (select 1 from enchantments() e where e.id = p_held.enchant->>'id' and e.mote = ice_mote_id())
              then frost_weak() else 1 end
$$;
-- A blow and a shot.
select pg_temp.patch_fn('perform_fight(uuid, uuid, text, jsonb)',
  $o$* faith_arms(p_world, p_uid, d)$o$,
  $n$* faith_arms(p_world, p_uid, d) * frost_bane(held, d)$n$, 2);

/* ---- Where a monster died, and its obsidian -------------------------------------------------------------------- */

select pg_temp.patch_fn('wound_beast(uuid, integer, double precision, double precision, double precision, uuid, integer)',
  $o$declare v_dealer uuid; c creature; d species_def;$o$,
  $n$declare v_corpse bigint; v_dealer uuid; c creature; d species_def;$n$);
select pg_temp.patch_fn('wound_beast(uuid, integer, double precision, double precision, double precision, uuid, integer)',
  $o$  perform drop_on_ground(p_world, floor(cx)::int, floor(cy)::int, 'corpse',
    (15 + random() * 35) * v_size, d.name);$o$,
  $n$  v_corpse := drop_on_ground(p_world, floor(cx)::int, floor(cy)::int, 'corpse',
    (15 + random() * 35) * v_size, d.name);
  -- A monster's carries the island it was killed on, for its obsidian (`carcass_obsidian`).
  if d.monster then
    update item set mark = jsonb_build_object(died_on_key(), region_at(p_world, cx, cy)) where id = v_corpse;
  end if;$n$);

/** The obsidian a carcass holds before the butchering share: its kind's for a monster killed on Volcano Isle, else none. */
create or replace function carcass_obsidian(p_corpse item) returns int language sql stable as $$
  select coalesce((select obsidian_of(sd.id) from species_def sd
                    where sd.id = (corpse_species(p_corpse.extra)).id and sd.monster
                      and (p_corpse.mark->>died_on_key())::int = volcano_isle()), 0)
$$;

/** What a butchering takes of `n` at a share, as it takes a part: the whole of it, and the rest a chance at one more. */
create or replace function share_cut(p_n double precision, p_share double precision, p_roll double precision) returns int
language sql immutable as $$
  select (floor(p_n * p_share) + case when p_roll < p_n * p_share - floor(p_n * p_share) then 1 else 0 end)::int
$$;

select pg_temp.patch_fn('perform_fight(uuid, uuid, text, jsonb)',
  $o$    -- And bait for the hook out of what is left (a Cook's Bait Maker), into the pack.$o$,
  $n$    -- And obsidian, off a monster killed on Volcano Isle (`carcass_obsidian`), at the share a part is taken at.
    v_n := share_cut(carcass_obsidian(corpse), v_share, random());
    if v_n > 0 then
      perform gather(p_world, p_uid, 'obsidian', v_n, greatest(1, least(100, made_ql)));
      taken := taken || (case when v_n > 1 then v_n || ' × ' else '' end || lower((select name from item_def where id = 'obsidian')));
    end if;
    -- And bait for the hook out of what is left (a Cook's Bait Maker), into the pack.$n$);

/* ---- A seryll vein's summons ----------------------------------------------------------------------------------- */

/** Whether nothing is summoned at a spot: in a settlement, the safe ring or a Sanctuary. */
create or replace function summon_refused(p_world uuid, p_x double precision, p_y double precision) returns boolean
language sql stable as $$
  select at_peace(p_world, p_x, p_y) or on_deed(p_world, floor(p_x)::int, floor(p_y)::int)
$$;

/**
 * `p_n` of a kind summoned round a body: each on standing ground `summon_near` to `summon_near` + `summon_spread` tiles
 * from them and nowhere refused, or where they stand; leashed to that spot, at home there, gone after `summon_secs`
 * and after them. None at all where the spot is refused (`summon_refused`). Said to them; how many stood up.
 */
create or replace function seryll_summon_at(p_world uuid, p_uid uuid, p_kind text, p_n int) returns int language plpgsql as $$
declare p player; i int; j int; v_a double precision; v_r double precision; gx double precision; gy double precision;
        v_id int; v_put int := 0;
begin
  select * into p from player pl where pl.world_id = p_world and pl.uid = p_uid;
  if p.uid is null or summon_refused(p_world, p.x, p.y) then return 0; end if;
  for i in 1 .. p_n loop
    gx := null;
    for j in 1 .. 12 loop
      v_a := random() * 2 * pi();
      v_r := summon_near() + random() * summon_spread();
      gx := p.x + cos(v_a) * v_r;
      gy := p.y + sin(v_a) * v_r;
      exit when creature_tile_ok(p_world, floor(gx)::int, floor(gy)::int) and not has_water(p_world, floor(gx)::int, floor(gy)::int)
        and not summon_refused(p_world, gx, gy);
      gx := null;
    end loop;
    if gx is null then gx := p.x; gy := p.y; end if;
    v_id := creature_spawn(p_world, p_kind, gx, gy, 'wild');
    if v_id is null then continue; end if;
    update creature set leash_x = p.x, leash_y = p.y, home_x = p.x, home_y = p.y,
        gone_at = now() + make_interval(secs => summon_secs())
      where world_id = p_world and id = v_id;
    perform engage_beast(p_world, v_id, p_uid);
    v_put := v_put + 1;
  end loop;
  if v_put > 0 then
    perform tell(p_world, p_uid, 'Summoned (seryll vein): ' || v_put || ' × ' || lower((select sd.name from species_def sd where sd.id = p_kind))
      || '; gone in ' || (summon_secs() / 60)::int || ' minutes.', 'fight');
  end if;
  return v_put;
end $$;

/**
 * A go of mining that brought something out of a tile of Volcano Isle: at a seryll vein, `seryll_summon` to summon
 * `summon_least`..`summon_most` of one of its kinds (`volcano_kinds`); at slate, `sulfur_slate` for a sulfur. How
 * many were summoned.
 */
create or replace function volcano_mined(p_world uuid, p_uid uuid, p_x int, p_y int, p_yields text, p_ql double precision)
returns int language plpgsql as $$
declare v_kinds text[] := volcano_kinds();
begin
  if region_at(p_world, p_x + 0.5, p_y + 0.5) is distinct from volcano_isle() then return 0; end if;
  if p_yields = sulfur_stone() and random() < sulfur_slate() then
    perform gather(p_world, p_uid, 'sulfur', 1, p_ql);
    perform tell(p_world, p_uid, 'Found: sulfur, QL ' || to_char(p_ql, 'FM990.0') || '.', 'event');
  end if;
  if p_yields <> seryll_ore_id() or random() >= seryll_summon() then return 0; end if;
  return seryll_summon_at(p_world, p_uid, v_kinds[1 + floor(random() * cardinality(v_kinds))::int],
    (summon_least() + floor(random() * (summon_most() - summon_least() + 1)))::int);
end $$;

select pg_temp.patch_fn('perform_terrain(uuid, uuid, text, jsonb)',
  $o$    perform enchant_more(p_world, p_uid, 'pickaxe', 'lode', yields, made_ql);$o$,
  $n$    perform enchant_more(p_world, p_uid, 'pickaxe', 'lode', yields, made_ql);
    -- And on Volcano Isle, a seryll vein's summons and sulfur out of its slate (`volcano_mined`).
    perform volcano_mined(p_world, p_uid, tx, ty, yields, made_ql);$n$);

/** The summoned ones of an island whose time is up, gone, and nothing left fighting them. How many. */
create or replace function summon_sweep(p_world uuid) returns int language plpgsql as $$
declare v_ids int[];
begin
  with gone as (delete from creature c where c.world_id = p_world and c.gone_at is not null and c.gone_at <= now() returning c.id)
  select array_agg(id) into v_ids from gone;
  if v_ids is null then return 0; end if;
  update creature set enemy = null where world_id = p_world and enemy = any (v_ids);
  return cardinality(v_ids);
end $$;

select pg_temp.patch_fn('lair_tick(uuid)',
  $o$  for k in select * from lair_kinds() order by keep_off desc loop$o$,
  $n$  -- And the summoned ones whose time is up, gone (`summon_sweep`).
  perform summon_sweep(p_world);
  for k in select * from lair_kinds() order by keep_off desc loop$n$);

/* ---- Fire-tempered steel --------------------------------------------------------------------------------------- */

-- Made only standing on its island (`recipe.isle`).
select pg_temp.patch_fn('craft_refusal(uuid, uuid, text, bigint)',
  $o$  if r.station is not null and not at_station(p_world, p_uid, r.station) then
    return 'Need: ' || station_name(r.station) || '.';
  end if;$o$,
  $n$  if r.station is not null and not at_station(p_world, p_uid, r.station) then
    return 'Need: ' || station_name(r.station) || '.';
  end if;
  -- And on its island, for one kept to an island (`Recipe.isle`).
  if r.isle is not null and (select region_at(p_world, pl.x, pl.y) from player pl where pl.world_id = p_world and pl.uid = p_uid)
       is distinct from r.isle then
    return 'Need: ' || coalesce(station_name(r.station), 'to be') || ' on ' || isle_name(r.isle) || '.';
  end if;$n$);

/** What a weapon or a tool of fire-tempered steel may be bettered past the skill (`fire_steel_cap`); none for anything else. */
create or replace function fire_steel_cap(p_def text, p_extra text) returns double precision language sql stable as $$
  select case when p_extra = fire_steel_name()
                   and (exists (select 1 from weapon_def w where w.id = p_def)
                        or exists (select 1 from item_def i where i.id = p_def and i.category = 'tool'))
              then fire_steel_cap() else 0 end
$$;
select pg_temp.patch_fn('item_refusal(uuid, uuid, text, jsonb)',
  $o$improve_ceiling(p_world, p_uid, v_what.skill, v_it.rare)$o$,
  $n$improve_ceiling(p_world, p_uid, v_what.skill, v_it.rare) + fire_steel_cap(v_it.def, v_it.extra)$n$);
select pg_temp.patch_fn('perform_item(uuid, uuid, text, jsonb)',
  $o$improve_ceiling(p_world, p_uid, v_what.skill, v_it.rare)$o$,
  $n$improve_ceiling(p_world, p_uid, v_what.skill, v_it.rare) + fire_steel_cap(v_it.def, v_it.extra)$n$);

select private.lock_doors();
