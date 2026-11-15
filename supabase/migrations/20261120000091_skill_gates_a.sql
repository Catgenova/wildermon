-- Skill gates, batch A: trees re-placed, sprouts and crops gated, a worker at its own level in the gate's skill, and
-- unidentified items.
--
-- Asked for: birch at 1 and willow at 90 (the table is `skillgates.ts`, emitted to `skill_gate`); sowing gated by
-- farming per crop and a species' sprouts by forestry, for you and for the farmers, planter tenders, sprout pickers
-- and planters that do it; a worker checks a gate's own skill at its own level in that skill ("a hod carrier fitting a
-- plank wall checks its carpentry"); and "items picked up that you cant use yet show as "unidentified "".
--
-- A gate a seed or a sprout is under (`skill_gate_item`, emitted from `GATED_ITEMS`) makes the item unidentified to
-- whoever is under it: `seen_name` names it "Unidentified seed" for them, `identify_said` says only "30 farming required
-- to identify this seed.", and every line this island writes naming one of them names it for the person it is told to.
-- Gathering, picking up, carrying, storing and trading one stay open; only its use is gated (`item_gate_refusal`).
-- Harvesting a crop in the ground is anybody's.

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

-- The table, in case this lands before the definitions that make it (they make it the same way).
create table if not exists skill_gate_item (
  item text not null, extra text not null, kind text not null, id text not null, noun text not null, primary key (item, extra)
);

/* ---- A worker at its own level in the gate's skill ------------------------------------------------------------- */

-- A worker's level in a skill: its own, 1 where it has none (`workerLevel`).
create or replace function worker_level(c creature, p_skill text) returns double precision
language sql stable as $$
  select coalesce((c.skills->>p_skill)::double precision, 1)
$$;

-- Its own level in the gate's skill meets the gate, or there is no gate (`workerGateOpen`). Not its trade's: a hod
-- carrier fitting a plank wall reads its carpentry.
create or replace function worker_gate_open(c creature, g skill_gate) returns boolean
language sql stable as $$
  select g.kind is null or worker_level(c, g.skill) >= g.level
$$;

-- An idle worker's hour to its keeper names its level in the gate's skill.
select pg_temp.patch_fn('worker_idle(uuid,creature,text,integer,integer,integer,bigint)',
$o$skill_gate_refusal(g.name, g.skill, task_skill(c), g.level)$o$,
$n$skill_gate_refusal(g.name, g.skill, worker_level(c, g.skill), g.level)$n$);

/* ---- Sprouts, by forestry ---------------------------------------------------------------------------------------- */

-- A tree tile's species' sprout gate (`sproutGate`).
create or replace function sprout_gate(p_data int) returns skill_gate
language sql stable as $$
  select g.* from skill_gate g join tree_def t on g.kind = 'sprout' and g.id = lower(t.name) where t.id = tree_species(p_data)
$$;

-- Picking a tree tile's sprouts: your refusal, or null (`sproutGateRefusal`).
create or replace function sprout_gate_refusal(p_world uuid, p_uid uuid, p_data int) returns text
language plpgsql stable as $$
declare g skill_gate;
begin
  g := sprout_gate(p_data);
  if g.kind is null then return null; end if;
  return skill_gate_refusal(g.name, g.skill, skill_of(p_world, p_uid, g.skill), g.level);
end $$;

/* ---- Items a gate stops the use of: unidentified under it -------------------------------------------------------- */

-- The gate on an item's use, by its def and its `extra` where that says which (`itemGate`).
create or replace function item_gate(p_def text, p_extra text) returns skill_gate
language sql stable as $$
  select g.* from skill_gate_item x join skill_gate g on g.kind = x.kind and g.id = x.id
   where x.item = p_def and x.extra in (lower(coalesce(p_extra, '')), '')
   order by x.extra desc limit 1
$$;

-- What an unidentified one of these is called for this person, or null: they know it (`unidentified`).
create or replace function unidentified_name(p_world uuid, p_uid uuid, p_def text, p_extra text) returns text
language sql stable as $$
  select 'Unidentified ' || x.noun from skill_gate_item x join skill_gate g on g.kind = x.kind and g.id = x.id
   where x.item = p_def and x.extra in (lower(coalesce(p_extra, '')), '')
     and skill_of(p_world, p_uid, g.skill) < g.level
   order by x.extra desc limit 1
$$;

-- An item's name as this person sees it: "Unidentified seed" under its gate, `item_name` at it (`seenName`). Every
-- name of an item told to a person goes through one of these two.
create or replace function seen_name(p_world uuid, p_uid uuid, it item) returns text
language sql stable as $$
  select coalesce(unidentified_name(p_world, p_uid, it.def, it.extra), item_name(it))
$$;

-- And of a def, where the line makes its own name of it (`p_name`, as it always has): that, or "Unidentified seed".
create or replace function seen_name(p_world uuid, p_uid uuid, p_def text, p_extra text, p_name text) returns text
language sql stable as $$
  select coalesce(unidentified_name(p_world, p_uid, p_def, p_extra), p_name)
$$;

-- What an unidentified item says of itself: "30 farming required to identify this seed.", or null (`identifySaid`).
create or replace function identify_said(p_world uuid, p_uid uuid, p_def text, p_extra text) returns text
language sql stable as $$
  select g.level || ' ' || lower(coalesce((select s.name from skill_def s where s.id = g.skill), replace(g.skill, '_', ' ')))
      || ' required to identify this ' || x.noun || '.'
    from skill_gate_item x join skill_gate g on g.kind = x.kind and g.id = x.id
   where x.item = p_def and x.extra in (lower(coalesce(p_extra, '')), '')
     and skill_of(p_world, p_uid, g.skill) < g.level
   order by x.extra desc limit 1
$$;

-- Using an item under its gate: "Unidentified seed: needs farming 30; have 20.0.", named as you see it, or null
-- (`itemGateRefusal`).
create or replace function item_gate_refusal(p_world uuid, p_uid uuid, it item) returns text
language plpgsql stable as $$
declare g skill_gate;
begin
  g := item_gate(it.def, it.extra);
  if g.kind is null then return null; end if;
  return skill_gate_refusal(seen_name(p_world, p_uid, it), g.skill, skill_of(p_world, p_uid, g.skill), g.level);
end $$;

-- Whether a worker may use an item, at its own level in the gate's skill (`workerItemOpen`).
create or replace function worker_item_open(c creature, p_def text, p_extra text) returns boolean
language sql stable as $$
  select worker_gate_open(c, item_gate(p_def, p_extra))
$$;

-- The seeds a worker's own farming may sow.
create or replace function worker_seeds(c creature) returns text[]
language sql stable as $$
  select array_agg(cd.seed order by cd.id) from crop_def cd where worker_item_open(c, cd.seed, null)
$$;

-- `pile_text` as this person sees the pile: what they cannot identify by what it is to them.
create or replace function seen_pile_text(p_world uuid, p_uid uuid, p_ids bigint[]) returns text
language sql stable as $$
  select string_agg(case when n > 1 then n || ' × ' || nm else nm end, ', ' order by nm)
  from (select lower(seen_name(p_world, p_uid, i.def, i.extra, (select coalesce(d.name, i.def) from item_def d where d.id = i.def))) as nm,
               sum(i.count) as n
        from item i where i.id = any(p_ids) group by 1) q
$$;

-- The sprout a Plant (or a Graft, `p_fruit`) puts in: the one chosen off the menu, or else the first to hand your
-- forestry may plant, or else the first (`sproutToHand`).
create or replace function sprout_to_hand(p_world uuid, p_uid uuid, p_target jsonb, p_fruit boolean) returns item
language sql stable as $$
  select i.* from item i left join tree_def td on td.name = i.extra
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'sprout' and not i.locked
     and (target_item(p_target) is null or i.id = target_item(p_target))
     and (not p_fruit or td.fruit is not null)
   order by (i.id = target_item(p_target)) desc, (item_gate_refusal(p_world, p_uid, i) is null) desc, i.id limit 1
$$;

-- The first of a def stocked in a crate on the settlement that a worker may use (`stocked`, gated).
create or replace function stocked_for(p_world uuid, c creature, p_def text) returns item
language sql stable as $$
  select i.* from item i join crate cr on cr.world_id = i.world_id and cr.id = i.crate
  where i.world_id = p_world and i.holder = 'crate' and i.def = p_def
    and on_deed(p_world, cr.x, cr.y) and worker_item_open(c, i.def, i.extra)
  order by i.id limit 1
$$;

-- `take_some_stored` for a worker's errand: only what its own level may use.
create or replace function take_usable_stored(p_world uuid, c creature, p_defs text[], p_n int, p_x int, p_y int) returns jsonb
language plpgsql as $$
declare v item; k int;
begin
  select (s.it).* into v from deed_store_items(p_world, c.keeper) s
   where (s.it).def = any(p_defs) and (s.it).count > 0 and not coalesce((s.it).locked, false)
     and worker_item_open(c, (s.it).def, (s.it).extra)
   order by (s.x = p_x and s.y = p_y) desc, s.kind, s.sid, (s.it).id limit 1;
  if v.id is null then return null; end if;
  select * into v from item i where i.id = v.id and i.holder = v.holder
     and i.crate is not distinct from v.crate and i.placed is not distinct from v.placed for update;
  if not found then return null; end if;
  k := least(p_n, v.count);
  if v.count > k then update item set count = count - k where id = v.id;
  else delete from item where id = v.id; end if;
  return jsonb_build_object('def', v.def, 'count', k, 'ql', v.ql, 'extra', v.extra);
end $$;

/* ---- A gated feller or sprout picker, idle ---------------------------------------------------------------------- */

-- Why a feller or a sprout picker with no tree to work within `p_range` of (`p_cx`, `p_cy`) is idle, or nulls: a tree
-- with logs (for sprouts, a living one not picked lately) whose gate is over its own level in the gate's skill, the
-- lowest gate then the nearest (`gate`, idle_what [kind, id], n its tiles off). The browser's `gateIdle`.
create or replace function gate_idle(p_world uuid, p_cx int, p_cy int, p_range int, c creature, p_kind text,
                                     out why text, out n double precision, out what text[])
returns record language plpgsql stable as $fn$
declare v_may boolean[]; v_w int := 2 * p_range + 1; v_best int; v_d int; v_g skill_gate; r record; g skill_gate; v_data int;
begin
  if p_range < 0 or p_kind not in ('woodcut', 'sprout') then return; end if;
  v_may := private.work_tile_may(p_world, p_cx, p_cy, p_range, p_kind, c.id);
  if v_may is null then return; end if;
  for r in
    select p_cx + t.dx as gx, p_cy + t.dy as gy, greatest(abs(t.dx), abs(t.dy)) as d
      from (select (u.i - 1)::int % v_w - p_range as dx, (u.i - 1)::int / v_w - p_range as dy
              from unnest(v_may) with ordinality u(m, i) where u.m) t
  loop
    if land_tile(p_world, r.gx, r.gy) <> tile_id('Tree') then continue; end if;
    if c.keeper is not null and not private.worker_ground(p_world, c.keeper, r.gx, r.gy) then continue; end if;
    v_data := land_data(p_world, r.gx, r.gy);
    if p_kind = 'woodcut' then
      g := tree_gate(v_data);
    elsif coalesce((select a.alive and a.logs > 0 from tree_age_def a where a.id = tree_age(v_data)), false)
          and not is_foraged(p_world, r.gx, r.gy, 'sprout') then
      g := sprout_gate(v_data);
    else
      g := null;
    end if;
    if g.kind is null or worker_gate_open(c, g) then continue; end if;
    if v_best is not null and (g.level > v_best or (g.level = v_best and r.d >= v_d)) then continue; end if;
    if not exists (select 1 from beside_tile(p_world, r.gx, r.gy)) then continue; end if;
    v_best := g.level; v_d := r.d; v_g := g;
  end loop;
  if v_best is not null then
    why := 'gate'; n := v_d; what := array[v_g.kind, v_g.id];
  end if;
end $fn$;

select pg_temp.patch_fn('worker_settle(uuid,integer)',
$o$        elsif kind = 'woodcut' then
          select * into v_mi from gate_idle($o$,
$n$        elsif kind in ('woodcut', 'sprout') then
          select * into v_mi from gate_idle($n$);

/* ---- Where sprouts are checked --------------------------------------------------------------------------------- */

-- A sprout picker takes only a species its own forestry may pick, and never picks one over it.
select pg_temp.patch_fn('worker_gatherable(uuid,integer,integer,text,creature)',
$o$         and not is_foraged(p_world, p_x, p_y, 'sprout');$o$,
$n$         and not is_foraged(p_world, p_x, p_y, 'sprout')
         and worker_gate_open(c, sprout_gate(land_data(p_world, p_x, p_y)));$n$);

select pg_temp.patch_fn('worker_do(uuid,integer)',
$o$  elsif kind = 'sprout' then
    if here <> tile_id('Tree') then return null; end if;$o$,
$n$  elsif kind = 'sprout' then
    if here <> tile_id('Tree') then return null; end if;
    if not worker_gate_open(c, sprout_gate(land_data(p_world, wx, wy))) then return null; end if;$n$);

-- A planter fetches only a sprout its own forestry may plant.
select pg_temp.patch_fn('errand_step(uuid,integer,text)',
$o$      v_store := stocked(p_world, 'sprout');$o$,
$n$      v_store := stocked_for(p_world, c, 'sprout');$n$);

-- And an errand's fetch takes only what its own level may use.
select pg_temp.patch_fn('worker_settle(uuid,integer)',
$o$        load := take_some_stored(p_world, c.keeper, array[c.fetching], errand_fetch_n(p_world, c), c.work_x, c.work_y);$o$,
$n$        load := take_usable_stored(p_world, c, array[c.fetching], errand_fetch_n(p_world, c), c.work_x, c.work_y);$n$);

-- Pick sprout, Plant sprout and Graft: only at your forestry, the sprout named as you see it.
select pg_temp.patch_fn('ground_refusal(uuid,uuid,text,jsonb)',
$o$    if is_foraged(p_world, tx, ty, 'sprout') then return 'Sprout already picked. ' || ready_in(p_world, tx, ty, 'sprout'); end if;$o$,
$n$    if is_foraged(p_world, tx, ty, 'sprout') then return 'Sprout already picked. ' || ready_in(p_world, tx, ty, 'sprout'); end if;
    if sprout_gate_refusal(p_world, p_uid, v_data) is not null then return sprout_gate_refusal(p_world, p_uid, v_data); end if;$n$);

select pg_temp.patch_fn('ground_refusal(uuid,uuid,text,jsonb)',
$o$    if pack_count(p_world, p_uid, 'sprout') < 1 then return 'Need a sprout.'; end if;$o$,
$n$    if pack_count(p_world, p_uid, 'sprout') < 1 then return 'Need a sprout.'; end if;
    v_spoil := item_gate_refusal(p_world, p_uid, sprout_to_hand(p_world, p_uid, p_target, false));
    if v_spoil is not null then return v_spoil; end if;$n$);

select pg_temp.patch_fn('ground_refusal(uuid,uuid,text,jsonb)',
$o$      return 'Need a fruit sprout.';
    end if;$o$,
$n$      return 'Need a fruit sprout.';
    end if;
    v_spoil := item_gate_refusal(p_world, p_uid, sprout_to_hand(p_world, p_uid, p_target, true));
    if v_spoil is not null then return v_spoil; end if;$n$);

-- And the sprout put in is that one.
select pg_temp.patch_fn('perform_ground(uuid,uuid,text,jsonb)',
$o$    select * into v_sprout from item where world_id = p_world and holder = 'player'
      and holder_uid = p_uid and def = 'sprout' and not locked
      and (target_item(p_target) is null or id = target_item(p_target))
      order by (id = target_item(p_target)) desc, id limit 1;$o$,
$n$    select * into v_sprout from sprout_to_hand(p_world, p_uid, p_target, false) s where s.id is not null;$n$);

select pg_temp.patch_fn('perform_ground(uuid,uuid,text,jsonb)',
$o$    select i.* into v_sprout from item i join tree_def td on td.name = i.extra and td.fruit is not null
     where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
       and i.def = 'sprout' and not i.locked
       and (target_item(p_target) is null or i.id = target_item(p_target))
     order by (i.id = target_item(p_target)) desc, i.id limit 1;$o$,
$n$    select * into v_sprout from sprout_to_hand(p_world, p_uid, p_target, true) s where s.id is not null;$n$);

/* ---- Where sowing is checked ------------------------------------------------------------------------------------- */

-- Sow (a field, a garden bed) and Sow a patch: only a crop your farming may sow, the seed named as you see it.
select pg_temp.patch_fn('farm_refusal(uuid,uuid,text,jsonb)',
$o$    if not found or not exists (select 1 from crop_def where seed = it.def) then
      return 'Choose a seed.';
    end if;
  elsif p_action = 'tend_crop' then$o$,
$n$    if not found or not exists (select 1 from crop_def where seed = it.def) then
      return 'Choose a seed.';
    end if;
    if item_gate_refusal(p_world, p_uid, it) is not null then return item_gate_refusal(p_world, p_uid, it); end if;
  elsif p_action = 'tend_crop' then$n$);

select pg_temp.patch_fn('farm_refusal(uuid,uuid,text,jsonb)',
$o$      return 'Choose a seed.';
    end if;
    v_r := floor(pk(p_world, p_uid, 'sow_patch', 0))::int;$o$,
$n$      return 'Choose a seed.';
    end if;
    if item_gate_refusal(p_world, p_uid, it) is not null then return item_gate_refusal(p_world, p_uid, it); end if;
    v_r := floor(pk(p_world, p_uid, 'sow_patch', 0))::int;$n$);

-- A planter, after a herb box's herbs.
select pg_temp.patch_fn('planter_refusal(uuid,uuid,text,placed,jsonb)',
$o$      return herbs_only_said();
    end if;$o$,
$n$      return herbs_only_said();
    end if;
    if item_gate_refusal(p_world, p_uid, it) is not null then return item_gate_refusal(p_world, p_uid, it); end if;$n$);

-- A herb spiral: the seed chosen, or the first herb seed your farming may sow, or the first; and that one gated.
select pg_temp.patch_fn('adorn_refusal(uuid,uuid,text,jsonb)',
$o$         and i.def = any (spiral_seeds()) and not i.locked order by i.id limit 1;
    end if;
    if it.id is null then return adorn_said('noSeed', null, null, null); end if;
    return case when it.def = any (spiral_seeds()) and not it.locked then null else adorn_said('notSeed', null, null, null) end;$o$,
$n$         and i.def = any (spiral_seeds()) and not i.locked order by (item_gate_refusal(p_world, p_uid, i) is null) desc, i.id limit 1;
    end if;
    if it.id is null then return adorn_said('noSeed', null, null, null); end if;
    if not (it.def = any (spiral_seeds()) and not it.locked) then return adorn_said('notSeed', null, null, null); end if;
    return item_gate_refusal(p_world, p_uid, it);$n$);

select pg_temp.patch_fn('perform_adorn(uuid,uuid,text,jsonb)',
$o$         and i.def = any (spiral_seeds()) and not i.locked order by i.id limit 1;$o$,
$n$         and i.def = any (spiral_seeds()) and not i.locked order by (item_gate_refusal(p_world, p_uid, i) is null) desc, i.id limit 1;$n$);

-- A farmer sows only seed its own farming may sow: what lies in the furrow, then the stores.
create or replace function sow_seed(p_world uuid, c creature, p_x integer, p_y integer) returns item
language sql stable as $$
  select coalesce(
    (select i from item i
      where i.world_id = p_world and i.holder = 'ground' and i.gx = p_x and i.gy = p_y
        and exists (select 1 from crop_def d where d.seed = i.def) and worker_item_open(c, i.def, i.extra)
      order by i.id limit 1),
    (select i from crop_def cd
       join item i on i.world_id = p_world and i.holder = 'crate' and i.def = cd.seed
       join crate cr on cr.world_id = i.world_id and cr.id = i.crate
       join my_deed(p_world, c.keeper) d on abs(cr.x - d.x) <= d.radius and abs(cr.y - d.y) <= d.radius
      where worker_item_open(c, i.def, i.extra)
      order by i.id limit 1),
    (select i from crop_def cd
       join item i on i.world_id = p_world and i.holder = 'furniture' and i.def = cd.seed
       join placed p on p.world_id = i.world_id and p.id = i.placed and p.kind = 'furniture'
       join my_deed(p_world, c.keeper) d on abs(p.x - d.x) <= d.radius and abs(p.y - d.y) <= d.radius
      where worker_item_open(c, i.def, i.extra)
      order by i.id limit 1))
$$;

-- A planter tender, the same, out of the stores.
select pg_temp.patch_fn('errand_do(uuid,integer,boolean,text)',
$o$take_some_stored(p_world, c.keeper, (select array_agg(x.seed) from crop_def x), stage_loads(c), c.work_x, c.work_y)$o$,
$n$take_some_stored(p_world, c.keeper, worker_seeds(c), stage_loads(c), c.work_x, c.work_y)$n$);

select pg_temp.patch_fn('errand_step(uuid,integer,text)',
$o$v_seeds text[] := (select array_agg(cd.seed) from crop_def cd);$o$,
$n$v_seeds text[] := worker_seeds(c);$n$);

/* ---- Names told to a person, as they see the thing ------------------------------------------------------------- */

-- Foraging and botanizing: "Found: unidentified seed (QL 12.0)."
select pg_temp.patch_fn('perform_gather(uuid,uuid,text,jsonb)',
$o$lower((select coalesce(name, got) from item_def where id = got))$o$,
$n$lower(seen_name(p_world, p_uid, got, null, (select coalesce(name, got) from item_def where id = got)))$n$);

-- Dropped, picked up, kept back and let go.
select pg_temp.patch_fn('perform_hands(uuid,uuid,text,jsonb)',
$o$lower(item_name(it))$o$, $n$lower(seen_name(p_world, p_uid, it))$n$, 5);
select pg_temp.patch_fn('perform_hands(uuid,uuid,text,jsonb)',
$o$'Picked up: ' || pile_text(v_took)$o$, $n$'Picked up: ' || seen_pile_text(p_world, p_uid, v_took)$n$);

-- A crate: put in, taken out, emptied.
select pg_temp.patch_fn('perform_crate(uuid,uuid,text,jsonb)',
$o$|| made_name(v_r.def, v_r.piece));$o$,
$n$|| seen_name(p_world, p_uid, v_r.def, v_r.extra, made_name(v_r.def, v_r.piece)));$n$);
select pg_temp.patch_fn('perform_crate(uuid,uuid,text,jsonb)',
$o$stored_line(v_fit, made_name(v_it.def, v_it.piece), crate_name(v_c), v_want - v_fit)$o$,
$n$stored_line(v_fit, seen_name(p_world, p_uid, v_it.def, v_it.extra, made_name(v_it.def, v_it.piece)), crate_name(v_c), v_want - v_fit)$n$);
select pg_temp.patch_fn('perform_crate(uuid,uuid,text,jsonb)',
$o$|| lower((select coalesce(name, v_it.def) from item_def where id = v_it.def))$o$,
$n$|| lower(seen_name(p_world, p_uid, v_it.def, v_it.extra, (select coalesce(name, v_it.def) from item_def where id = v_it.def)))$n$);

-- A chest, a bin, a bag: put in, emptied, thrown away.
select pg_temp.patch_fn('perform_holding(uuid,uuid,text,jsonb)',
$o$q.count || ' × ' || lower(item_name(q))
                           else lower(item_name(q)) end$o$,
$n$q.count || ' × ' || lower(seen_name(p_world, p_uid, q))
                           else lower(seen_name(p_world, p_uid, q)) end$n$);
select pg_temp.patch_fn('perform_holding(uuid,uuid,text,jsonb)',
$o$stored_line(v_fit, item_name(it),$o$, $n$stored_line(v_fit, seen_name(p_world, p_uid, it),$n$, 2);
select pg_temp.patch_fn('perform_holding(uuid,uuid,text,jsonb)',
$o$|| case when v_want > 1 then v_want || ' × ' else '' end || lower(item_name(it))$o$,
$n$|| case when v_want > 1 then v_want || ' × ' else '' end || lower(seen_name(p_world, p_uid, it))$n$);

-- A harvest's seed, from a field, a bed, a patch or a planter.
select pg_temp.patch_fn('perform_farm(uuid,uuid,text,jsonb)',
$o$lower((select coalesce(name, r.o_seed) from item_def where id = r.o_seed))$o$,
$n$lower(seen_name(p_world, p_uid, r.o_seed, null, (select coalesce(name, r.o_seed) from item_def where id = r.o_seed)))$n$);
select pg_temp.patch_fn('perform_farm(uuid,uuid,text,jsonb)',
$o$lower(coalesce(dd.name, t.id))$o$,
$n$lower(seen_name(p_world, p_uid, t.id, null, coalesce(dd.name, t.id)))$n$);
select pg_temp.patch_fn('perform_planter(uuid,uuid,text,jsonb)',
$o$lower((select coalesce(name, r.o_seed) from item_def where id = r.o_seed))$o$,
$n$lower(seen_name(p_world, p_uid, r.o_seed, null, (select coalesce(name, r.o_seed) from item_def where id = r.o_seed)))$n$);

-- An ancient seed jar opened.
select pg_temp.patch_fn('perform_relic_use(uuid,uuid,text,jsonb)',
$o$lower((select d.name from item_def d where d.id = v_seed))$o$,
$n$lower(seen_name(p_world, p_uid, v_seed, null, (select d.name from item_def d where d.id = v_seed)))$n$);

-- A shop counter: set out and taken back; bought, as the seller and the buyer each see it.
select pg_temp.patch_fn('perform_counter(uuid,uuid,text,jsonb)',
$o$    v_name := item_name(it);$o$, $n$    v_name := seen_name(p_world, p_uid, it);$n$, 2);
select pg_temp.patch_fn('rpc_buy(uuid,bigint)',
$o$    perform tell(p_world, v_pl.made_by, 'Sold: ' || v_name || ' to '$o$,
$n$    perform tell(p_world, v_pl.made_by, 'Sold: ' || lower(seen_name(p_world, v_pl.made_by, v_it.def, v_it.extra, v_name)) || ' to '$n$);
select pg_temp.patch_fn('rpc_buy(uuid,bigint)',
$o$  return jsonb_build_object('bought', v_name, 'paid', v_it.price);$o$,
$n$  return jsonb_build_object('bought', lower(seen_name(p_world, me, v_it.def, v_it.extra, v_name)), 'paid', v_it.price);$n$);

-- Examined, an unidentified thing says only what identifies it.
select pg_temp.patch_fn('examine_item_text(uuid,uuid,item)',
$o$  if not found then return 'It is nothing you have a name for.'; end if;$o$,
$n$  if not found then return 'It is nothing you have a name for.'; end if;
  if identify_said(p_world, p_uid, it.def, it.extra) is not null then return identify_said(p_world, p_uid, it.def, it.extra); end if;$n$);

select private.lock_doors();
