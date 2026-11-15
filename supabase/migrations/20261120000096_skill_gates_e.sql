-- Skill gates, the fifth set: the user's answers to batch D's questions.
--
--   * Pouring iron at blacksmithing 1 (was 5, its seam's mining gate), so a fresh nail smith pours; steel, an alloy of
--     iron and coal, follows its one metal down to 1: rows of `skill_gate`, `npm run defs` (20261120000075).
--   * A prospector reads the ground as Prospect does: every seam in its circle, bare, under soil or below water; a
--     buried one over its keeper's prospecting gate told as "Unidentified metal" (`read_ground`, `seen_vein_at`).
--   * The Guiding Light's suggested sites count only the trees the player's woodcutting fells (`thepath_sites`,
--     `tree_fells`): a wood of oak is no site at woodcutting 1.
--   * Mine out the cellar cuts the rock under the building as a face of it would be cut: a seam by its mining, a stone
--     by its quarrying (rock 1, sandstone 10, slate 20, marble 30), in the one rule's words (`rock_gate_refusal`, the
--     check `face_gate_refusal` and `cellar_refusal` share). No worker digs cellars.

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

/* ---- A prospector finds buried veins ---------------------------------------------------------------------------- */

select pg_temp.patch_fn('read_ground(uuid,integer,integer,integer,integer)',
$o$    where land_tile(p_world, x, y) = tile_id('Rock') and (bedrock_at(p_world, x, y)).ore$o$,
$n$    -- Every seam, wherever it lies, as Prospect reads it: bare, under soil, or below water; a buried one over the
    -- keeper's prospecting gate is "Unidentified metal" (`seen_vein_at`).
    where (bedrock_at(p_world, x, y)).seam$n$);

/* ---- The Guiding Light's sites: only trees you fell ------------------------------------------------------------- */

-- Whether a tree tile's species is at or under somebody's woodcutting (`TREE_GATE`), whatever its age: `fellsSaid`.
create or replace function tree_fells(p_data int, p_have double precision) returns boolean
language sql stable as $$
  select coalesce((select g.level from skill_gate g join tree_def t on g.kind = 'tree' and g.id = lower(t.name)
                    where t.id = tree_species(p_data)), 0) <= p_have
$$;

select pg_temp.patch_fn('thepath_sites(uuid,uuid)',
$o$  v_tree int := tile_id('Tree'); v_rock int := tile_id('Rock');$o$,
$n$  v_tree int := tile_id('Tree'); v_rock int := tile_id('Rock'); v_fell boolean[];$n$);
select pg_temp.patch_fn('thepath_sites(uuid,uuid)',
$o$  select size into v_size from world where id = p_world;$o$,
$n$  select size into v_size from world where id = p_world;
  -- Only the trees your woodcutting fells count (`fellsSaid`): each tile data byte's species, at your level.
  select array_agg(tree_fells(d, skill_of(p_world, p_uid, 'woodcutting')) order by d) into v_fell from generate_series(0, 255) d;$n$);
select pg_temp.patch_fn('thepath_sites(uuid,uuid)',
$o$    select ii.i, substr(t.tiles, x0 + 1, nx) as tl,$o$,
$n$    select ii.i, substr(t.tiles, x0 + 1, nx) as tl, substr(t.data, x0 + 1, nx) as dt,$n$);
select pg_temp.patch_fn('thepath_sites(uuid,uuid)',
$o$    select rw.i, jj.j, (b.tile = v_tree)::int as vt,$o$,
$n$    select rw.i, jj.j, (b.tile = v_tree and v_fell[b.dat + 1])::int as vt,$n$);
select pg_temp.patch_fn('thepath_sites(uuid,uuid)',
$o$      cross join lateral (select case when jj.j > 0 and rw.tl is not null then get_byte(rw.tl, jj.j - 1) else -1 end as tile) b$o$,
$n$      cross join lateral (select case when jj.j > 0 and rw.tl is not null then get_byte(rw.tl, jj.j - 1) else -1 end as tile,
                                 case when jj.j > 0 and rw.dt is not null then get_byte(rw.dt, jj.j - 1) else 0 end as dat) b$n$);

/* ---- Cellars cut by the rock's gate ------------------------------------------------------------------------------ */

-- Cutting a rock, bare or under a building: its gate for somebody, or null (`rockGateRefusal`). A seam's by its mining,
-- less a Miner's Ore Sense; a plain stone's by its quarrying. "Marble: needs mining 30; have 12.0."
create or replace function rock_gate_refusal(p_world uuid, p_uid uuid, r rock_def) returns text
language plpgsql stable as $$
declare g skill_gate;
begin
  g := skill_gate_of(case when r.seam then 'seam' else 'stone' end, r.yields);
  if g.kind is null then return null; end if;
  return skill_gate_refusal(r.name, g.skill, skill_of(p_world, p_uid, g.skill),
    case when r.seam then greatest(0, g.level - pk(p_world, p_uid, 'ore:below', 0))::int else g.level end);
end $$;

-- A bare face's: the same check (`faceGateRefusal`).
create or replace function face_gate_refusal(p_world uuid, p_uid uuid, p_x int, p_y int) returns text
language plpgsql stable as $$
begin
  if land_tile(p_world, p_x, p_y) <> tile_id('Rock') then return null; end if;
  return rock_gate_refusal(p_world, p_uid, bedrock_at(p_world, p_x, p_y));
end $$;

-- Mine out the cellar: the rock under the building, as a face of it.
select pg_temp.patch_fn('cellar_refusal(uuid,uuid,text,jsonb)',
$o$    -- A seam under the building gives up its metal only to somebody who knows how to take it, as a face of it would.
    r := bedrock_at(p_world, v_x, v_y);
    v_need := greatest(0, r.level - pk(p_world, p_uid, 'ore:below', 0));
    v_mining := skill_of(p_world, p_uid, 'mining');
    if r.ore and v_mining < v_need then
      return r.name || ': needs mining ' || rtrim(rtrim(to_char(v_need, 'FM990.99'), '0'), '.')
        || '; have ' || to_char(v_mining, 'FM990.0') || '.';
    end if;
    return null;$o$,
$n$    -- The rock under the building is cut as a face of it would be: a seam by its mining, a stone (sandstone, slate,
    -- marble) by its quarrying (`rockGateRefusal`).
    return rock_gate_refusal(p_world, p_uid, bedrock_at(p_world, v_x, v_y));$n$);

select private.lock_doors();
