-- A flat island of 256 with a settlement at 128,128 (Solara), the founder 'me' and :peers others ashore.
\set ON_ERROR_STOP on
set client_min_messages = warning;
select setseed(0.4242);
delete from world;
do $$
declare w uuid; i int; j int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Perf', 61, 256, 128, 128, true) returning id into w;
  perform land_blank(w, 256);
  for j in 78..178 loop for i in 78..178 loop perform land_set_height(w, i, j, 100); end loop; end loop;
end $$;
select id as world from world \gset
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, false) \g /dev/null
select rpc_join(:'world', 'Me') \g /dev/null
do $$
declare w uuid := (select id from world limit 1); k int;
begin
  for k in 1..30 loop
    perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-4000-8000-' || lpad(k::text, 12, '0')))::text, true);
    perform rpc_join(w, 'Peer' || k);
  end loop;
end $$;
update player set x = 128.5, y = 128.5, away = false, seen_at = now();
insert into deed (world_id, name, x, y, radius, level, founded_by) values (:'world', 'Solara', 128, 128, 22, 5, '11111111-1111-1111-1111-111111111111');
select count(*) as players from player;
