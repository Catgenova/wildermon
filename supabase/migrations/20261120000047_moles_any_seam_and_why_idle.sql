-- Moles: any bare seam, whatever their mining; a miner's idle line names what is wrong; work range off the defs.
--
-- Asked for: "Remove ore level requirements for oremander line": the Ironemole line (`mola`) mines any bare seam in
-- range whatever its mining (`species_def.any_seam`, the browser's `SpeciesDef.anySeam`), in `worker_gatherable` and
-- in what `seam_beyond` tells its keeper. Everything else about a seam stays: bare rock only, depth, reach, range, and
-- yield and QL by its mining. Players and every other kind keep their levels.
--
-- Reported: an Ironemole at mining 1 by bare rock near the totem, its card "Idle: no bare rock with a seam in it within
-- 8 tiles of the totem". A miner with nothing to work now says why (`mine_idle`, the browser's `mineIdle`): a bare seam
-- above its mining (`seam`: its yield in `idle_what`, its tiles off in `idle_n`), or bare rock with no seam in any of it
-- (`noseam`); else no bare rock with a seam in it, as before (`range`).
--
-- And a kind's work range per ten levels of its task skill is its own (`species_def.range_per_step`, the browser's
-- `SpeciesDef.rangePerStep`, `range_per_step()` for the rest), which the island never read: an Oremander at mining 55
-- searched 58 tiles while its card said 33.

set local lock_timeout = '3s';

-- Why a miner with no seam to work within `p_range` of (`p_cx`, `p_cy`) is idle, or nulls: the bare Rock no other
-- worker is at (`work_tile_may`) on ground it may work (`worker_ground`). A seam above its mining, worked to depth and
-- reach, the softest then the nearest (`seam`); else bare rock and no seam in any of it (`noseam`, the range).
create or replace function mine_idle(p_world uuid, p_cx int, p_cy int, p_range int, c creature,
                                     out why text, out n double precision, out what text[])
returns record language plpgsql stable as $fn$
declare v_may boolean[]; v_w int := 2 * p_range + 1; v_any boolean; v_skill double precision;
        v_bare boolean := false; v_seam boolean := false; v_best int; v_d int; v_yields text; r record; k rock_def;
begin
  if p_range < 0 then return; end if;
  v_may := private.work_tile_may(p_world, p_cx, p_cy, p_range, 'mine', c.id);
  if v_may is null then return; end if;
  v_any := coalesce((select sd.any_seam from species_def sd where sd.id = c.species), false);
  v_skill := task_skill(c);
  for r in
    select p_cx + t.dx as gx, p_cy + t.dy as gy, greatest(abs(t.dx), abs(t.dy)) as d
      from (select (u.i - 1)::int % v_w - p_range as dx, (u.i - 1)::int / v_w - p_range as dy
              from unnest(v_may) with ordinality u(m, i) where u.m) t
  loop
    if c.keeper is not null and not private.worker_ground(p_world, c.keeper, r.gx, r.gy) then continue; end if;
    v_bare := true;
    k := bedrock_at(p_world, r.gx, r.gy);
    if not k.seam then continue; end if;
    v_seam := true;
    if v_any or k.level <= v_skill or rock_height(p_world, r.gx, r.gy) <= -mine_depth() or not face_reach(p_world, r.gx, r.gy) then
      continue;
    end if;
    if v_best is null or k.level < v_best or (k.level = v_best and r.d < v_d) then
      v_best := k.level; v_d := r.d; v_yields := k.yields;
    end if;
  end loop;
  if v_best is not null then
    why := 'seam'; n := v_d; what := array[v_yields];
  elsif v_bare and not v_seam then
    why := 'noseam'; n := p_range;
  end if;
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Any seam for a kind that takes any (`any_seam`).
    ('public', 'worker_gatherable', 1,
     $$    return here = tile_id('Rock') and rock.seam and rock.level <= task_skill(c)$$,
     $$    return here = tile_id('Rock') and rock.seam
       and (rock.level <= task_skill(c) or coalesce((select sd.any_seam from species_def sd where sd.id = c.species), false))$$),
    ('public', 'seam_beyond', 1,
     $$    and (bedrock_at(p_world, gx, gy)).level > task_skill(c)$$,
     $$    and (bedrock_at(p_world, gx, gy)).level > task_skill(c)
    and not coalesce((select sd.any_seam from species_def sd where sd.id = c.species), false)$$),
    -- Its own range per step of skill (`range_per_step`).
    ('public', 'work_range', 1,
     $$floor(task_skill(c) / 10) * 10$$,
     $$floor(task_skill(c) / skill_step()) * coalesce(d.range_per_step, range_per_step())$$),
    -- A miner's why (`mine_idle`).
    ('public', 'worker_settle', 1,
     $$        v_hy_tried boolean := false; -- a hybrid that has looked for its second trade's work$$,
     $$        v_hy_tried boolean := false; -- a hybrid that has looked for its second trade's work
        v_mi record; -- a miner's why (`mine_idle`)$$),
    ('public', 'worker_settle', 1,
     $$        -- dry for the day is not mistaken for one that is stuck.
        c.idle_since := coalesce(c.idle_since, now()); c.idle_what := null; c.idle_why := 'range'; c.idle_n := v_site.radius;$$,
     $$        -- dry for the day is not mistaken for one that is stuck.
        c.idle_since := coalesce(c.idle_since, now()); c.idle_what := null; c.idle_why := 'range'; c.idle_n := v_site.radius;
        -- A miner says what is wrong with the bare rock it has (`mine_idle`).
        if kind = 'mine' then
          select * into v_mi from mine_idle(p_world, v_site.x, v_site.y, v_site.radius, c);
          if v_mi.why is not null then c.idle_why := v_mi.why; c.idle_n := v_mi.n; c.idle_what := v_mi.what; end if;
        end if;$$),
    -- And the seam it names, to the browser.
    ('public', 'rpc_creatures', 1,
     $$case when c.idle_why = 'stock' then to_jsonb(c.idle_what) end$$,
     $$case when c.idle_why in ('stock', 'seam') then to_jsonb(c.idle_what) end$$)
  ) as t(sch, fn, times, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.times then raise exception '%.% has % of the lines to change, not %', r.sch, r.fn, v_n, r.times; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
