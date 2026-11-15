-- Skill gates, the third set: what is made, restored and built.
--
-- Asked for: "Gate cooking recipes. Gate bauble and artifact restorations. Gating carpentry crafts, masonry crafts,
-- wall types based on carp/masonry levels. Gating formulas. Gating paving/floor types. Gating these tasks also for
-- wildermon that perform them equal to their own level. Make sure the approach is sensible and uniform." Decided: the
-- smelter at masonry 1, the wagon at carpentry 70, the caravel at carpentry 90; a wall keeps both its gates, material and
-- type, a carpentry wall's in carpentry and a masonry wall's in masonry; an item whose use is gated is unidentified
-- under the gate.
--
-- Every gate is a row of `skill_gate` (`src/game/craftgates.ts`, emitted by `npm run defs`):
--   * recipe: every crafting recipe by its id, in its own skill, at the ladder step at or below 2 x (difficulty - 6)
--     (1 for none), but for the three named and a Formula's scroll by what it goes on (20, 30, 40; two elements 50).
--     One check in `craft_refusal`, after a perk or a book (`recipe_gate_refusal`); a store trade takes only recipes its own level makes
--     (`worker_recipes`), and with only those in its stores it is idle `gate`, naming one (`recipe_gate_idle`);
--   * relic, bauble: restoring, by restoration, at its difficulty's step; the fragments and the tarnished bauble are
--     unidentified under it, and refused in their seen names (`dig_refusal`, `item_gate_refusal`); a restorer only
--     restores a relic its own level may (`relic_in_stores` with the worker);
--   * material, wall, floor: planning and adding to a wall, a fence or a floor, by its material's gate and its type's,
--     in the material's skill (`build_gate_refusal`); a hod carrier fits only work each of whose gates its own level
--     meets (`hod_may`);
--   * paving: cobblestones and each slab, by paving (`paving_gate_refusal`);
--   * a Recipe or a Formula is unidentified under its recipe's gate, and not read (`relic_use_refusal`).

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

-- The same, by a regular expression, `p_times` matches of it.
create or replace function pg_temp.patch_re(p_sig regprocedure, p_pat text, p_new text, p_times int) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  select count(*) into v_n from regexp_matches(v_def, p_pat, 'g');
  if v_n <> p_times then
    raise exception '%: % of /%/, wanted %', p_sig, v_n, left(p_pat, 120), p_times;
  end if;
  execute regexp_replace(v_def, p_pat, p_new, 'g');
end $p$;

/* ---- Recipes ------------------------------------------------------------------------------------------------------- */

-- Making a recipe under its gate (`recipeGated`): "Apple pie: needs cooking 20; have 4.0.", or null.
create or replace function recipe_gate_refusal(p_world uuid, p_uid uuid, p_recipe text) returns text
language sql stable as $$
  select skill_gate_refusal(g.name, g.skill, skill_of(p_world, p_uid, g.skill), g.level)
    from skill_gate g where g.kind = 'recipe' and g.id = p_recipe
$$;

-- The one check every crafting recipe goes through: after a perk, a trade book's trade and a shut recipe's book, before
-- the tool, the station and the makings.
select pg_temp.patch_fn('craft_refusal(uuid,uuid,text,bigint)',
$o$  if exists (select 1 from locked_recipes() l where l.id = p_recipe) and not private.recipe_read(p_world, p_uid, p_recipe) then
    return 'Need ' || recipe_book(p_recipe) || ': ' || (select l.title from locked_recipes() l where l.id = p_recipe) || '.';
  end if;$o$,
$n$  if exists (select 1 from locked_recipes() l where l.id = p_recipe) and not private.recipe_read(p_world, p_uid, p_recipe) then
    return 'Need ' || recipe_book(p_recipe) || ': ' || (select l.title from locked_recipes() l where l.id = p_recipe) || '.';
  end if;
  -- Its skill gate (`craftgates.ts`), after what is known (a perk, a book) and before what is at hand, as the browser's
  -- `recipeReason` asks it.
  if recipe_gate_refusal(p_world, p_uid, p_recipe) is not null then return recipe_gate_refusal(p_world, p_uid, p_recipe); end if;$n$);

-- The recipes of a list a worker's own level in each one's skill makes (`workerRecipeOpen`), in the list's order.
create or replace function worker_recipes(c creature, p_recipes text[]) returns text[]
language sql stable as $$
  select coalesce(array_agg(r.id order by r.ord), '{}')
    from unnest(p_recipes) with ordinality as r(id, ord)
   where worker_gate_open(c, skill_gate_of('recipe', r.id))
$$;

-- A store trade with nothing it may make: the recipe the stores hold the makings of, every such one over its level, as
-- `idle_what` (['recipe', id]); null where the stores hold the makings of none (`stockWhy`).
create or replace function recipe_gate_idle(p_world uuid, c creature, p_recipes text[]) returns text[]
language sql stable as $$
  select array['recipe', r.rid] from recipe_in_stores(p_world, c.keeper, p_recipes) r where r.rid is not null
$$;

-- Every store trade, by the recipes its own level makes; idle `gate` where the stores hold only others.
select pg_temp.patch_re('errand_step(uuid,integer,text)',
$p$select \* into v_r from recipe_in_stores\(p_world, c\.keeper, tend_recipes\(([^)]*)\)\);(\s*)if v_r\.rid is null then why := 'stock'; why_n := null; return next; return; end if;$p$,
$r$select * into v_r from recipe_in_stores(p_world, c.keeper, worker_recipes(c, tend_recipes(\1)));\2if v_r.rid is null then why := 'stock'; why_n := null; why_what := recipe_gate_idle(p_world, c, tend_recipes(\1)); if why_what is not null then why := 'gate'; end if; return next; return; end if;$r$, 7);
select pg_temp.patch_re('errand_step(uuid,integer,text)',
$p$recipe_in_stores\(p_world, c\.keeper, tend_recipes\(([^)]*)\)\)$p$,
$r$recipe_in_stores(p_world, c.keeper, worker_recipes(c, tend_recipes(\1)))$r$, 1);
select pg_temp.patch_re('errand_do(uuid,integer,boolean,text)',
$p$recipe_in_stores\(p_world, c\.keeper, tend_recipes\(([^)]*)\)\)$p$,
$r$recipe_in_stores(p_world, c.keeper, worker_recipes(c, tend_recipes(\1)))$r$, 8);

/* ---- Restoring: relics and baubles --------------------------------------------------------------------------------- */

-- The part of an item's `extra` its gate is found by (`gateExtra`): a fragment's relic, not its piece.
create or replace function gate_item_extra(p_def text, p_extra text) returns text
language sql immutable as $$
  select case when p_def = 'fragment' then lower(coalesce(fragment_relic(p_extra), p_extra, '')) else lower(coalesce(p_extra, '')) end
$$;

select pg_temp.patch_fn('item_gate(text,text)',
  $o$x.extra in (lower(coalesce(p_extra, '')), '')$o$, $n$x.extra in (gate_item_extra(p_def, p_extra), '')$n$);
select pg_temp.patch_fn('identify_said(uuid,uuid,text,text)',
  $o$x.extra in (lower(coalesce(p_extra, '')), '')$o$, $n$x.extra in (gate_item_extra(p_def, p_extra), '')$n$);
select pg_temp.patch_fn('unidentified_name(uuid,uuid,text,text)',
  $o$x.extra in (lower(coalesce(p_extra, '')), '')$o$, $n$x.extra in (gate_item_extra(p_def, p_extra), '')$n$);

-- Restore, a relic or a bauble: at its gate, named as you see it, after the brush.
select pg_temp.patch_fn('dig_refusal(uuid,uuid,text,jsonb)',
$o$  if pack_count(p_world, p_uid, 'brush') < 1 then return 'Need a brush.'; end if;$o$,
$n$  if pack_count(p_world, p_uid, 'brush') < 1 then return 'Need a brush.'; end if;
  -- A relic's or a bauble tier's restoration gate (`craftgates.ts`): "Unidentified fragment: needs restoration 30; have 12.0."
  if item_gate_refusal(p_world, p_uid, it) is not null then return item_gate_refusal(p_world, p_uid, it); end if;$n$);

-- A find under its restoration gate, told unidentified (`investigate`).
select pg_temp.patch_fn('perform_dig(uuid,uuid,text,jsonb)',
$o$      perform tell(p_world, p_uid, 'Found: tarnished ' || v_relic
        || ' bauble, QL ' || to_char(v_ql, 'FM990.0')
        || ', damage ' || to_char(v_dmg, 'FM990') || '. Restore it to use it.', 'event');$o$,
$n$      perform tell(p_world, p_uid, case when unidentified_name(p_world, p_uid, 'tarnished_bauble', v_relic) is not null
        then 'Found: ' || unidentified_name(p_world, p_uid, 'tarnished_bauble', v_relic) || ', QL ' || to_char(v_ql, 'FM990.0')
          || ', damage ' || to_char(v_dmg, 'FM990') || '.'
        else 'Found: tarnished ' || v_relic
        || ' bauble, QL ' || to_char(v_ql, 'FM990.0')
        || ', damage ' || to_char(v_dmg, 'FM990') || '. Restore it to use it.' end, 'event');$n$);
select pg_temp.patch_fn('perform_dig(uuid,uuid,text,jsonb)',
$o$    perform tell(p_world, p_uid, 'Found: ' || r.name || ' fragment '
      || v_part || '/' || r.parts || ', QL ' || to_char(v_ql, 'FM990.0')
      || ', damage ' || to_char(v_dmg, 'FM990') || '.'
      || case when v_left > 0 then ' Missing: ' || v_left || '/' || r.parts || '.'
              else ' All ' || r.parts || ' pieces held.' end, 'event');$o$,
$n$    perform tell(p_world, p_uid, case when unidentified_name(p_world, p_uid, 'fragment', r.name) is not null
      then 'Found: ' || unidentified_name(p_world, p_uid, 'fragment', r.name) || ', QL ' || to_char(v_ql, 'FM990.0')
        || ', damage ' || to_char(v_dmg, 'FM990') || '.'
      else 'Found: ' || r.name || ' fragment '
      || v_part || '/' || r.parts || ', QL ' || to_char(v_ql, 'FM990.0')
      || ', damage ' || to_char(v_dmg, 'FM990') || '.'
      || case when v_left > 0 then ' Missing: ' || v_left || '/' || r.parts || '.'
              else ' All ' || r.parts || ' pieces held.' end end, 'event');$n$);

-- The first relic, by name, whose pieces are all in the stores and a worker's own restoration restores (`relicInStores`).
create or replace function relic_in_stores(p_world uuid, p_uid uuid, c creature)
returns table(name text, x int, y int, cx double precision, cy double precision)
language sql stable as $$
  with pieces as (
    select fragment_relic((s.it).extra) as relic, fragment_part((s.it).extra) as part, s.x, s.y, s.cx, s.cy, s.kind, s.sid
      from deed_store_items(p_world, p_uid) s
     where (s.it).def = 'fragment' and not coalesce((s.it).locked, false))
  select r.name, f.x, f.y, f.cx, f.cy from relic_def r
    join lateral (select p.x, p.y, p.cx, p.cy from pieces p where lower(p.relic) = lower(r.name) and p.part = 1
                   order by p.kind, p.sid limit 1) f on true
   where (select count(distinct p.part) from pieces p where lower(p.relic) = lower(r.name) and p.part between 1 and r.parts) = r.parts
     and worker_gate_open(c, skill_gate_of('relic', lower(r.name)))
   order by r.name collate "C" limit 1
$$;

select pg_temp.patch_fn('errand_step(uuid,integer,text)',
$o$      select * into v_r from relic_in_stores(p_world, c.keeper);
      if v_r.name is null then why := 'stock'; why_n := null; return next; return; end if;$o$,
$n$      select * into v_r from relic_in_stores(p_world, c.keeper, c);
      if v_r.name is null then
        -- Every relic whose pieces are in the stores over its restoration: `gate`, naming it.
        why := 'stock'; why_n := null;
        select array['relic', lower(g.name)] into why_what from relic_in_stores(p_world, c.keeper) g where g.name is not null;
        if why_what is not null then why := 'gate'; end if;
        return next; return;
      end if;$n$);
select pg_temp.patch_fn('errand_do(uuid,integer,boolean,text)',
  $o$relic_in_stores(p_world, c.keeper);$o$, $n$relic_in_stores(p_world, c.keeper, c);$n$);

-- What it would make or restore out of the stores is in the stores, not tiles off.
select pg_temp.patch_fn('worker_idle(uuid,creature,text,integer,integer,integer,bigint)',
$o$' idle: only work above its level within ' || p_radius || ' tiles of ' || v_where || '. '$o$,
$n$' idle: only work above its level '
      || case when c.idle_what[1] in ('recipe', 'relic', 'bauble') then 'in your settlement stores'
              else 'within ' || p_radius || ' tiles of ' || v_where end || '. '$n$);

/* ---- Books: a Recipe or a Formula ---------------------------------------------------------------------------------- */

select pg_temp.patch_fn('relic_use_refusal(uuid,uuid,text,jsonb)',
$o$       or private.book_opens(v_it.def, v_it.extra) is null then return 'It is gone.'; end if;$o$,
$n$       or private.book_opens(v_it.def, v_it.extra) is null then return 'It is gone.'; end if;
    -- Under its recipe's skill gate, unidentified, and not read: "Unidentified formula: needs enchanting 30; have 12.0."
    if item_gate_refusal(p_world, p_uid, v_it) is not null then return item_gate_refusal(p_world, p_uid, v_it); end if;$n$);

/* ---- Building: material, wall type, floor type ---------------------------------------------------------------------- */

-- A floor slot's type (`floorType`): its kind, or a staircase's hand, 'single' or 'spiral'.
create or replace function floor_type(p_kind text, p_hand text) returns text
language sql immutable as $$
  select case when p_kind = 'stairs' and p_hand = 's' then 'spiral' when p_kind = 'stairs' and p_hand in ('l', 'r') then 'single'
              else coalesce(p_kind, 'floor') end
$$;

-- The gates on building with a material as a wall type or a floor type (`buildGates`): its material's, then its type's,
-- in the material's skill.
create or replace function build_gates(p_material text, p_wall text, p_floor text, p_hand text)
returns table(ord int, kind text, id text, name text, skill text, level int)
language sql stable as $$
  select v.ord, g.kind, g.id, g.name, g.skill, g.level
    from build_material_def m
    cross join lateral (values (1, 'material', m.id),
                               (2, case when p_wall is not null then 'wall' when p_floor is not null then 'floor' end,
                                   m.skill || ':' || coalesce(p_wall, floor_type(p_floor, p_hand)))) v(ord, kind, id)
    join skill_gate g on g.kind = v.kind and g.id = v.id
   where m.id = p_material
   order by v.ord
$$;

-- The first of them a person is under (`buildGateRefusal`): "Plank building: needs carpentry 10; have 3.0.", or null.
create or replace function build_gate_refusal(p_world uuid, p_uid uuid, p_material text, p_wall text, p_floor text, p_hand text)
returns text language sql stable as $$
  select r from (select skill_gate_refusal(b.name, b.skill, skill_of(p_world, p_uid, b.skill), b.level) as r, b.ord
                   from build_gates(p_material, p_wall, p_floor, p_hand) b) x
   where r is not null order by ord limit 1
$$;

-- Whether a worker meets every one at its own level in each gate's skill (`workerBuildOpen`).
create or replace function worker_build_open(c creature, p_material text, p_wall text, p_floor text, p_hand text)
returns boolean language sql stable as $$
  select coalesce(bool_and(worker_level(c, b.skill) >= b.level), true) from build_gates(p_material, p_wall, p_floor, p_hand) b
$$;

-- Planning a wall: after what is asked for, before the mallet (`plan_wall`).
select pg_temp.patch_fn('build_refusal(uuid,uuid,text,jsonb)',
$o$    if side is null or wt.id is null or mat.id is null then return 'Choose a side, wall type and material.'; end if;
    tool := need_tool(p_world, p_uid, 'mallet');$o$,
$n$    if side is null or wt.id is null or mat.id is null then return 'Choose a side, wall type and material.'; end if;
    -- Its material's and its type's skill gates (`craftgates.ts`).
    v_gap := build_gate_refusal(p_world, p_uid, mat.id, wt.id, null, null);
    if v_gap is not null then return v_gap; end if;
    tool := need_tool(p_world, p_uid, 'mallet');$n$);
-- A fence (`plan_fence`).
select pg_temp.patch_fn('build_refusal(uuid,uuid,text,jsonb)',
$o$    if not wt.standalone then return 'Only fences and half walls stand alone.'; end if;$o$,
$n$    if not wt.standalone then return 'Only fences and half walls stand alone.'; end if;
    v_gap := build_gate_refusal(p_world, p_uid, mat.id, wt.id, null, null);
    if v_gap is not null then return v_gap; end if;$n$);
-- Adding to a planned wall, laid by anybody (`build_wall`); a change is asked when it is planned.
select pg_temp.patch_fn('build_refusal(uuid,uuid,text,jsonb)',
$o$    if bill_done(w.needed) then return 'Wall finished.'; end if;$o$,
$n$    if bill_done(w.needed) then return 'Wall finished.'; end if;
    v_gap := build_gate_refusal(p_world, p_uid, w.material, w.type, null, null);
    if v_gap is not null then return v_gap; end if;$n$);
-- Planning a floor, a roof, a staircase or a ladder (`plan_floor`).
select pg_temp.patch_fn('build_refusal(uuid,uuid,text,jsonb)',
$o$    if mat.id is null then return 'Choose a material.'; end if;
    tool := need_tool(p_world, p_uid, 'mallet');$o$,
$n$    if mat.id is null then return 'Choose a material.'; end if;
    -- Its material's and its floor type's skill gates (`craftgates.ts`).
    v_gap := build_gate_refusal(p_world, p_uid, mat.id, null, coalesce(p_target->>'floorKind', 'floor'),
                                stair_hand(p_target, coalesce(p_target->>'floorKind', 'floor')));
    if v_gap is not null then return v_gap; end if;
    tool := need_tool(p_world, p_uid, 'mallet');$n$);
-- Adding to one (`build_floor`).
select pg_temp.patch_fn('build_refusal(uuid,uuid,text,jsonb)',
$o$    if bill_done(f.needed) then return 'Already finished.'; end if;$o$,
$n$    if bill_done(f.needed) then return 'Already finished.'; end if;
    v_gap := build_gate_refusal(p_world, p_uid, f.material, null, f.kind, f.hand);
    if v_gap is not null then return v_gap; end if;$n$);
-- Planning a change to a standing wall, the new material and type (`changeWallReason`).
select pg_temp.patch_fn('change_wall_refusal(uuid,uuid,jsonb,building)',
$o$  v_why := need_tool(p_world, p_uid, 'mallet');
  if v_why is not null then return v_why; end if;$o$,
$n$  v_why := build_gate_refusal(p_world, p_uid, mat.id, wt.id, null, null);
  if v_why is not null then return v_why; end if;
  v_why := need_tool(p_world, p_uid, 'mallet');
  if v_why is not null then return v_why; end if;$n$);

-- Whether a hod carrier may fit what a piece of work wants (`hodMay`): a wall, a floor, a column by every gate on it at
-- its own level; a span or a foundation, open.
create or replace function hod_may(p_world uuid, c creature, p_kind text, p_level int, p_dir text, p_x int, p_y int)
returns boolean language sql stable as $$
  select case p_kind
    when 'wall' then coalesce((select worker_build_open(c, w.material, w.type, null, null) from wall w
                                where w.world_id = p_world and w.level = p_level and w.dir = p_dir and w.x = p_x and w.y = p_y), true)
    when 'floor' then coalesce((select worker_build_open(c, f.material, null, f.kind, f.hand) from floor_tile f
                                 where f.world_id = p_world and f.level = p_level and f.x = p_x and f.y = p_y), true)
    when 'column' then coalesce((select worker_build_open(c, bc.material, null, null, null) from building_column bc
                                  where bc.world_id = p_world and bc.level = p_level and bc.x = p_x and bc.y = p_y), true)
    else true end
$$;

-- The work a hod carrier takes, only what its own levels may fit.
create or replace function hod_needing(p_world uuid, p_cx int, p_cy int, p_range int, p_holding text, p_keeper uuid, c creature)
returns table(kind text, level int, dir text, x int, y int, ref bigint, n int, item text)
language sql stable as $$
  select w.kind, w.level, w.dir, w.x, w.y, w.ref, w.n, p_holding
  from hod_work(p_world, p_cx, p_cy, p_range) w
  where p_holding is not null and coalesce((w.needed->>p_holding)::int, 0) > 0
    and (p_keeper is null or hod_work_mine(p_world, p_keeper, w.dir, w.x, w.y))
    and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y)
    and hod_may(p_world, c, w.kind, w.level, w.dir, w.x, w.y)
  order by (w.x - p_cx) ^ 2 + (w.y - p_cy) ^ 2,
           (w.needed->>p_holding)::double precision / greatest(1, coalesce((w.total->>p_holding)::double precision, 0)) desc,
           hod_rank(w.kind), w.level, w.dir collate "C", w.x, w.y
  limit 1
$$;
create or replace function hod_needing_stocked(p_world uuid, p_uid uuid, p_cx int, p_cy int, p_range int, c creature)
returns table(kind text, level int, dir text, x int, y int, ref bigint, n int, item text)
language sql stable as $$
  with work as materialized (
    select * from hod_work(p_world, p_cx, p_cy, p_range)
  ),
  want as materialized (
    select w.*, e.key, e.value::int as left_
    from work w cross join lateral jsonb_each_text(w.needed) e
    where e.value::int > 0 and hod_work_mine(p_world, p_uid, w.dir, w.x, w.y)
      and hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y)
      and hod_may(p_world, c, w.kind, w.level, w.dir, w.x, w.y)
  ),
  have as materialized (
    select distinct (s.it).def as def from deed_store_items(p_world, p_uid) s
     where (s.it).count > 0 and not coalesce((s.it).locked, false)
       and exists (select 1 from want)
  )
  select w.kind, w.level, w.dir, w.x, w.y, w.ref, w.n, w.key
  from want w
  where w.key in (select def from have)
  order by (w.x - p_cx) ^ 2 + (w.y - p_cy) ^ 2,
           w.left_::double precision / greatest(1, coalesce((w.total->>w.key)::double precision, 0)) desc,
           hod_rank(w.kind), w.level, w.dir collate "C", w.x, w.y, w.key collate "C"
  limit 1
$$;

select pg_temp.patch_fn('errand_step(uuid,integer,text)',
  $o$hod_needing(p_world, dd.x, dd.y, rng, c.carrying->>'def', c.keeper)$o$,
  $n$hod_needing(p_world, dd.x, dd.y, rng, c.carrying->>'def', c.keeper, c)$n$);
select pg_temp.patch_fn('errand_step(uuid,integer,text)',
  $o$hod_needing_stocked(p_world, c.keeper, dd.x, dd.y, rng)$o$,
  $n$hod_needing_stocked(p_world, c.keeper, dd.x, dd.y, rng, c)$n$);
select pg_temp.patch_fn('errand_do(uuid,integer,boolean,text)',
  $o$c.carrying->>'def', c.keeper)$o$, $n$c.carrying->>'def', c.keeper, c)$n$, 2);

/* ---- Paving --------------------------------------------------------------------------------------------------------- */

-- Paving with cobblestones or a slab under its gate (`pavingGateRefusal`): "Marble slabs: needs paving 50; have 12.0."
create or replace function paving_gate_refusal(p_world uuid, p_uid uuid, p_id text) returns text
language sql stable as $$
  select skill_gate_refusal(g.name, g.skill, skill_of(p_world, p_uid, g.skill), g.level)
    from skill_gate g where g.kind = 'paving' and g.id = p_id
$$;

select pg_temp.patch_fn('terrain_refusal(uuid,uuid,text,jsonb)',
$o$    if here <> 2 then return 'Pack the ground down before paving it.'; end if;$o$,
$n$    if here <> 2 then return 'Pack the ground down before paving it.'; end if;
    -- Its paving gate (`craftgates.ts`).
    if paving_gate_refusal(p_world, p_uid, 'cobblestone') is not null then return paving_gate_refusal(p_world, p_uid, 'cobblestone'); end if;$n$);

-- The slab a go lays: the one named, else the first carried (`perform_ground`).
create or replace function slab_to_lay(p_world uuid, p_uid uuid, p_target jsonb) returns text
language sql stable as $$
  select i.def from item i join slab_def s on s.item = i.def
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and not i.locked
   order by (i.id = target_item(p_target)) desc, i.id limit 1
$$;

select pg_temp.patch_fn('ground_refusal(uuid,uuid,text,jsonb)',
$o$      return 'Need a cut slab.';
    end if;$o$,
$n$      return 'Need a cut slab.';
    end if;
    -- The slab's paving gate (`craftgates.ts`).
    if paving_gate_refusal(p_world, p_uid, slab_to_lay(p_world, p_uid, p_target)) is not null then
      return paving_gate_refusal(p_world, p_uid, slab_to_lay(p_world, p_uid, p_target));
    end if;$n$);

select private.lock_doors();
