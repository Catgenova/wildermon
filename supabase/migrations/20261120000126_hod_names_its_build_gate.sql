-- A hod carrier names the build gate that keeps it from work the stores have pieces for, and its stock line names only
-- what the stores lack.
--
-- Seen on the island: a hod carrier idle "stock", naming glass, timber and marble brick, with 1051 glass and 333 timber
-- in its settlement stores. Glass walls and a glass roof wanted them, and its carpentry (1) was under glass building's
-- gate (40), so `hod_may` refused them and `hod_needing_stocked` had nothing; `errand_step` then named every thing any
-- work wanted (`hod_wanted`), held or not, and no gate but a bridge span's.
--
--   * A wall, floor or column within reach, its keeper's, reached, wanting something the stores hold, under a gate
--     over the carrier's level: `gate`, naming that work's first unmet gate (material, then wall or floor type) and its
--     distance in rings from the totem, the nearest such work first (`hod_build_gate`). After `stairs`, before the
--     bridge span gate: where both apply, the build gate is named.
--   * `stock` names only what the work within reach wants that the stores do not hold, unlocked (`hod_lacking`); with
--     nothing lacking, `range`.
--
-- The browser's twins: `Game.hodGatedBuild`, `hodGate` (craftgates.ts) and `Game.hodWanted` with `stocked`.

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

-- The gates on fitting what a wall, a floor or a column wants, by its material and type (a change planned on a wall by
-- the change's), in `build_gates` order: what `hod_may` checks of them.
create or replace function public.hod_build_gates(p_world uuid, p_kind text, p_level int, p_dir text, p_x int, p_y int)
 returns table(ord int, kind text, id text, name text, skill text, level int)
 language sql
 stable
as $$
  select b.ord, b.kind, b.id, b.name, b.skill, b.level
    from wall w
    left join wall_change ch on ch.world_id = w.world_id and ch.level = w.level and ch.dir = w.dir and ch.x = w.x and ch.y = w.y
    cross join lateral build_gates(coalesce(ch.material, w.material), coalesce(ch.type, w.type), null, null) b
   where p_kind = 'wall' and w.world_id = p_world and w.level = p_level and w.dir = p_dir and w.x = p_x and w.y = p_y
  union all
  select b.ord, b.kind, b.id, b.name, b.skill, b.level
    from floor_tile f cross join lateral build_gates(f.material, null, f.kind, f.hand) b
   where p_kind = 'floor' and f.world_id = p_world and f.level = p_level and f.x = p_x and f.y = p_y
  union all
  select b.ord, b.kind, b.id, b.name, b.skill, b.level
    from building_column bc cross join lateral build_gates(bc.material, null, null, null) b
   where p_kind = 'column' and bc.world_id = p_world and bc.level = p_level and bc.x = p_x and bc.y = p_y
$$;

-- The nearest wall, floor or column within reach that is its keeper's, reached, wants something the stores hold and is
-- gated over the carrier's level: its first unmet gate, and how many rings from the totem it is. Ties as `hod_needing`
-- has them: kind, storey, side, x, y. Its outs null where there is none (`Game.hodGatedBuild`).
create or replace function public.hod_build_gate(p_world uuid, c creature, p_cx int, p_cy int, p_range int,
                                                 out kind text, out id text, out n int)
 language sql
 stable
as $$
  with work as materialized (
    select h.* from hod_work(p_world, p_cx, p_cy, p_range) h
     where h.kind in ('wall', 'floor', 'column')
       and hod_work_mine(p_world, c.keeper, h.dir, h.x, h.y)
       and not hod_may(p_world, c, h.kind, h.level, h.dir, h.x, h.y)
  ),
  have as materialized (
    select distinct (s.it).def as def from deed_store_items(p_world, c.keeper) s
     where (s.it).count > 0 and not coalesce((s.it).locked, false)
       and exists (select 1 from work)
  )
  select g.kind, g.id, greatest(abs(w.x - p_cx), abs(w.y - p_cy))::int
    from work w
    cross join lateral (select b.kind, b.id from hod_build_gates(p_world, w.kind, w.level, w.dir, w.x, w.y) b
                         where worker_level(c, b.skill) < b.level
                         order by b.ord limit 1) g
   where exists (select 1 from jsonb_each_text(w.needed) e where e.value::int > 0 and e.key in (select hv.def from have hv))
     -- On the ground, or a floor of storey 1, always reached: the reach of the whole range only for work above.
     and (w.level <= 0 or (w.kind = 'floor' and w.level = 1)
          or hod_reached(p_world, w.kind, w.level, w.dir, w.x, w.y,
                         (select storey_reach(p_world, p_cx - p_range - 1, p_cy - p_range - 1, p_cx + p_range + 1, p_cy + p_range + 1))))
   order by (w.x - p_cx) ^ 2 + (w.y - p_cy) ^ 2, hod_rank(w.kind), w.level, w.dir collate "C", w.x, w.y
   limit 1
$$;

-- What the keeper's work within reach wants that its stores do not hold (unlocked, more than none): each thing once,
-- nearest the work wanting it first, then by name, up to `idle_wants()`; and how many things that is. `hod_wanted`,
-- less what the stores hold.
create or replace function public.hod_lacking(p_world uuid, p_cx int, p_cy int, p_range int, p_keeper uuid)
 returns table(items text[], n int)
 language sql
 stable
as $$
  with have as materialized (
    select distinct (s.it).def as def from deed_store_items(p_world, p_keeper) s
     where (s.it).count > 0 and not coalesce((s.it).locked, false)
  ),
  each_ as (
    select e.key as item, min((w.x - p_cx) ^ 2 + (w.y - p_cy) ^ 2) as d
    from hod_work(p_world, p_cx, p_cy, p_range) w cross join lateral jsonb_each_text(w.needed) e
    where e.value::int > 0 and hod_work_mine(p_world, p_keeper, w.dir, w.x, w.y)
      and not exists (select 1 from have hv where hv.def = e.key)
    group by e.key
  )
  select (array_agg(item order by d, item collate "C"))[1:idle_wants()], count(*)::int from each_
$$;

select pg_temp.patch_fn('public.errand_step(uuid,integer,text)'::regprocedure,
$o$        if why_n is not null then why := 'stairs'; return next; return; end if;
$o$,
$n$        if why_n is not null then why := 'stairs'; return next; return; end if;
        -- A wall, floor or column within reach wanting what the stores hold, over its own level: `gate`, naming the
        -- nearest one's first unmet gate, material then type (`hod_build_gate`). Before a bridge span's.
        select array[s.kind, s.id], s.n into why_what, why_n from hod_build_gate(p_world, c, dd.x, dd.y, rng) s where s.kind is not null;
        if why_what is not null then why := 'gate'; return next; return; end if;
$n$);

select pg_temp.patch_fn('public.errand_step(uuid,integer,text)'::regprocedure,
$o$        -- Work within reach wanting only what the stores do not hold: `stock`, and what it wants. None: `range`.
        select * into v_wet from hod_wanted(p_world, dd.x, dd.y, rng, c.keeper);$o$,
$n$        -- Work within reach wanting what the stores do not hold: `stock`, naming only that (`hod_lacking`). Nothing
        -- lacking: `range`.
        select * into v_wet from hod_lacking(p_world, dd.x, dd.y, rng, c.keeper);$n$);

select private.lock_doors();
