-- Starter tools are not sold or traded.
--
-- Asked: "Stop kit tools from being sold or traded. These are called 'starter (tool)'". The browser names an issued
-- item a Starter hatchet (`itemName`). Here an issued item is refused, in `barter_said('starter')`'s words (the defs
-- just before this), wherever it would change hands: put on a side of a barter (`barter_thing_refusal`), offered in a
-- deal (`rpc_deal`), sent in a parcel (`rpc_parcel`), priced on a stall or a counter (`rpc_price`), and taken to fill
-- an order (`order_fits`, as the browser's `fitsOrder`).

set local lock_timeout = '3s';

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('barter_thing_refusal', $$  if it.def = 'coin' then return barter_said('coin'); end if;$$,
                             $$  if it.def = 'coin' then return barter_said('coin'); end if;
  if it.issued then return barter_said('starter'); end if;$$),
    ('rpc_deal', $$  if v_count > 0 then
    select count(*) into v_mine from item i$$, $$  if v_count > 0 and exists (select 1 from item i where i.world_id = p_world and i.id = any(p_items) and i.issued) then
    return jsonb_build_object('why', barter_said('starter'));
  end if;
  if v_count > 0 then
    select count(*) into v_mine from item i$$),
    ('rpc_parcel', $$  select count(*) into v_mine from item i
    where i.world_id = p_world and i.id = any(p_items)$$, $$  if exists (select 1 from item i where i.world_id = p_world and i.id = any(p_items) and i.issued) then
    return jsonb_build_object('why', barter_said('starter'));
  end if;
  select count(*) into v_mine from item i
    where i.world_id = p_world and i.id = any(p_items)$$),
    ('rpc_price', $$  if not found or v_it.placed is null then$$, $$  if found and v_it.issued then
    return jsonb_build_object('why', barter_said('starter'));
  end if;
  if not found or v_it.placed is null then$$),
    ('order_fits', $$and i.ql >= p_ql and not i.locked and$$, $$and i.ql >= p_ql and not i.locked and not i.issued and$$)
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
