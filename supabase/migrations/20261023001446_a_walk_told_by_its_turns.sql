-- A walk told by its turns: `rpc_move` walks a word along the path, leg by leg, not in a straight line.
--
-- Reported: "pathfinding on longer/more complicated routes, especially while zoomed out, tends to move me part
-- of the way there then rubber band back to where i was last standing still or just a short distance into the
-- route and then cancels the movement."
--
-- `rpc_move` took a word about where the body is as a straight line from where it last had it, and asked
-- `walk_share` of that line. A path through a wood, round a rock or along a shore bends; the straight line
-- across a bend goes through the trees, the rock or the water the path went round, and the body was held at
-- the first of them. Every word after it was measured from there, across the same trees, until the browser was
-- further off than `SNAP_GAP` and was put back and stopped. A word a second at a walk is under a tile and a half
-- and seldom cuts a tree; a link slower than a second a round trip drops the words in between and the line is
-- two, three, five seconds long, and a frame that takes a fifth of a second zoomed out is part of every round
-- trip.
--
-- So a word now carries the turns of the path walked since the last (`p_via`, `[[x, y], ...]`, at most
-- `walk_via_max()`): the browser keeps every step of its path it arrives at and says the ones where the way
-- changes direction. The island walks the legs between them in order, `walk_share` on each, and holds the body
-- at the first thing in the way on any of them. The pace is the length of the legs, which is never less than the
-- straight line: `allowed` is measured along them, cut where it runs out (`walk_cut`), and `walk_ahead` takes
-- their length. A word may not carry more turns than `walk_via_max()`: refused, nothing done. Turns count only
-- on the ground, a storey to a storey, and not aboard; anywhere else the word is the straight line it was. The
-- climbing a walk teaches, the wear it puts on the ground and the tiles it counts go leg by leg too.

set local lock_timeout = '3s';

/** The most turns one word to `rpc_move` carries (`p_via`); the browser's `VIA_MAX`. */
create or replace function walk_via_max() returns int language sql immutable as $$ select 64 $$;

/** The length of a walk through these points, in order. */
create or replace function walk_length(p_xs double precision[], p_ys double precision[]) returns double precision
  language sql immutable as $$
  select coalesce(sum(sqrt(power(p_xs[i] - p_xs[i - 1], 2) + power(p_ys[i] - p_ys[i - 1], 2))), 0)
    from generate_series(2, coalesce(array_length(p_xs, 1), 0)) i
$$;

/** How many lines between tiles a walk through these points crosses, leg by leg. */
create or replace function walk_tiles(p_xs double precision[], p_ys double precision[]) returns int
  language sql immutable as $$
  select coalesce(sum(abs(floor(p_xs[i]) - floor(p_xs[i - 1])) + abs(floor(p_ys[i]) - floor(p_ys[i - 1]))), 0)::int
    from generate_series(2, coalesce(array_length(p_xs, 1), 0)) i
$$;

/** A walk through these points, as far along it as `p_room` goes and no further. */
create or replace function walk_cut(p_xs double precision[], p_ys double precision[], p_room double precision,
  out xs double precision[], out ys double precision[]) language plpgsql immutable as $$
declare i int; v_leg double precision; v_left double precision := greatest(0, p_room);
begin
  xs := array[p_xs[1]]; ys := array[p_ys[1]];
  for i in 2 .. coalesce(array_length(p_xs, 1), 1) loop
    v_leg := sqrt(power(p_xs[i] - p_xs[i - 1], 2) + power(p_ys[i] - p_ys[i - 1], 2));
    if v_leg > v_left then
      xs := xs || (p_xs[i - 1] + (p_xs[i] - p_xs[i - 1]) * (v_left / v_leg));
      ys := ys || (p_ys[i - 1] + (p_ys[i] - p_ys[i - 1]) * (v_left / v_leg));
      return;
    end if;
    xs := xs || p_xs[i]; ys := ys || p_ys[i];
    v_left := v_left - v_leg;
  end loop;
end $$;

/*
 * `rpc_move`, from its current definition, with `p_via` and the walk along it. The signature changes, so the
 * old one goes: two `rpc_move`s would leave PostgREST unable to choose between them for a browser that sends
 * four arguments.
 */
do $do$
declare v_def text; v_old text; v_new text; i int; v_n int;
  v_swap text[][] := array[
    -- the signature
    [E'p_level integer DEFAULT 0)\n',
     E'p_level integer DEFAULT 0, p_via jsonb DEFAULT NULL::jsonb)\n'],
    -- declare: the walk's points
    [E'        cart placed; beast creature; c double precision; v_tiles int; v_puller creature;\n',
     E'        cart placed; beast creature; c double precision; v_tiles int; v_puller creature;\n'
     || E'        v_xs double precision[]; v_ys double precision[]; v_turn jsonb; v_leg int;\n'],
    -- the turns, and the length of the walk through them
    [E'  far := sqrt(power(p_x - p.x, 2) + power(p_y - p.y, 2));\n',
     E'  far := sqrt(power(p_x - p.x, 2) + power(p_y - p.y, 2));\n'
     || E'  /*\n'
     || E'   * The turns of the path since the last word (`p_via`): the walk is the legs between them, in order, and\n'
     || E'   * its length theirs, never less than the straight line. On the ground, a storey to a storey, only.\n'
     || E'   */\n'
     || E'  v_xs := array[p.x]; v_ys := array[p.y];\n'
     || E'  if p_via is not null and jsonb_typeof(p_via) = ''array'' and jsonb_array_length(p_via) > 0 and p_level = 0 and p.level = 0 then\n'
     || E'    if jsonb_array_length(p_via) > walk_via_max() then\n'
     || E'      raise exception ''Too many turns in one step: % at most.'', walk_via_max();\n'
     || E'    end if;\n'
     || E'    for v_turn in select value from jsonb_array_elements(p_via) loop\n'
     || E'      if jsonb_typeof(v_turn) <> ''array'' or jsonb_typeof(v_turn->0) <> ''number'' or jsonb_typeof(v_turn->1) <> ''number'' then\n'
     || E'        raise exception ''a turn is [x, y]'';\n'
     || E'      end if;\n'
     || E'      if (v_turn->>0)::double precision < 0 or (v_turn->>1)::double precision < 0\n'
     || E'         or (v_turn->>0)::double precision > w.size or (v_turn->>1)::double precision > w.size then\n'
     || E'        raise exception ''that is off the island'';\n'
     || E'      end if;\n'
     || E'      v_xs := v_xs || (v_turn->>0)::double precision; v_ys := v_ys || (v_turn->>1)::double precision;\n'
     || E'    end loop;\n'
     || E'  end if;\n'
     || E'  v_xs := v_xs || p_x; v_ys := v_ys || p_y;\n'
     || E'  far := walk_length(v_xs, v_ys);\n'],
    -- a Telestone's grace: where the journey put it, and no walk
    [E'    p_x := p.x; p_y := p.y; p_level := p.level;\n    far := 0;\n',
     E'    p_x := p.x; p_y := p.y; p_level := p.level;\n    far := 0;\n    v_xs := array[p.x, p.x]; v_ys := array[p.y, p.y];\n'],
    -- held to the pace along the turns
    [E'  if far > allowed then\n    p_x := p.x + (p_x - p.x) * (allowed / far);\n    p_y := p.y + (p_y - p.y) * (allowed / far);\n    pulled := true;\n  end if;\n',
     E'  if far > allowed then\n'
     || E'    if array_length(v_xs, 1) > 2 then\n'
     || E'      -- As far along the turns as `allowed` goes.\n'
     || E'      select wc.xs, wc.ys into v_xs, v_ys from walk_cut(v_xs, v_ys, allowed) wc;\n'
     || E'      p_x := v_xs[array_upper(v_xs, 1)]; p_y := v_ys[array_upper(v_ys, 1)];\n'
     || E'    else\n'
     || E'      p_x := p.x + (p_x - p.x) * (allowed / far);\n'
     || E'      p_y := p.y + (p_y - p.y) * (allowed / far);\n'
     || E'    end if;\n'
     || E'    pulled := true;\n'
     || E'  end if;\n'],
    -- and walked leg by leg, held at the first thing in the way on any of them
    [E'  share := walk_share(p_world, me, p_level, p.x, p.y, p_x, p_y);\n',
     E'  if array_length(v_xs, 1) > 2 then\n'
     || E'    for v_leg in 2 .. array_length(v_xs, 1) loop\n'
     || E'      share := walk_share(p_world, me, p_level, v_xs[v_leg - 1], v_ys[v_leg - 1], v_xs[v_leg], v_ys[v_leg]);\n'
     || E'      if share < 1 then\n'
     || E'        v_xs := v_xs[1:v_leg]; v_ys := v_ys[1:v_leg];\n'
     || E'        v_xs[v_leg] := v_xs[v_leg - 1] + (v_xs[v_leg] - v_xs[v_leg - 1]) * share;\n'
     || E'        v_ys[v_leg] := v_ys[v_leg - 1] + (v_ys[v_leg] - v_ys[v_leg - 1]) * share;\n'
     || E'        blocked := true;\n'
     || E'        exit;\n'
     || E'      end if;\n'
     || E'    end loop;\n'
     || E'    p_x := v_xs[array_upper(v_xs, 1)]; p_y := v_ys[array_upper(v_ys, 1)];\n'
     || E'    share := 1;\n'
     || E'  else\n'
     || E'    share := walk_share(p_world, me, p_level, p.x, p.y, p_x, p_y);\n'
     || E'  end if;\n'],
    -- what the walk let stand, its length paid
    [E'  update player set x = p_x, y = p_y, level = p_level, moved_at = now(), seen_at = now(), away = false,\n'
     || E'         walk_ahead = greatest(0, v_ahead + sqrt(power(p_x - p.x, 2) + power(p_y - p.y, 2)))\n',
     E'  -- A word without turns is the straight line from where the body was to wherever it is now.\n'
     || E'  if array_length(v_xs, 1) <= 2 then v_xs := array[p.x, p_x]; v_ys := array[p.y, p_y]; end if;\n'
     || E'  update player set x = p_x, y = p_y, level = p_level, moved_at = now(), seen_at = now(), away = false,\n'
     || E'         walk_ahead = greatest(0, v_ahead + walk_length(v_xs, v_ys))\n'],
    -- the climbing, leg by leg
    [E'    foreach c in array walk_climbs(p_world, p.x, p.y, p_x, p_y) loop\n'
     || E'      if c > max_step() * climb_learn_from() then\n'
     || E'        perform skill_raise(p_world, me, ''climbing'', climb_learn() + c / max_step() * climb_learn_steep());\n'
     || E'      end if;\n'
     || E'    end loop;\n',
     E'    for v_leg in 2 .. array_length(v_xs, 1) loop\n'
     || E'      foreach c in array walk_climbs(p_world, v_xs[v_leg - 1], v_ys[v_leg - 1], v_xs[v_leg], v_ys[v_leg]) loop\n'
     || E'        if c > max_step() * climb_learn_from() then\n'
     || E'          perform skill_raise(p_world, me, ''climbing'', climb_learn() + c / max_step() * climb_learn_steep());\n'
     || E'        end if;\n'
     || E'      end loop;\n'
     || E'    end loop;\n'],
    -- the wear, leg by leg
    [E'    if floor(p_x) <> floor(p.x) or floor(p_y) <> floor(p.y) then\n'
     || E'      perform wear_walk(p_world, p.x, p.y, p_x, p_y);\n'
     || E'    end if;\n',
     E'    for v_leg in 2 .. array_length(v_xs, 1) loop\n'
     || E'      if floor(v_xs[v_leg]) <> floor(v_xs[v_leg - 1]) or floor(v_ys[v_leg]) <> floor(v_ys[v_leg - 1]) then\n'
     || E'        perform wear_walk(p_world, v_xs[v_leg - 1], v_ys[v_leg - 1], v_xs[v_leg], v_ys[v_leg]);\n'
     || E'      end if;\n'
     || E'    end loop;\n']];
begin
  v_def := pg_get_functiondef('public.rpc_move(uuid, double precision, double precision, integer)'::regprocedure);
  for i in 1 .. array_length(v_swap, 1) loop
    v_old := v_swap[i][1];
    v_new := v_swap[i][2];
    v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_n <> 1 then raise exception 'rpc_move: swap % found % times', i, v_n; end if;
    v_def := replace(v_def, v_old, v_new);
  end loop;
  -- And the tiles a walk counts, for awareness and for the reins (twice): leg by leg.
  v_old := 'least(20, abs(floor(p_x) - floor(p.x)) + abs(floor(p_y) - floor(p.y)))::int';
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 2 then raise exception 'rpc_move: the tiles counted % times', v_n; end if;
  v_def := replace(v_def, v_old, 'least(20, walk_tiles(v_xs, v_ys))::int');
  drop function public.rpc_move(uuid, double precision, double precision, integer);
  execute v_def;
end $do$;

select private.lock_doors();
