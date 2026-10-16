-- A pour teaches the smith.
--
-- Asked: "pouring moulds should give blacksmithing experience". On an island a
-- pour taught nothing at all: `perform_firing` fills the furnace and says so,
-- and never raised a skill, so the only gain was the browser's own, which an
-- island does not keep. Pouring a mould and casting an anvil now raise
-- blacksmithing as a finished go does, the trade every mould is formed by
-- (`MOULD_SKILL`; the definitions name it for `pour_mould` and every
-- `make_*_mould`).

-- The trade that forms every mould and pours it (`MOULD_SKILL`).
create or replace function mould_skill() returns text language sql immutable as $fn$ select 'blacksmithing' $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'perform_firing', $$      || ' into the anvil mould. It needs about ' || round(v_secs) || ' seconds to cool.', 'event');
$$, $$      || ' into the anvil mould. It needs about ' || round(v_secs) || ' seconds to cool.', 'event');
    perform skill_raise(p_world, p_uid, mould_skill(), 1);
$$, 1),
    (2, 'perform_firing', $$                   || ' fillings left.' end, 'event');
$$, $$                   || ' fillings left.' end, 'event');
    perform skill_raise(p_world, p_uid, mould_skill(), 1);
$$, 1)
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
