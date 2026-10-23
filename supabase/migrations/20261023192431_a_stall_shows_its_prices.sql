set local lock_timeout = '3s';

-- Reported: "Market stalls on a deed can't be accessed by non-members to buy wares. No way to set prices or buy items."
-- `rpc_buy` sells off a stall to anybody at it, member or not, but nobody could get there: a stall's things came with
-- every ground read (`rpc_ground`) without their prices, so a buyer's screen had nothing priced to buy, and the stall
-- offered no Buy. Each thing in a piece now carries its price, which only a stall's goods have.
do $do$
declare v_def text; v_n int;
        v_old text := $$'occupant', case when i.creature is not null then occupant_name(i.world_id, i.creature) end) order by i.id)$$;
begin
  v_def := pg_get_functiondef('rpc_ground'::regproc);
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_ground has % of the things'' occupant, not 1', v_n; end if;
  execute replace(v_def, v_old, replace(v_old, ' end) order by i.id)', ' end, ''price'', i.price) order by i.id)'));
end $do$;

select private.lock_doors();
