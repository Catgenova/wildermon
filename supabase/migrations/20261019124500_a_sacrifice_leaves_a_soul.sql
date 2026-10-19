-- What a sacrifice now and again leaves is called a soul.
--
-- Asked for: "Change the names of the rewards from motes > souls now that we have an actual mote system" (the swirls,
-- `motes.ts`). The item keeps its id, `mote`, so the ones already held stay what they are; its name comes from
-- `item_def` (the defs), and the action's label from `action_def`. What remains are the lines the island says itself.

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'sacrifice_setting',
     $$'A mote is not given up. Absorb it into something instead.'$$,
     $$'A soul is not given up. Absorb it into something instead.'$$, 1),
    (2, 'absorb_setting', $$'Choose a mote to absorb.'$$, $$'Choose a soul to absorb.'$$, 1),
    (3, 'absorb_setting', $$'A mote will not go into another mote.'$$, $$'A soul will not go into another soul.'$$, 1),
    (4, 'absorb_setting', $$'Only an ordinary thing takes a mote, and this is '$$,
     $$'Only an ordinary thing takes a soul, and this is '$$, 1),
    (5, 'perform_sacrifice', $$' mote is left where the '$$, $$' soul is left where the '$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn and strpos(pg_get_functiondef(p.oid), r.old) > 0;
    if v_def is null then raise exception '% has no change %', r.fn, r.ord; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
