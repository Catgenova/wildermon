-- Skill gates: one rule for what a skill level opens; felling trees by woodcutting the first gate on it.
--
-- Asked for: "cutting trees is similarly gated, with willow requiring the highest level and pine the least. Oak birch
-- and maple early on", and every gate the same way, for players and for wildermon working at their own level.
--
-- A thing has at most one gate, a skill and a level, held once in `src/game/skillgates.ts` and emitted to `skill_gate`
-- (kind, id, name, skill, level) by `npm run defs`. The one check is `skill_gate_refusal`, in the words mining has always
-- used: "Willow: needs woodcutting 70; have 12.4." (the browser's `skillGateRefusal`, word for word). A worker uses the same
-- gate against its own level, its task skill (`worker_gate_open`), never takes work over it, and one with only
-- gated work in reach says so (`gate_idle`: idle_why 'gate', idle_what [kind, id], idle_n its tiles off).
--
-- The first gate: felling a tree with logs in it -- Cut down (`gather_refusal`), Coppice (`ground_refusal`) and a
-- feller's work (`worker_gatherable`, `worker_do`) -- by woodcutting, per species (`tree_gate`). A tree with no logs yet
-- is cleared by anybody, and a bush is not a tree. docs/gating.md has the rest of the table, to come on this rule.

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
create table if not exists skill_gate (
  kind text not null, id text not null, name text not null, skill text not null, level int not null, primary key (kind, id)
);

/* ---- The rule ---------------------------------------------------------------------------------------------------- */

-- The one refusal: null at or over the level, else "Willow: needs woodcutting 70; have 12.4." (`skillGateRefusal`).
create or replace function skill_gate_refusal(p_name text, p_skill text, p_have double precision, p_need int) returns text
language sql stable as $$
  select case when p_have >= p_need then null
    else p_name || ': needs ' || lower(coalesce((select s.name from skill_def s where s.id = p_skill), replace(p_skill, '_', ' ')))
      || ' ' || p_need || '; have ' || to_char(p_have, 'FM990.0') || '.' end
$$;

-- The gate on a thing, or no row: it is open to all (`gateOf`).
create or replace function skill_gate_of(p_kind text, p_id text) returns skill_gate
language sql stable as $$
  select g.* from skill_gate g where g.kind = p_kind and g.id = p_id
$$;

-- A worker's own level, its task skill (`task_skill`), meets the gate, or there is no gate (`gateOpen`).
create or replace function worker_gate_open(c creature, g skill_gate) returns boolean
language sql stable as $$
  select g.kind is null or task_skill(c) >= g.level
$$;

/* ---- Trees, by woodcutting --------------------------------------------------------------------------------------- */

-- A tree tile's felling gate, or no row for a tree with no logs in it: those anybody clears (`treeGate`).
create or replace function tree_gate(p_data int) returns skill_gate
language sql stable as $$
  select g.* from skill_gate g join tree_def t on g.kind = 'tree' and g.id = lower(t.name)
   where t.id = tree_species(p_data)
     and coalesce((select a.logs from tree_age_def a where a.id = tree_age(p_data)), 0) > 0
$$;

-- A person's refusal of a tree tile's felling, or null (`treeGateRefusal`).
create or replace function tree_gate_refusal(p_world uuid, p_uid uuid, p_data int) returns text
language plpgsql stable as $$
declare g skill_gate;
begin
  g := tree_gate(p_data);
  if g.kind is null then return null; end if;
  return skill_gate_refusal(g.name, g.skill, skill_of(p_world, p_uid, g.skill), g.level);
end $$;

-- Why a feller with no tree to work within `p_range` of (`p_cx`, `p_cy`) is idle, or nulls: a tree with logs whose
-- gate is over its own level, the lowest gate then the nearest (`gate`, idle_what [kind, id], n its tiles off). The
-- trees asked are those no other worker is at (`work_tile_may`), on ground it may work, with a tile beside to stand on.
-- The browser's `gateIdle`.
create or replace function gate_idle(p_world uuid, p_cx int, p_cy int, p_range int, c creature, p_kind text,
                                     out why text, out n double precision, out what text[])
returns record language plpgsql stable as $fn$
declare v_may boolean[]; v_w int := 2 * p_range + 1; v_best int; v_d int; v_id text; r record; g skill_gate;
begin
  if p_range < 0 or p_kind is distinct from 'woodcut' then return; end if;
  v_may := private.work_tile_may(p_world, p_cx, p_cy, p_range, p_kind, c.id);
  if v_may is null then return; end if;
  for r in
    select p_cx + t.dx as gx, p_cy + t.dy as gy, greatest(abs(t.dx), abs(t.dy)) as d
      from (select (u.i - 1)::int % v_w - p_range as dx, (u.i - 1)::int / v_w - p_range as dy
              from unnest(v_may) with ordinality u(m, i) where u.m) t
  loop
    if c.keeper is not null and not private.worker_ground(p_world, c.keeper, r.gx, r.gy) then continue; end if;
    g := tree_gate(land_data(p_world, r.gx, r.gy));
    if worker_gate_open(c, g) then continue; end if;
    if v_best is not null and (g.level > v_best or (g.level = v_best and r.d >= v_d)) then continue; end if;
    if not exists (select 1 from beside_tile(p_world, r.gx, r.gy)) then continue; end if;
    v_best := g.level; v_d := r.d; v_id := g.id;
  end loop;
  if v_best is not null then
    why := 'gate'; n := v_d; what := array['tree', v_id];
  end if;
end $fn$;

/* ---- Where it is checked ----------------------------------------------------------------------------------------- */

-- Cut down: after the tree and its bench, as the browser's `cut_down` asks it.
select pg_temp.patch_fn('gather_refusal(uuid,uuid,text,jsonb)',
$o$      return fitting_said('benchRound', null, null);
    end if;$o$,
$n$      return fitting_said('benchRound', null, null);
    end if;
    -- A tree with logs in it fells only at its woodcutting (`skillgates.ts`).
    if here = tile_id('Tree') then return tree_gate_refusal(p_world, p_uid, land_data(p_world, tx, ty)); end if;$n$);

-- Coppice: after its age.
select pg_temp.patch_fn('ground_refusal(uuid,uuid,text,jsonb)',
$o$      return v_tree.name || ': too young to coppice.';
    end if;$o$,
$n$      return v_tree.name || ': too young to coppice.';
    end if;
    -- And only at its woodcutting (`skillgates.ts`).
    if tree_gate_refusal(p_world, p_uid, v_data) is not null then return tree_gate_refusal(p_world, p_uid, v_data); end if;$n$);

-- A feller takes only a tree its own woodcutting may fell.
select pg_temp.patch_fn('worker_gatherable(uuid,integer,integer,text,creature)',
$o$  if p_kind = 'woodcut' then
    return here = tile_id('Tree') and exists (select 1 from beside_tile(p_world, p_x, p_y));$o$,
$n$  if p_kind = 'woodcut' then
    return here = tile_id('Tree') and exists (select 1 from beside_tile(p_world, p_x, p_y))
       and worker_gate_open(c, tree_gate(land_data(p_world, p_x, p_y)));$n$);

-- And never swings at one over it, however it came to be at one.
select pg_temp.patch_fn('worker_do(uuid,integer)',
$o$    -- A worker swings the same number of times a person would, and the notch it$o$,
$n$    if not worker_gate_open(c, tree_gate(data)) then return null; end if;
    -- A worker swings the same number of times a person would, and the notch it$n$);

-- An idle feller says what is wrong with the trees it has (`gate_idle`), as a miner does with its seams.
select pg_temp.patch_fn('worker_settle(uuid,integer)',
$o$          if v_mi.why is not null then c.idle_why := v_mi.why; c.idle_n := v_mi.n; c.idle_what := v_mi.what; end if;
        end if;$o$,
$n$          if v_mi.why is not null then c.idle_why := v_mi.why; c.idle_n := v_mi.n; c.idle_what := v_mi.what; end if;
        elsif kind = 'woodcut' then
          select * into v_mi from gate_idle(p_world, v_site.x, v_site.y, v_site.radius, c, kind);
          if v_mi.why is not null then c.idle_why := v_mi.why; c.idle_n := v_mi.n; c.idle_what := v_mi.what; end if;
        end if;$n$);

-- An hour of it to its keeper names the gate rather than its range.
select pg_temp.patch_fn('worker_idle(uuid,creature,text,integer,integer,integer,bigint)',
$o$  perform wtell(p_world, c.keeper, c.name || ' idle: no ' || work_words(p_kind)$o$,
$n$  if c.idle_why = 'gate' and array_length(c.idle_what, 1) >= 2 then
    perform wtell(p_world, c.keeper, c.name || ' idle: only work above its level within ' || p_radius || ' tiles of ' || v_where || '. '
      || (select skill_gate_refusal(g.name, g.skill, task_skill(c), g.level)
            from skill_gate g where g.kind = c.idle_what[1] and g.id = c.idle_what[2]), 'error');
    return;
  end if;

  perform wtell(p_world, c.keeper, c.name || ' idle: no ' || work_words(p_kind)$n$);

-- And the gate it names, to the browser.
select pg_temp.patch_fn('rpc_creatures(uuid,double precision,text,integer[],boolean)',
$o$case when c.idle_why in ('stock', 'seam') then to_jsonb(c.idle_what) end$o$,
$n$case when c.idle_why in ('stock', 'seam', 'gate') then to_jsonb(c.idle_what) end$n$);

select private.lock_doors();
