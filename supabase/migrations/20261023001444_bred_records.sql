/*
 * Bred records: per island, per kind, the best ever bred.
 *
 * Asked for: "per island, per kind, the best ever bred: highest of each base
 * stat at birth and the most traits / highest tier total, with the
 * wildermon's name, its breeder and the date. Kept when the wildermon dies or
 * is released. Updated at birth on the island (one cheap upsert). Shown as a
 * 'Bred records' board in the island leaderboards, and on a kind's Field guide
 * page. An RPC to read them (gated like other boards)."
 *
 * `bred_record` holds a row a kind and a stat (`RECORD_STATS` in
 * `src/game/boards.ts`): each base stat -- `hardy`, `tough`, `speed`, `work`
 * -- as the young one's blood gives it at birth (`blood_at_birth`: its traits,
 * its line and its rarity, the browser's `bloodMul` with no stage and no pot
 * yet), and `traits`, its traits' grades added up as the wildermon board adds
 * them (`grade_step`). The young one's number and name, its breeder (the dam's
 * keeper) and the day are written with it, and nothing holds the creature to
 * it: the record outlives it.
 *
 * `drop_young` writes it, for a young one born to a dam somebody keeps -- where
 * the field guide marks the kind bred -- in one statement: a row a stat,
 * taken only where it beats what stands (a tie keeps the first).
 *
 * `bred_records_of` is what is read: every record of the island, the breeder
 * named as late as possible. `rpc_bred_records` hands it to anybody on the
 * island, as `rpc_boards` hands out its boards, and `rpc_boards` carries it
 * as `records`.
 */
set local lock_timeout = '3s';

select private.shut($ddl$
create table if not exists bred_record (
  world_id uuid not null references world (id) on delete cascade,
  species text not null,
  stat text not null check (stat in ('hardy', 'tough', 'speed', 'work', 'traits')),
  value double precision not null,
  -- The young one, by number and by the name it was born with; nothing holds it to the row, which outlives it.
  creature_id integer not null,
  name text not null,
  breeder uuid,
  born_at timestamptz not null,
  primary key (world_id, species, stat)
)$ddl$);
select private.shut('alter table bred_record enable row level security');
-- Read through the doors below alone.
select private.shut('revoke all on bred_record from anon, authenticated');

/* A young one's blood on a channel as it is born: its traits, its line and its rarity (`bloodMul` at birth). */
create or replace function blood_at_birth(c creature, p_channel text) returns double precision
language sql stable as $fn$
  select trait_mul(c.traits, p_channel) * line_mul(c.traits, c.pedigree->'line', p_channel)
       * case when c.rare is null then 1 else rarity_blood(c.rare, p_channel) end
$fn$;

/*
 * A young one's record figures, by stat (`RECORD_STATS`). PL/pgSQL, and so
 * never folded into the query that asks: folded into an upsert over a lateral
 * join it threw "variable not found in subplan target list".
 */
create or replace function record_figures(c creature) returns table (stat text, value double precision)
language plpgsql stable as $fn$
begin
  return query
    select s.stat, blood_at_birth(c, s.stat) from unnest(array['hardy', 'tough', 'speed', 'work']) s(stat)
    union all
    select 'traits', coalesce(sum(grade_step(d.tier)), 0)::double precision
      from unnest(coalesce(c.traits, '{}')) t(id) join trait_def d on d.id = t.id;
end $fn$;

/* A birth, against the records: each stat it beats is its now. One upsert. */
create or replace function bred_record_note(p_world uuid, p_id integer, p_breeder uuid) returns void
language plpgsql as $fn$
declare c creature;
begin
  select * into c from creature where world_id = p_world and id = p_id;
  if not found then return; end if;
  insert into bred_record as r (world_id, species, stat, value, creature_id, name, breeder, born_at)
  select p_world, c.species, f.stat, f.value, c.id, c.name, p_breeder, coalesce(c.born, now())
    from record_figures(c) f
  on conflict (world_id, species, stat) do update
    set value = excluded.value, creature_id = excluded.creature_id, name = excluded.name, breeder = excluded.breeder, born_at = excluded.born_at
    where excluded.value > r.value;
end $fn$;

/* Every record of an island, each breeder named once; `mine` for `p_me`'s. */
create or replace function bred_records_of(p_world uuid, p_me uuid) returns jsonb
language sql stable as $fn$
  with named as materialized (
    select u.breeder, folk_name(p_world, u.breeder) as name
      from (select distinct r.breeder from bred_record r where r.world_id = p_world and r.breeder is not null) u
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'species', r.species, 'stat', r.stat, 'value', r.value, 'name', r.name,
      'breeder', coalesce(n.name, 'somebody'), 'at', floor(extract(epoch from r.born_at) * 1000),
      'mine', r.breeder is not distinct from p_me) order by r.species, r.stat), '[]'::jsonb)
    from bred_record r left join named n on n.breeder = r.breeder
   where r.world_id = p_world
$fn$;

/* The island's bred records, for anybody on it: the Field guide's. */
create or replace function rpc_bred_records(p_world uuid) returns jsonb
language plpgsql security definer as $fn$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then
    raise exception 'you are not on this island';
  end if;
  return bred_records_of(p_world, me);
end $fn$;

do $do$
declare v_def text; v_n int;
  v_bo text := $a$    'settlements', ($a$;
  v_bn text := $a$    'records', bred_records_of(p_world, me),
    'settlements', ($a$;
  v_yo text := $a$    if v_dam.mode <> 'wild' then perform guide_mark(p_world, v_dam.keeper, v_dam.species, 'bred'); end if;$a$;
  v_yn text := $a$    if v_dam.mode <> 'wild' then perform guide_mark(p_world, v_dam.keeper, v_dam.species, 'bred'); end if;
    -- And the island's bred records, where it beats one.
    if v_dam.mode <> 'wild' then perform bred_record_note(p_world, v_born, v_dam.keeper); end if;$a$;
begin
  -- Each patched once: a second run finds it done.
  select pg_get_functiondef('public.rpc_boards(uuid)'::regprocedure) into v_def;
  if position('bred_records_of' in v_def) > 0 then v_def := null; end if;
  v_n := (length(v_def) - length(replace(v_def, v_bo, ''))) / length(v_bo);
  if v_def is not null then
    if v_n <> 1 then raise exception 'rpc_boards has % of its settlements board, not 1', v_n; end if;
    execute replace(v_def, v_bo, v_bn);
  end if;
  select pg_get_functiondef('public.drop_young(uuid, creature, jsonb)'::regprocedure) into v_def;
  if position('bred_record_note' in v_def) > 0 then v_def := null; end if;
  v_n := (length(v_def) - length(replace(v_def, v_yo, ''))) / length(v_yo);
  if v_def is not null then
    if v_n <> 1 then raise exception 'drop_young has % of its field guide mark, not 1', v_n; end if;
    execute replace(v_def, v_yo, v_yn);
  end if;
end $do$;

revoke all on function blood_at_birth(creature, text) from public, anon, authenticated;
revoke all on function record_figures(creature) from public, anon, authenticated;
revoke all on function bred_record_note(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function bred_records_of(uuid, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
select private.lock_doors();
