\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\pset format unaligned
update player set seen_at = now(), away = false;
select world_tick() \g /dev/null
select world_tick() \g /dev/null
-- every worker due now, three times over
select clock_timestamp() as t0 \gset
update creature set until = now() - interval '1 second' where mode = 'deed';
select world_tick() as t1 \gset
update creature set until = now() - interval '1 second' where mode = 'deed';
select world_tick() as t2 \gset
update creature set until = now() - interval '1 second' where mode = 'deed';
select world_tick() as t3 \gset
select extract(epoch from clock_timestamp() - :'t0'::timestamptz) * 1000 / 3 as ms \gset
select json_build_object('due_tick_ms', round(:'ms'::numeric, 1), 'stirred', (:'t3'::jsonb->>'stirred')::int,
  'last_rounds', (select json_agg(json_build_object('ms', round(ms::numeric), 'stages', stages) order by at desc) from (select * from tick_time order by at desc limit 3) q),
  'phases', (select json_object_agg(coalesce(phase,'-') || '/' || coalesce(idle_why, ''), n) from (select phase, idle_why, count(*) n from creature where mode = 'deed' group by 1, 2) q));
