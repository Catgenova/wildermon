-- An Ironemole, not a Ironemole.
--
-- The Mola is the Ironemole now (the definitions, which come in after this), and evolves into an Oremander. What
-- evolving says took "a" before every name; it takes the article the name wants, as the browser's `article` does.

create or replace function article(p_word text) returns text language sql immutable as $fn$
  select case when p_word ~* '^(one|uni|use|eu)' then 'a'
              when p_word ~* '^(hour|honest|heir|[aeiou])' then 'an'
              else 'a' end
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'worker_learn', $$c.name || ' evolves into a '$$,
                        $$c.name || ' evolves into ' || article((select sd.stages[stage_of(c2)] from species_def sd where sd.id = c.species)) || ' '$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
