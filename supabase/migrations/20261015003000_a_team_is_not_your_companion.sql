-- A team is not your companion, and a team is put together out of its crates.
--
-- Reported: "to hitch a mon i have to let it out of the cage to follow me, but
-- then once it's hitched it still counts as following me and i can't bring out
-- the next mon to hitch". A beast in the traces kept `mode = 'active'`, and
-- every place that asks who follows you asked only that, so the first one
-- hitched stood between you and the crate of the second. Asked as well: the
-- vehicle's Hitch list takes a wildermon straight out of a crate you carry or
-- stand beside.
--
--   * Who follows you is the one of yours in `active` that is not in the
--     traces, everywhere it is asked (`Creatures.active`).
--   * Hitch to the traces takes one out of a crate in your pack, or standing
--     within reach, straight into a yoke of the vehicle nearest you
--     (`crateToHand`, `vehicleFor`).
--   * One that comes out of the traces follows you only if nothing else does;
--     the rest of yours go into the empty creature crates in your pack, and
--     with too few there they stay in (`teamOut`, `teamOutRefusal`,
--     `crateTheRest`).

-- The crate a wildermon of yours is shut in, when it can be opened where you stand (`crateToHand`).
create or replace function crate_to_hand(p_world uuid, p_uid uuid, c creature) returns boolean
language sql stable as $fn$
  select c.mode = 'stored' and c.keeper = p_uid and (
    exists (select 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
              and i.inside is null and i.def = 'creature_crate' and i.creature = c.id)
    or exists (select 1 from placed pl where pl.world_id = p_world and pl.kind = 'furniture' and pl.sub = 'creature_crate'
              and pl.creature = c.id and placed_in_reach(p_world, p_uid, pl.id)))
$fn$;

-- The vehicle a wildermon would go into the traces of: the nearest to it with a yoke free, or for one in a crate, the nearest to you (`vehicleFor`).
create or replace function vehicle_for(p_world uuid, p_uid uuid, c creature) returns placed
language plpgsql stable as $fn$
declare v_x double precision; v_y double precision;
begin
  if c.mode = 'stored' then
    select py.x, py.y into v_x, v_y from player py where py.world_id = p_world and py.uid = p_uid;
    return vehicle_near(p_world, v_x, v_y, 5);
  end if;
  return vehicle_near(p_world, creature_x(c), creature_y(c), 5);
end $fn$;

-- The empty creature crates in your pack, in the order they are taken.
create or replace function empty_crates_carried(p_world uuid, p_uid uuid) returns bigint[]
language sql stable as $fn$
  select coalesce(array_agg(i.id order by i.id), '{}') from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.inside is null
     and i.def = 'creature_crate' and i.creature is null
$fn$;

-- Who of yours a team coming out of the traces leaves following you, and who goes into crates (`teamOut`).
create or replace function team_out(p_world uuid, p_uid uuid, p_ids int[], out follows int, out crated int[], out short int)
language plpgsql stable as $fn$
declare v_yours int[];
begin
  select coalesce(array_agg(id order by id), '{}') into v_yours from creature
   where world_id = p_world and id = any(p_ids) and mode = 'active' and keeper = p_uid;
  follows := coalesce(companion_of(p_world, p_uid), v_yours[1]);
  crated := array(select u from unnest(v_yours) u where u is distinct from follows order by u);
  short := greatest(0, cardinality(crated) - cardinality(empty_crates_carried(p_world, p_uid)));
end $fn$;

-- Why this team cannot come out of the traces, or null (`teamOutRefusal`).
create or replace function team_out_refusal(p_world uuid, p_uid uuid, p_ids int[]) returns text
language plpgsql stable as $fn$
declare o record; v_follows text; v_first text;
begin
  select * into o from team_out(p_world, p_uid, p_ids);
  if o.short = 0 or o.follows is null then return null; end if;
  select name into v_follows from creature where world_id = p_world and id = o.follows;
  if cardinality(p_ids) = 1 then
    select name into v_first from creature where world_id = p_world and id = o.crated[1];
    return v_follows || ' already follows you. Carry an empty creature crate to take ' || v_first
      || ' out of the traces: it goes into the crate.';
  end if;
  return 'Only one wildermon follows you. Carry '
    || case when cardinality(o.crated) = 1 then 'an empty creature crate'
            else number_word(cardinality(o.crated)) || ' empty creature crates' end
    || ' to take this team out of the traces: ' || v_follows || ' follows you and the rest go into them.';
end $fn$;

-- Put those of yours a team leaves behind into the empty crates in your pack; what to say of it, or '' (`crateTheRest`).
create or replace function team_out_crate(p_world uuid, p_uid uuid, p_follows int, p_crated int[]) returns text
language plpgsql as $fn$
declare v_crates bigint[] := empty_crates_carried(p_world, p_uid); v_names text[] := '{}'; v_i int := 0; v_id int;
begin
  foreach v_id in array coalesce(p_crated, '{}') loop
    v_i := v_i + 1;
    exit when v_i > cardinality(v_crates);
    perform crate_shut_in(p_world, v_id, v_crates[v_i], null);
    v_names := v_names || (select name from creature where world_id = p_world and id = v_id);
  end loop;
  if cardinality(v_names) = 0 or p_follows is null then return ''; end if;
  return ' ' || case when cardinality(v_names) < 2 then v_names[1]
                     else array_to_string(v_names[1:cardinality(v_names) - 1], ', ') || ' and ' || v_names[cardinality(v_names)] end
    || case when cardinality(v_names) = 1 then ' goes into a creature crate' else ' go into creature crates' end
    || ' in your pack: ' || (select name from creature where world_id = p_world and id = p_follows) || ' follows you.';
end $fn$;

/*
 * And every place that asks who follows you, asked of one not in the traces.
 *
 * Each is the function as the island has it now with the one phrase changed,
 * rather than a copy that would carry every other line back with it. Each
 * replacement must be found exactly as often as it is listed, or the
 * migration stops: a definition that has moved on since is a thing to look at,
 * not to paper over.
 */
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'companion_of', $$keeper = p_uid and mode = 'active' limit 1$$, $$keeper = p_uid and mode = 'active' and hitched_to is null limit 1$$, 1),
    (2, 'companion_swap', $$mode = 'active' and id <> p_taking.id limit 1$$, $$mode = 'active' and hitched_to is null and id <> p_taking.id limit 1$$, 1),
    (3, 'crate_open_refusal', $$keeper = p_uid and mode = 'active' limit 1$$, $$keeper = p_uid and mode = 'active' and hitched_to is null limit 1$$, 1),
    (4, 'crate_open_refusal', $$    if v_cur.id is not null and v_cur.hitched_to is not null then
      return v_cur.name || ' is in the traces, and would have to go into the crate in its place. Take it out first.';
    end if;
$$, '', 1),
    (5, 'perform_crate_open', $$keeper = p_uid and mode = 'active' limit 1$$, $$keeper = p_uid and mode = 'active' and hitched_to is null limit 1$$, 1),
    (6, 'tame_room_refusal', $$and c.mode = 'active'$$, $$and c.mode = 'active' and c.hitched_to is null$$, 1),
    (7, 'telestone_refusal', $$c.mode = 'active' order by c.id limit 1$$, $$c.mode = 'active' and c.hitched_to is null order by c.id limit 1$$, 1),
    (8, 'path_technique_cast', $$cc.mode = 'active' order by cc.id limit 1$$, $$cc.mode = 'active' and cc.hitched_to is null order by cc.id limit 1$$, 2),
    (9, 'do_cast', $$and mode = 'active' and keeper = p_uid$$, $$and mode = 'active' and keeper = p_uid and hitched_to is null$$, 1),
    (10, 'cast_reason', $$and c.mode = 'active' and c.keeper = p_uid) then$$, $$and c.mode = 'active' and c.keeper = p_uid and c.hitched_to is null) then$$, 1),
    (11, 'class_companion', $$cr.mode = 'active' and cr.health > 0$$, $$cr.mode = 'active' and cr.hitched_to is null and cr.health > 0$$, 1),
    (12, 'perform_trap', $$q.mode = 'active'$$, $$q.mode = 'active' and q.hitched_to is null$$, 1),
    -- Hitch to the traces, out of a crate at hand.
    (13, 'ride_refusal', $$if c.mode = 'stored' then return c.name || ' is in a creature crate. Let it out first.'; end if;$$,
                         $$if c.mode = 'stored' and not (p_action = 'hitch_creature' and crate_to_hand(p_world, p_uid, c)) then
      return c.name || ' is in a creature crate. Let it out first.';
    end if;$$, 1),
    (14, 'ride_refusal', $$if not creature_in_reach(p_world, p_uid, c, 4) then$$, $$if c.mode <> 'stored' and not creature_in_reach(p_world, p_uid, c, 4) then$$, 1),
    -- And out of the traces, with somewhere for the rest of yours to go.
    (15, 'ride_refusal', $$      if p.id is not null and traces_storey_refusal(p) is not null then return traces_storey_refusal(p); end if;
$$, $$      if p.id is not null and traces_storey_refusal(p) is not null then return traces_storey_refusal(p); end if;
      return team_out_refusal(p_world, p_uid, array[c.id]);
$$, 1),
    (16, 'ride_refusal', $$    if not near_piece(p_world, p_uid, p) then return 'Stand beside it first.'; end if;
    if traces_storey_refusal(p) is not null then return traces_storey_refusal(p); end if;
  end if;$$, $$    if not near_piece(p_world, p_uid, p) then return 'Stand beside it first.'; end if;
    if traces_storey_refusal(p) is not null then return traces_storey_refusal(p); end if;
    return team_out_refusal(p_world, p_uid, array(select q.id from creature q where q.world_id = p_world and q.hitched_to = p.id));
  end if;$$, 1),
    (17, 'perform_ride', $$        v_was bigint; v_shore record;$$, $$        v_was bigint; v_shore record; v_out record; v_crated boolean;$$, 1),
    (18, 'perform_ride', $$      p := vehicle_for(p_world, p_uid, c);
      if p.id is null or not hitch_up(p_world, c.id, p.id) then$$, $$      p := vehicle_for(p_world, p_uid, c);
      -- Out of its crate first, as a companion of yours: one that does not count as following you while it is in the traces.
      v_crated := c.mode = 'stored' and p.id is not null and crate_to_hand(p_world, p_uid, c);
      if v_crated then
        perform crate_let_out(p_world, c.id);
        update creature set mode = 'active', enemy = null, hunting = null, settled_at = now()
          where world_id = p_world and id = c.id returning * into c;
      end if;
      if p.id is null or not hitch_up(p_world, c.id, p.id) then$$, 1),
    (19, 'perform_ride', $$      perform tell(p_world, p_uid, 'You back ' || c.name || ' into a yoke of the '$$,
                         $$      perform tell(p_world, p_uid, case when v_crated then c.name || ' comes out of the crate. ' else '' end
        || 'You back ' || c.name || ' into a yoke of the '$$, 1),
    (20, 'perform_ride', $$      v_was := unhitch_one(p_world, c.id);
      perform tell(p_world, p_uid, 'You unbuckle ' || c.name || ' from the '
        || coalesce(lower((select placed_name(q) from placed q where q.id = v_was)), 'traces') || '.', 'event');$$,
                         $$      if team_out_refusal(p_world, p_uid, array[c.id]) is not null then return; end if;
      select * into v_out from team_out(p_world, p_uid, array[c.id]);
      v_was := unhitch_one(p_world, c.id);
      perform tell(p_world, p_uid, 'You unbuckle ' || c.name || ' from the '
        || coalesce(lower((select placed_name(q) from placed q where q.id = v_was)), 'traces') || '.'
        || team_out_crate(p_world, p_uid, v_out.follows, v_out.crated), 'event');$$, 1),
    (21, 'perform_ride', $$    v_n := unhitch_all(p_world, p.id);
    perform tell(p_world, p_uid, 'You let ' || case when v_n = 1 then 'it' else 'them' end
      || ' out of the traces of the ' || lower(placed_name(p)) || '.', 'event');$$,
                         $$    if team_out_refusal(p_world, p_uid, array(select q.id from creature q where q.world_id = p_world and q.hitched_to = p.id)) is not null then return; end if;
    select * into v_out from team_out(p_world, p_uid, array(select q.id from creature q where q.world_id = p_world and q.hitched_to = p.id));
    v_n := unhitch_all(p_world, p.id);
    perform tell(p_world, p_uid, 'You let ' || case when v_n = 1 then 'it' else 'them' end
      || ' out of the traces of the ' || lower(placed_name(p)) || '.'
      || team_out_crate(p_world, p_uid, v_out.follows, v_out.crated), 'event');$$, 1)
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
