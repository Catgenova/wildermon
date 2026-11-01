-- The Carra is the Lognib line: the Lognib, a Timbersplit at its second stage and a Beammaster at its third. Its task, its
-- numbers and its id (`carra`) are as they were; what changes in the definitions before this (`20261101163229_defs.sql`) is
-- the kind's name and its old one (`was`), its two stages' names, and its line's own skill at its third stage, timbers per log
-- +1 (`species_def.perk` 'more', `perk_n`).
--
-- That skill is worked here: a recipe worked at the stores (`errand_do`, the trades a carra's sawing is one of) makes what the
-- recipe makes and its line's third-stage `more` on top (`perk_n`), as a Glimmip's glass already does and as the browser's
-- `recipeStep` does. No other kind that works a recipe at the stores has a `more` skill, so only a Beammaster's timbers change.
--
-- A definitions migration does not lock the doors; this one does.

set local lock_timeout = '3s';

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('errand_do',
     $$      perform worker_put(p_world, c, r.result, r.count, worker_made_ql(c, skill), c.work_x, c.work_y, r.extra);$$,
     $$      perform worker_put(p_world, c, r.result, r.count + perk_n(c, 'more')::int, worker_made_ql(c, skill), c.work_x, c.work_y, r.extra);$$)
  ) as t(fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of the lines to change, not 1', r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
