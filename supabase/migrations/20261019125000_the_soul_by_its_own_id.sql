-- What a sacrifice leaves is a soul by its id too, not only by its name.
--
-- Asked for: "Rename the ID as well, no players are holding any and I want it clean". The item was `mote`, the job
-- `absorb_mote`, the soul going in was the target's `mote` field and the share of sacrifices that leave one was
-- `mote_chance()`; they are `soul`, `absorb_soul`, `soul` and `soul_chance()` now, as in the browser. The snapshot
-- after this one gives the rulebook the new ids; anything held, kept, ordered or counted under the old one, or a job
-- under way or queued, is carried over here, so nothing points at an id the island no longer knows.

set local lock_timeout = '3s';

alter function mote_chance() rename to soul_chance;

do $do$
declare r record; v_def text; v_n int; i int;
begin
  for r in select * from (values
    (1, 'absorb_setting', array['o_mote', $$p_target->>'mote'$$, $$def <> 'mote'$$, $$def = 'mote'$$],
                          array['o_soul', $$p_target->>'soul'$$, $$def <> 'soul'$$, $$def = 'soul'$$], array[5, 1, 1, 1]),
    (2, 'perform_absorb', array['o_mote', 'v_mote', $$'mote', 1,$$],
                          array['o_soul', 'v_soul', $$'soul', 1,$$], array[4, 3, 1]),
    (3, 'sacrifice_setting', array[$$def = 'mote'$$], array[$$def = 'soul'$$], array[1]),
    (4, 'perform_sacrifice', array['mote_chance()', $$'mote', 1,$$], array['soul_chance()', $$'soul', 1,$$], array[1, 1]),
    (5, 'last_refusal', array[$$'absorb_mote'$$], array[$$'absorb_soul'$$], array[1]),
    (6, 'last_action', array[$$'absorb_mote'$$], array[$$'absorb_soul'$$], array[1]),
    (7, 'perform_last', array[$$'absorb_mote'$$], array[$$'absorb_soul'$$], array[1])
  ) as t(ord, fn, olds, news, ns) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      if v_n <> r.ns[i] then raise exception '% has % of %, not %', r.fn, v_n, r.olds[i], r.ns[i]; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
    end loop;
    -- The names of what absorb_setting gives back change, which only a function made again takes.
    if r.fn = 'absorb_setting' then drop function absorb_setting(uuid, uuid, jsonb); end if;
    execute v_def;
  end loop;
end $do$;

-- What is held, kept, put up for sale, bartered, ordered, stored or counted.
update item set def = 'soul' where def = 'mote';
update away_tally set def = 'soul' where def = 'mote';
update barter_item set def = 'soul' where def = 'mote';
update buy_order set def = 'soul' where def = 'mote';
update sale set def = 'soul' where def = 'mote';
update deed_ledger set def = 'soul' where def = 'mote';
update deed_store_log set def = 'soul' where def = 'mote';
update deed_work set def = 'soul' where def = 'mote';
update player set ledger = (ledger - 'mote') || jsonb_build_object('soul', ledger -> 'mote') where ledger ? 'mote';

-- A soul being absorbed, or queued to be, goes on as the same job under its new id.
update player set act = 'absorb_soul',
    act_target = case when act_target ? 'mote' then (act_target - 'mote') || jsonb_build_object('soul', act_target -> 'mote')
                      else act_target end
 where act = 'absorb_mote';
update player set act_queue = (
    select coalesce(jsonb_agg(case when q->>'action' = 'absorb_mote' then
             q || jsonb_build_object('action', 'absorb_soul',
                    'target', case when q->'target' ? 'mote' then ((q->'target') - 'mote') || jsonb_build_object('soul', q->'target'->'mote')
                                   else q->'target' end)
             when q->>'was' = 'mote' then q || jsonb_build_object('was', 'soul')
             else q end order by o), '[]'::jsonb)
      from jsonb_array_elements(act_queue) with ordinality as e(q, o))
 where jsonb_typeof(act_queue) = 'array'
   and exists (select 1 from jsonb_array_elements(act_queue) q where q->>'action' = 'absorb_mote' or q->>'was' = 'mote');

select private.lock_doors();
