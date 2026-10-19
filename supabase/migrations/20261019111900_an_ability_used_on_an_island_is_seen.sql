-- An ability used on an island is seen and heard in the browser, as it is in a game of your own.
--
-- Asked for: the Whispet's Fear "only shows as an ordinary strike" on an island. The browser draws a kept creature's
-- acts from what `rpc_creatures` says of it: a new `phase` of 'strike' or 'work' plays that act. An ability is
-- decided where the blow lands (`creature_attack` → `beast_ability`), after the phase it was struck in has gone by,
-- so nothing said it was one. Each use puts the `ability` mark on it until its rest is up (`class_mark`), so the end
-- of that mark changes at every use and at nothing else: it goes to the keeper as `cast` (epoch seconds), and the
-- browser plays its `cast` act when it changes, for every kind with an ability, the Whispet's Fear among them.

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'rpc_creatures',
     $$'phase', c.phase, 'carrying', c.carrying,$$,
     $$'phase', c.phase, 'carrying', c.carrying,
           -- When its ability's rest runs out, which moves at each use of it: the browser plays it as it is used.
           'cast', (select extract(epoch from m.until) from class_mark m
                     where m.world_id = p_world and m.creature_id = c.id and m.kind = 'ability'),$$, 1)
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
