-- A blow that lands, as everybody near sees it.
--
-- Asked for: a body visibly reacts when a blow lands on it (not blocked, not dodged), seen by the one struck and by
-- every other player nearby (`src/sculpt/anim/clips/flinch.ts`).
--
-- `player.hurt_at` is when the last blow landed on the body, and `player.hurt_where` where (a `hit_location` slot:
-- head, chest, arms, legs, feet): written in `hurt_player` in the one update that lays the wound and takes the health,
-- so a blow dodged, warded whole, blocked, turned by a Truce, a Decoy, an Unbreakable or a Guardian leaves them as they
-- were. Never from the browser's say-so. Delivered as `blocked_at` is (20261120000007): the beat says them to the one
-- struck (`rpc_settle`), whose body broadcast carries them to everybody watching, and the roster reads them
-- (`PEOPLE_COLUMNS`).

set local lock_timeout = '3s';

alter table player add column if not exists hurt_at timestamptz;
alter table player add column if not exists hurt_where text;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('public', 'hurt_player',
     $$  update player set wounds = out_w,$$,
     $$  -- And when and where, for the body drawn struck (`player.hurt_at`, `player.hurt_where`).
  update player set wounds = out_w, hurt_at = now(), hurt_where = part,$$),
    ('public', 'rpc_settle',
     $$    'blocked_at', p.blocked_at,$$,
     $$    'blocked_at', p.blocked_at,
    'hurt_at', p.hurt_at,
    'hurt_where', p.hurt_where,$$)
  ) as t(sch, fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '%.% has % of the lines to change, not 1', r.sch, r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
