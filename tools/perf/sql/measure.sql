\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\pset format unaligned
select id as world from world \gset
update player set seen_at = now(), away = false;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, false) \g /dev/null
select rpc_near(:'world', 40, '', '{}', true, 40, true, '') \g /dev/null
-- whole x3
select clock_timestamp() as t0 \gset
select rpc_near(:'world', 40, '', '{}', true, 40, true, '') \g /dev/null
select rpc_near(:'world', 40, '', '{}', true, 40, true, '') \g /dev/null
select rpc_near(:'world', 40, '', '{}', true, 40, true, '') as j \gset
select extract(epoch from clock_timestamp() - :'t0'::timestamptz) * 1000 / 3 as whole_ms \gset
select :'j'::jsonb->'creatures'->>'at' as cat, :'j'::jsonb->'ground'->>'at' as gat,
       (select coalesce(array_agg((r->>0)::int), '{}') from jsonb_array_elements(:'j'::jsonb->'creatures'->'rows') r) as have \gset
-- whole creatures and ground apart
select clock_timestamp() as t0 \gset
select rpc_creatures(:'world', 40, '', '{}', true) \g /dev/null
select extract(epoch from clock_timestamp() - :'t0'::timestamptz) * 1000 as cre_ms \gset
select clock_timestamp() as t0 \gset
select rpc_ground(:'world', 40, true, '') \g /dev/null
select extract(epoch from clock_timestamp() - :'t0'::timestamptz) * 1000 as ground_ms \gset
-- delta x5
select clock_timestamp() as t0 \gset
select rpc_near(:'world', 40, :'cat', :'have'::int[], true, 40, false, :'gat') \g /dev/null
select rpc_near(:'world', 40, :'cat', :'have'::int[], true, 40, false, :'gat') \g /dev/null
select rpc_near(:'world', 40, :'cat', :'have'::int[], true, 40, false, :'gat') \g /dev/null
select rpc_near(:'world', 40, :'cat', :'have'::int[], true, 40, false, :'gat') \g /dev/null
select rpc_near(:'world', 40, :'cat', :'have'::int[], true, 40, false, :'gat') as d \gset
select extract(epoch from clock_timestamp() - :'t0'::timestamptz) * 1000 / 5 as delta_ms \gset
-- the beat
select clock_timestamp() as t0 \gset
select rpc_settle(p_world => :'world') as s \gset
select extract(epoch from clock_timestamp() - :'t0'::timestamptz) * 1000 as settle_ms \gset
-- the clock: three rounds
select world_tick() \g /dev/null
select clock_timestamp() as t0 \gset
select world_tick() as t1 \gset
select world_tick() as t2 \gset
select extract(epoch from clock_timestamp() - :'t0'::timestamptz) * 1000 / 2 as tick_ms \gset
select json_build_object('whole_ms', round(:'whole_ms'::numeric, 1), 'whole_kb', round(length(:'j') / 1024.0, 1),
  'whole_cre_kb', round(length((:'j'::jsonb->'creatures')::text) / 1024.0, 1),
  'whole_ground_kb', round(length((:'j'::jsonb->'ground')::text) / 1024.0, 1),
  'lying_kb', round(length((:'j'::jsonb->'ground'->'lying')::text) / 1024.0, 1),
  'placed_kb', round(length((:'j'::jsonb->'ground'->'placed')::text) / 1024.0, 1),
  'buildings_kb', round(length((:'j'::jsonb->'ground'->'buildings')::text) / 1024.0, 1),
  'crates_kb', round(length((:'j'::jsonb->'ground'->'crates')::text) / 1024.0, 1),
  'cre_ms', round(:'cre_ms'::numeric, 1), 'ground_ms', round(:'ground_ms'::numeric, 1),
  'delta_ms', round(:'delta_ms'::numeric, 1), 'delta_kb', round(length(:'d') / 1024.0, 1),
  'delta_crates_kb', round(length((:'d'::jsonb->'ground'->'crates')::text) / 1024.0, 1),
  'delta_ids_kb', round(length((:'d'::jsonb->'ground'->'ids')::text) / 1024.0, 1),
  'delta_cre_rows', jsonb_array_length(:'d'::jsonb->'creatures'->'rows'),
  -- Companions sent again, but for those with panniers, which always are (`rpc_creatures`).
  'delta_active', (select count(*) from jsonb_array_elements(:'d'::jsonb->'creatures'->'rows') r
                    where r->>4 = 'active' and r->>1 not in (select id from species_def where panniers is not null)),
  'lying_n', jsonb_array_length(:'j'::jsonb->'ground'->'lying'),
  'settle_ms', round(:'settle_ms'::numeric, 1), 'settle_kb', round(length(:'s') / 1024.0, 1),
  'tick_ms', round(:'tick_ms'::numeric, 1), 'tick', :'t2'::jsonb->'stages');
