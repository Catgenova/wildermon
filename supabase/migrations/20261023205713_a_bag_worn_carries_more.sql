set local lock_timeout = '3s';

-- Asked for: "Equipping a backpack increases weight held by up to 50%, a sack 25%. Both can be equipped and QL
-- determines what % bonus they apply." A backpack is worn on the back and a sack at the side (`slot_of`), and the carry
-- limit is the rest of it times one and each worn bag's share at QL 100 times its QL / 100 (`bags_carry`): the
-- browser's `bagCarry` and `carryLimit`.

do $do$
declare v_def text; v_old text := $$case when p_def = 'toolbelt' then 'belt' $$; v_n int;
begin
  v_def := pg_get_functiondef('slot_of'::regproc);
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'slot_of has % of the belt, not 1', v_n; end if;
  execute replace(v_def, v_old, v_old || $$when p_def = 'backpack' then 'back' when p_def = 'sack' then 'side' $$);
end $do$;

/** What the bags worn add to the carry limit, as a share of it: a backpack on the back, a sack at the side, by QL. */
create or replace function bags_carry(p_world uuid, p_uid uuid) returns double precision
  language sql stable as $$
  select coalesce(sum(case i.def when 'backpack' then bag_carry_backpack() when 'sack' then bag_carry_sack() else 0 end
                      * least(100, i.ql) / 100), 0)
    from player p
    join item i on i.world_id = p.world_id and i.holder = 'player' and i.holder_uid = p.uid
     and i.id in ((p.equipped->>'back')::bigint, (p.equipped->>'side')::bigint)
   where p.world_id = p_world and p.uid = p_uid
$$;

do $do$
declare v_def text; v_n int;
        v_head text := $$  select carry_base() + $$;
        v_tail text := $$i.holder_uid = p_uid), 0)
$$;
begin
  v_def := pg_get_functiondef('carry_limit(uuid, uuid)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, v_head, ''))) / length(v_head);
  if v_n <> 1 then raise exception 'carry_limit has % of its head, not 1', v_n; end if;
  v_n := (length(v_def) - length(replace(v_def, v_tail, ''))) / length(v_tail);
  if v_n <> 1 then raise exception 'carry_limit has % of its tail, not 1', v_n; end if;
  v_def := replace(v_def, v_head, $$  select (carry_base() + $$);
  execute replace(v_def, v_tail, $$i.holder_uid = p_uid), 0))
       -- And all of it by the bags worn (`bags_carry`).
       * (1 + bags_carry(p_world, p_uid))
$$);
end $do$;

select private.lock_doors();
