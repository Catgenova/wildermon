-- A wildermon of yours says when her young are due.
--
-- Asked: a view of the Wildermon window listing the ones that want attention,
-- among them a dam about to give birth. On an island the browser was never
-- told when that was: `due` stayed with the island, so the card's "In young,
-- due in …" and anything else that read it said nothing. It goes out now with
-- the rest of what is sent of your own (care, fleece), as seconds from now,
-- which the browser lays on its own clock.

do $do$
declare v_def text; v_n int;
  v_old text := $$           'fleece', c.fleece,
$$;
  v_new text := $$           'fleece', c.fleece,
           -- When her young are due, in seconds from now: null when she carries none.
           'dueIn', case when c.due > now() then extract(epoch from c.due - now()) end,
$$;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'rpc_creatures';
  if v_def is null then raise exception 'rpc_creatures is not on this island'; end if;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_creatures has % of the line to change, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
