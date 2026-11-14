-- A body lies where it fell, and a heavy blow is seen as one.
--
-- Asked for: a body whose health reaches nought falls and lies there until it respawns or gets up, for its player and
-- for everybody watching (`src/game/fell.ts`, `src/sculpt/anim/clips/down-ko.ts`); and a heavy blow landing drawn as a
-- stumble back rather than a flinch (`src/sculpt/anim/clips/stumble.ts`).
--
-- `player.fell` is where the body fell (`{ x, y, level, at }`), written by `player_die` in the update that puts it on
-- the spawn (from the row as it was: the right-hand sides of an update read the old row), and taken off whenever the
-- offer of where to wake goes (`respawn_offer` once the body has left the spawn tile, `rpc_respawn` on a pick or a
-- stay), as `private.fallen` is. The browser draws the body lain there while it is on the spawn tile, on the ground floor,
-- aboard nothing -- `respawn_fall`'s terms.
--
-- `player.hurt_heavy` is whether the last blow that landed (`hurt_at`) was a creature's heavy one: false with every blow
-- that lands (`hurt_player`), true once a heavy one has (`hunt_settle`, the blow's `hurt_at` the transaction's).
--
-- Both delivered as `hurt_at` is (20261120000008): the beat says them to the body (`rpc_settle`), its body broadcast
-- carries them to everybody watching, and the roster reads them (`PEOPLE_COLUMNS`). Never from the browser's say-so.

set local lock_timeout = '3s';

alter table player add column if not exists fell jsonb;
alter table player add column if not exists hurt_heavy boolean not null default false;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('public', 'player_die', 1,
     $$      wounds = '[]'::jsonb, x = w.spawn_x + 0.5,$$,
     $$      -- And where it fell, from the row as it was, for the body drawn lain there (`player.fell`).
      fell = jsonb_build_object('x', x, 'y', y, 'level', coalesce(level, 0), 'at', now()),
      wounds = '[]'::jsonb, x = w.spawn_x + 0.5,$$),
    ('public', 'respawn_offer', 1,
     $$    delete from private.fallen where world_id = p_world and uid = p_uid;$$,
     $$    delete from private.fallen where world_id = p_world and uid = p_uid;
    update player set fell = null where world_id = p_world and uid = p_uid and fell is not null;$$),
    ('public', 'rpc_respawn', 2,
     $$delete from private.fallen where world_id = p_world and uid = me;$$,
     $$delete from private.fallen where world_id = p_world and uid = me;
  update player set fell = null where world_id = p_world and uid = me and fell is not null;$$),
    ('public', 'rpc_settle', 1,
     $$    'hurt_where', p.hurt_where,$$,
     $$    'hurt_where', p.hurt_where,
    'hurt_heavy', p.hurt_heavy,
    'fell', p.fell,$$),
    ('public', 'hurt_player', 1,
     $$  update player set wounds = out_w, hurt_at = now(), hurt_where = part,$$,
     $$  update player set wounds = out_w, hurt_at = now(), hurt_where = part, hurt_heavy = false,$$),
    ('public', 'hunt_settle', 1,
     $$          'The ' || lower(d.name) || '''s heavy blow lands', coalesce(d.wound, 'bite'));$$,
     $$          'The ' || lower(d.name) || '''s heavy blow lands', coalesce(d.wound, 'bite'));
        -- Landed (its `hurt_at` this transaction's): a heavy one, for the body drawn stumbling (`player.hurt_heavy`).
        update player set hurt_heavy = true where world_id = p_world and uid = p.uid and hurt_at = now() and not hurt_heavy;$$)
  ) as t(sch, fn, want, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.want then raise exception '%.% has % of the lines to change, not %', r.sch, r.fn, v_n, r.want; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
