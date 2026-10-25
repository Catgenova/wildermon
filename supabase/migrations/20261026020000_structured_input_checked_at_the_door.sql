-- Structured input checked at the door, before anything reads it.
--
-- Ten `rpc_*` doors take jsonb from the browser. Each read what it wanted out of it with `->>` and a cast,
-- so a key of the wrong type was a cast error raised from wherever it was first read, a list was as long
-- as the caller liked (`rpc_settle`'s ticks were kept, every one, on the player row), and a key nobody
-- reads was carried into `act_target` and the queue and kept.
--
-- Now each of them starts with `private.check_args(door, arg, value, spec)`: the keys a value may have,
-- the type of each, its range or its length, and how many there may be. Anything else is refused before
-- the door does anything, in one line: "Bad request: <door> <arg>.<key>: <what is wrong>." The specs are
-- `private.spec_*()`, written against what the browser sends (`src/net/island.ts`, `src/game/actions.ts`
-- `Target`, `src/ui/spellbar.ts` `SpellAim`) and what the island reads.
--
-- ---- the first lines of a door, kept there ---------------------------------------------------------
--
-- `private.door_guard` lists statements that belong at the very top of a function's body, in order, after
-- its knock (`private.pace`, the first statement of every door) where it has one;
-- `private.guard_doors()` puts back any that a later `create or replace` dropped, and `private.lock_doors()`
-- runs it after `pace_doors`, so a door rewritten by any later migration starts the same way again.

set local lock_timeout = '3s';

/* ---- door_guard ----------------------------------------------------------------------------------- */

create table if not exists private.door_guard (
  door text not null,
  ord int not null,
  line text not null,
  primary key (door, line)
);
alter table private.door_guard enable row level security;
revoke all on table private.door_guard from public, anon, authenticated;

/**
 * Put every `door_guard` line at the top of its door, in `ord` order: the first statements after the body's
 * own `begin` (a line that is that word alone, after a `declare` or none) and its knock, where it has one. A door whose top is already
 * exactly those lines is left alone; one that is not PL/pgSQL, or has no such `begin`, is warned of and left.
 * Every overload of a name is a door. Returns how many it rewrote.
 */
create or replace function private.guard_doors() returns int language plpgsql as $fn$
declare f record; d text; v_head int; v_body text; v_pre text; v_lines text; v_rest text; v_line text; v_n int := 0;
begin
  for f in
    select p.oid, p.proname, l.lanname, string_agg(E'\n  ' || dg.line, '' order by dg.ord, dg.line) as lines,
           array_agg(dg.line) as each_line
      from private.door_guard dg
      join pg_proc p on p.proname = dg.door and p.prokind = 'f'
      join pg_namespace ns on ns.oid = p.pronamespace and ns.nspname in ('public', 'private')
      join pg_language l on l.oid = p.prolang
     group by p.oid, p.proname, l.lanname
  loop
    -- A door the lines cannot go into is said, and left: the tests that ask for each line find it missing.
    if f.lanname <> 'plpgsql' then raise warning 'guard_doors: % is %', f.proname, f.lanname; continue; end if;
    d := pg_get_functiondef(f.oid);
    v_head := position(E'AS $function$\n' in d);
    if v_head = 0 then raise warning 'guard_doors: % has no $function$ body', f.proname; continue; end if;
    v_head := v_head + length(E'AS $function$\n');
    v_body := substr(d, v_head);
    if v_body like E'begin\n%' then v_pre := 'begin';
    elsif v_body ~ '^declare\M' and position(E'\nbegin\n' in v_body) > 0 then
      v_pre := substr(v_body, 1, position(E'\nbegin\n' in v_body) + length('begin'));
    else
      raise warning 'guard_doors: % has no begin on a line of its own', f.proname;
      continue;
    end if;
    -- After the door's knock, which stays its first statement (`private.pace_doors`): a call refused for its
    -- arguments has still knocked.
    if substr(v_body, length(v_pre) + 1) like E'\n  perform private.pace(%' then
      v_pre := v_pre || E'\n' || split_part(substr(v_body, length(v_pre) + 1), E'\n', 2);
    end if;
    v_lines := f.lines;
    if substr(v_body, length(v_pre) + 1, length(v_lines)) = v_lines then continue; end if;
    -- Out of order or one missing: every guard line taken out wherever it stands, and all of them put back on top.
    v_rest := substr(v_body, length(v_pre) + 1);
    foreach v_line in array f.each_line loop
      v_rest := replace(v_rest, E'\n  ' || v_line, '');
    end loop;
    execute substr(d, 1, v_head - 1) || v_pre || v_lines || v_rest;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $fn$;
revoke all on function private.guard_doors() from public, anon, authenticated;

-- And from now on, every time the doors are locked: after `pace_doors`, before the grants.
do $do$
declare v_def text; v_old text := E'  perform private.pace_doors();\n';
begin
  v_def := pg_get_functiondef('private.lock_doors()'::regprocedure);
  if position('perform private.guard_doors();' in v_def) > 0 then return; end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'lock_doors: pace_doors anchor not once';
  end if;
  execute replace(v_def, v_old, v_old || E'  perform private.guard_doors();\n');
end $do$;

/* ---- check_args ----------------------------------------------------------------------------------- */

/*
 * A spec is jsonb:
 *
 *   {"t": "int" | "num" | "text" | "bool" | "uuid" | "object" | "array" | "any",
 *    "null": true             -- a JSON null (or SQL null) is let through
 *    "min", "max"             -- int and num: the range, inclusive
 *    "len"                    -- text: most characters
 *    "in": [...]              -- text: one of these
 *    "keys": {k: spec}        -- object: the keys it may have, each to its spec (a key set to null is one left out)
 *    "req": [k]               -- object: the keys it must have
 *    "each": spec             -- object: a map; every value to this spec (and `keys` not used)
 *    "kpat": regex            -- object map: every key matches this
 *    "most"                   -- object: most keys; array: most elements
 *    "least"                  -- array: fewest elements
 *    "of": spec}              -- array: every element to this
 *
 * and `"or": [spec, ...]` in place of `t` takes the first that fits.
 */

/** What is wrong with `v` against spec `s`, as "<path>: <words>", or null when nothing is. */
create or replace function private.arg_why(v jsonb, s jsonb, p_path text) returns text
language plpgsql immutable as $fn$
declare v_t text := s->>'t'; v_type text := jsonb_typeof(v); v_n numeric; v_s text; v_e jsonb; v_k text;
        v_i int := 0; v_why text; v_alt jsonb; v_most int := (s->>'most')::int;
begin
  if v is null or v_type = 'null' then
    if coalesce((s->>'null')::boolean, false) then return null; end if;
    return p_path || ': missing';
  end if;
  if s ? 'or' then
    for v_alt in select jsonb_array_elements(s->'or') loop
      if private.arg_why(v, v_alt, p_path) is null then return null; end if;
    end loop;
    return p_path || ': not ' || (select string_agg(coalesce(a->>'t', '?'), ' or ') from jsonb_array_elements(s->'or') a);
  end if;
  if v_t = 'any' then return null; end if;
  if v_t in ('int', 'num') then
    if v_type <> 'number' then return p_path || ': want a number'; end if;
    v_n := (v #>> '{}')::numeric;
    if v_t = 'int' and v_n <> trunc(v_n) then return p_path || ': want a whole number'; end if;
    if v_n < coalesce((s->>'min')::numeric, -9007199254740991) or v_n > coalesce((s->>'max')::numeric, 9007199254740991) then
      return p_path || ': out of range';
    end if;
    return null;
  end if;
  if v_t in ('text', 'uuid') then
    if v_type <> 'string' then return p_path || ': want text'; end if;
    v_s := v #>> '{}';
    if v_t = 'uuid' then
      if v_s !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return p_path || ': want an id'; end if;
      return null;
    end if;
    if char_length(v_s) > coalesce((s->>'len')::int, 64) then return p_path || ': too long'; end if;
    if s ? 'in' and not (s->'in' ? v_s) then return p_path || ': not one of its kinds'; end if;
    return null;
  end if;
  if v_t = 'bool' then
    if v_type <> 'boolean' then return p_path || ': want true or false'; end if;
    return null;
  end if;
  if v_t = 'array' then
    if v_type <> 'array' then return p_path || ': want a list'; end if;
    if jsonb_array_length(v) > coalesce(v_most, 100) then return p_path || ': too many'; end if;
    if jsonb_array_length(v) < coalesce((s->>'least')::int, 0) then return p_path || ': too few'; end if;
    if s ? 'of' then
      for v_e in select jsonb_array_elements(v) loop
        v_why := private.arg_why(v_e, s->'of', p_path || '[' || v_i || ']');
        if v_why is not null then return v_why; end if;
        v_i := v_i + 1;
      end loop;
    end if;
    return null;
  end if;
  if v_t = 'object' then
    if v_type <> 'object' then return p_path || ': want an object'; end if;
    if (select count(*) from jsonb_object_keys(v)) > coalesce(v_most, 64) then return p_path || ': too many keys'; end if;
    if s ? 'req' then
      select r into v_k from jsonb_array_elements_text(s->'req') r where not (v ? r) limit 1;
      if v_k is not null then return p_path || '.' || v_k || ': missing'; end if;
    end if;
    for v_k, v_e in select key, value from jsonb_each(v) loop
      -- A key set to null is a key left out, as every reader takes it (`->>` is null either way).
      continue when jsonb_typeof(v_e) = 'null' and not (s ? 'each');
      if s ? 'each' then
        if s ? 'kpat' and v_k !~ (s->>'kpat') then return p_path || '.' || left(v_k, 32) || ': not a key'; end if;
        v_why := private.arg_why(v_e, s->'each', p_path || '.' || v_k);
      elsif s->'keys' ? v_k then
        v_why := private.arg_why(v_e, s->'keys'->v_k, p_path || '.' || v_k);
      else
        return p_path || '.' || left(v_k, 32) || ': not a key';
      end if;
      if v_why is not null then return v_why; end if;
    end loop;
    return null;
  end if;
  raise exception 'arg_why: no such type as %', v_t;
end $fn$;

/** `p_value`, the `p_arg` of door `p_door`, against `p_spec`: through, or refused in one line. */
create or replace function private.check_args(p_door text, p_arg text, p_value jsonb, p_spec jsonb) returns void
language plpgsql stable as $fn$
declare v_why text;
begin
  v_why := private.arg_why(p_value, p_spec, p_arg);
  if v_why is not null then
    raise exception 'Bad request: % %.', p_door, v_why using errcode = '22023';
  end if;
end $fn$;

/* ---- the specs ------------------------------------------------------------------------------------ */

/*
 * What an action is pointed at (`Target` in src/game/actions.ts), every kind's keys in one object: the
 * kinds share most of them, and `act_refusal` asks each kind for its own. With the three a menu adds on the
 * way (`name`, `sure`, `dyeFrom`), and the few the island's own rules read off a target besides.
 */
create or replace function private.spec_target() returns jsonb language sql immutable as $fn$ select $j$
{"t": "object", "null": true, "most": 40, "keys": {
  "kind": {"t": "text", "in": ["tile", "crate", "person", "campfire", "smelter", "kiln", "furniture", "anvil", "post",
                               "trap", "bridge", "item", "ground", "creature", "self", "player", "placed", "area"]},
  "x": {"t": "num", "min": -100000, "max": 100000}, "y": {"t": "num", "min": -100000, "max": 100000},
  "cx": {"t": "num", "min": -100000, "max": 100000}, "cy": {"t": "num", "min": -100000, "max": 100000},
  "sx": {"t": "int", "min": 0, "max": 15}, "sy": {"t": "int", "min": 0, "max": 15},
  "level": {"t": "int", "min": -16, "max": 64},
  "width": {"t": "int", "min": 1, "max": 16},
  "head": {"t": "array", "least": 2, "most": 2, "of": {"t": "num", "min": -100000, "max": 100000}},
  "id": {"t": "int", "min": 0}, "itemUid": {"t": "int", "min": 0}, "mouldUid": {"t": "int", "min": 0},
  "scroll": {"t": "int", "min": 0}, "soul": {"t": "int", "min": 0}, "into": {"t": "int", "min": 0},
  "foe": {"t": "int", "min": 0}, "creature": {"t": "int", "min": 0}, "item": {"t": "int", "min": 0},
  "mould": {"t": "int", "min": 0}, "buildingId": {"t": "int", "min": 0}, "slot": {"t": "int", "min": 0, "max": 64},
  "uid": {"or": [{"t": "int", "min": 0}, {"t": "uuid"}], "null": true},
  "count": {"t": "int", "min": 0, "max": 1000000000},
  "upto": {"t": "num", "min": 0, "max": 1000},
  "radius": {"t": "num", "min": 0, "max": 1000},
  "terrace": {"t": "bool"}, "down": {"t": "bool"}, "sure": {"t": "bool"},
  "name": {"t": "text", "len": 200},
  "side": {"t": "text"}, "wallType": {"t": "text"}, "material": {"t": "text"}, "floorKind": {"t": "text"},
  "hand": {"t": "text"}, "roofShape": {"t": "text"}, "facing": {"t": "text"}, "spell": {"t": "text"},
  "species": {"t": "text"}, "stance": {"t": "text"}, "job": {"t": "text"}, "sex": {"t": "text"},
  "arrow": {"t": "text"}, "stone": {"t": "text"}, "wound": {"t": "text"}, "skill": {"t": "text"},
  "brew": {"t": "text"}, "dyeFrom": {"t": "text"}
}}
$j$::jsonb $fn$;

/** What a spell is cast at (`SpellAim` in src/ui/spellbar.ts; `spell_target` and `do_spell` read it). */
create or replace function private.spec_spell_target() returns jsonb language sql immutable as $fn$ select $j$
{"t": "object", "null": true, "most": 8, "keys": {
  "kind": {"t": "text", "in": ["self", "player", "creature", "item", "placed", "area"]},
  "uid": {"t": "uuid"}, "id": {"t": "int", "min": 0},
  "x": {"t": "num", "min": -100000, "max": 100000}, "y": {"t": "num", "min": -100000, "max": 100000}
}}
$j$::jsonb $fn$;

/** The queue as the browser last saw it (`Lined[]`). */
create or replace function private.spec_queue_seen() returns jsonb language sql immutable as $fn$ select $j$
{"t": "array", "null": true, "most": 200, "of": {"t": "object", "req": ["action"], "keys": {
  "action": {"t": "text"}, "goes": {"t": "int", "min": 0, "max": 100000}}}}
$j$::jsonb $fn$;

/** The springs the browser knows, by id, at the version it knows (`knownSprings`). */
create or replace function private.spec_springs_known() returns jsonb language sql immutable as $fn$ select $j$
{"t": "object", "null": true, "most": 5000, "kpat": "^[0-9]{1,18}$", "each": {"t": "int", "min": -1, "max": 2147483647}}
$j$::jsonb $fn$;

/** A band of land as `rowsOf` writes it: base64 rows no wider than an island of 4096 tiles. */
create or replace function private.spec_land_rows() returns jsonb language sql immutable as $fn$ select $j$
{"t": "array", "most": 256, "of": {"t": "object", "req": ["y"], "keys": {
  "y": {"t": "int", "min": 0, "max": 4096},
  "heights": {"t": "text", "len": 11000}, "dirt": {"t": "text", "len": 5500},
  "tiles": {"t": "text", "len": 5500}, "data": {"t": "text", "len": 5500}, "rock": {"t": "text", "len": 5500}}}}
$j$::jsonb $fn$;

/** The turns of a walk since its last word, `[x, y]` each (`walk_via_max` says how many count). */
create or replace function private.spec_move_via() returns jsonb language sql immutable as $fn$ select $j$
{"t": "array", "null": true, "most": 1000, "of": {"t": "array", "least": 2, "most": 2,
  "of": {"t": "num", "min": -100000, "max": 100000}}}
$j$::jsonb $fn$;

/** A face: one id a field (`look_clean` keeps only the fields and ids it has). */
create or replace function private.spec_look() returns jsonb language sql immutable as $fn$ select $j$
{"t": "object", "null": true, "most": 32, "kpat": "^[A-Za-z_]{1,32}$", "each": {"t": "text", "null": true}}
$j$::jsonb $fn$;

/** Goals ticked off since the last beat, by id. */
create or replace function private.spec_ticked() returns jsonb language sql immutable as $fn$ select $j$
{"t": "array", "null": true, "most": 500, "of": {"t": "text", "len": 80}}
$j$::jsonb $fn$;

revoke all on function private.arg_why(jsonb, jsonb, text), private.check_args(text, text, jsonb, jsonb),
  private.spec_target(), private.spec_spell_target(), private.spec_queue_seen(), private.spec_springs_known(),
  private.spec_land_rows(), private.spec_move_via(), private.spec_look(), private.spec_ticked()
  from public, anon, authenticated;

/* ---- the ten doors -------------------------------------------------------------------------------- */

insert into private.door_guard (door, ord, line) values
  ('rpc_act', 10, 'perform private.check_args(''rpc_act'', ''p_target'', p_target, private.spec_target());'),
  ('rpc_plan_hidden_wall', 10, 'perform private.check_args(''rpc_plan_hidden_wall'', ''p_target'', p_target, private.spec_target());'),
  ('rpc_cast_spell', 10, 'perform private.check_args(''rpc_cast_spell'', ''p_target'', p_target, private.spec_spell_target());'),
  ('rpc_spell', 10, 'perform private.check_args(''rpc_spell'', ''p_target'', p_target, private.spec_spell_target());'),
  ('rpc_queue_order', 10, 'perform private.check_args(''rpc_queue_order'', ''p_seen'', p_seen, private.spec_queue_seen());'),
  ('rpc_springs', 10, 'perform private.check_args(''rpc_springs'', ''p_known'', p_known, private.spec_springs_known());'),
  ('rpc_put_land', 10, 'perform private.check_args(''rpc_put_land'', ''p_rows'', p_rows, private.spec_land_rows());'),
  ('rpc_move', 10, 'perform private.check_args(''rpc_move'', ''p_via'', p_via, private.spec_move_via());'),
  ('rpc_set_look', 10, 'perform private.check_args(''rpc_set_look'', ''p_look'', p_look, private.spec_look());'),
  ('rpc_settle', 10, 'perform private.check_args(''rpc_settle'', ''p_ticked'', p_ticked, private.spec_ticked());')
on conflict do nothing;

select private.lock_doors();
