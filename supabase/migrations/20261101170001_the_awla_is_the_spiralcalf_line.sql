/*
 * The Awla is the Spiralcalf line: the Spiralcalf, a Spiraltrunk at its second
 * stage and a Spiralphant at its third. Its task, its numbers and its id
 * (`awla`) are as they were; the kind's name and its old one (`was`), its two
 * stages' names, and its line's own skill at its third stage, shafts per log
 * +1 (`species_def.perk` 'more', `perk_n`), are in the definitions before this
 * (`20261101170000_defs.sql`).
 *
 * A recipe a worker works at the stores (`errand_do`: tanning, milling,
 * sawing, chiselling, bricks, rope, arrows, concrete, mortar, timbers, shafts,
 * bandages, cheese) makes its line's third-stage `more` over what the recipe
 * makes, on every batch, as a Glimmip's glass does at a smelter: a
 * Spiralphant carves five shafts from a log where the recipe makes four. No
 * other kind that works at the stores has a `more` (`perk_n` is nought for
 * it), so nothing else changes. The browser's `recipeStep`. Left as it is
 * where that change is already made.
 *
 * A definitions migration does not lock the doors; this one does.
 */
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('public', 'errand_do',
     $$      perform worker_put(p_world, c, r.result, r.count, worker_made_ql(c, skill), c.work_x, c.work_y, r.extra);$$,
     $$      perform worker_put(p_world, c, r.result, r.count + perk_n(c, 'more')::int, worker_made_ql(c, skill), c.work_x, c.work_y, r.extra);$$)
  ) as t(sch, fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    -- Another line's migration may have made the same change already (the Carra's Lognib line does): then there is
    -- nothing to do.
    continue when (length(v_def) - length(replace(v_def, r.new, ''))) / length(r.new) = 1;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '%.% has % of the lines to change, not 1', r.sch, r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
