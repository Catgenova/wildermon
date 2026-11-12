/*
 * A Telestone takes you back (`src/game/runestones.ts`).
 *
 *   * A journey to a Runestone (`perform_telestone`) keeps where its traveller
 *     left from (`telestone_back`: the spot and its storey), and says it to the
 *     browser with the move.
 *   * Travel back (`travel_runestone` with the target's stone 'back') on the
 *     Telestone in your pack puts you on that spot again, once a journey, from
 *     anywhere, with no wait and no reach: `telestone_back_refusal` asks the
 *     same things a journey asks of the traveller (another job, a fight, a cart
 *     or a hull or a mount, a companion, swimming, a load too heavy to walk
 *     with) and that there is somewhere to go back to; `perform_telestone`
 *     moves the body there, or beside it (`telestone_back_landing`) when the
 *     spot can no longer be stood on, and forgets the spot.
 */
set local lock_timeout = '3s';

create table if not exists telestone_back (
  world_id uuid not null references world on delete cascade,
  uid uuid not null,
  x double precision not null,
  y double precision not null,
  level int not null,
  primary key (world_id, uid)
);
alter table telestone_back enable row level security;
revoke all on telestone_back from anon, authenticated;

/**
 * Where a return lands: the spot left from when a body can still stand there
 * (`passable`; on a storey, as it was), else the first of `landing_ring`
 * round it on the ground that a journey's landing would take. None when
 * there is none.
 */
create or replace function telestone_back_landing(p_world uuid, p_uid uuid) returns table (x double precision, y double precision, level int)
  language sql stable as $$
  select s.x, s.y, s.level from (
    select b.x, b.y, b.level, -1 as k from telestone_back b
     where b.world_id = p_world and b.uid = p_uid
       and (b.level > 0 or passable(p_world, floor(b.x)::int, floor(b.y)::int))
    union all
    select floor(b.x) + r.dx + 0.5, floor(b.y) + r.dy + 0.5, 0, r.k
      from telestone_back b
      cross join world w
      cross join landing_ring() r
     where b.world_id = p_world and b.uid = p_uid and w.id = p_world
       and passable(p_world, floor(b.x)::int + r.dx, floor(b.y)::int + r.dy)
       and runestone_on(w.size, floor(b.x)::int + r.dx, floor(b.y)::int + r.dy) is null
       and not has_water(p_world, floor(b.x)::int + r.dx, floor(b.y)::int + r.dy)
       and tile_slope(p_world, floor(b.x)::int + r.dx, floor(b.y)::int + r.dy) <= landing_stand()
       and building_at(p_world, floor(b.x)::int + r.dx, floor(b.y)::int + r.dy) is null
  ) s
  order by s.k
  limit 1
$$;

/**
 * Why a journey back will not be made, or null when it will: the browser's
 * `telestoneBackRefusal`, word for word and in the same order.
 */
create or replace function telestone_back_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
  language plpgsql stable as $fn$
declare p player; v_ql double precision; v_pet text;
begin
  select * into p from player where world_id = p_world and uid = p_uid;
  if p_target->>'kind' is distinct from 'item' then return telestone_said('item'); end if;
  select i.ql into v_ql from item i
   where i.id = target_item(p_target) and i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
     and i.def = telestone_item();
  if v_ql is null then return telestone_said('item'); end if;
  if not exists (select 1 from telestone_back b where b.world_id = p_world and b.uid = p_uid) then
    return 'No journey by Telestone to travel back from.';
  end if;
  if p.act is not null and p.act <> telestone_action() then return telestone_said('busy'); end if;
  if is_fight(p.act) or exists (select 1 from creature c where c.world_id = p_world and c.hunting = p_uid
                                   and c.mode = 'wild' and c.health > 0) then
    return telestone_said('fight');
  end if;
  if exists (select 1 from placed q where q.world_id = p_world and (q.driver = p_uid or q.puller = p_uid)) then
    return telestone_said('driving');
  end if;
  if p.aboard is not null then return telestone_said('aboard'); end if;
  if exists (select 1 from creature c where c.world_id = p_world and c.rider = p_uid) then return telestone_said('mounted'); end if;
  select c.name into v_pet from creature c where c.world_id = p_world and c.keeper = p_uid and c.mode = 'active' order by c.id limit 1;
  if v_pet is not null then
    return v_pet || ' would be left behind: send it to your settlement or into a crate first.';
  end if;
  if in_deep_water(p_world, p_uid) then return telestone_said('swimming'); end if;
  if over_carry(p_world, p_uid) > carry_stop() then return telestone_said('heavy'); end if;
  if not exists (select 1 from telestone_back_landing(p_world, p_uid)) then
    return 'There is no free ground where you left from to arrive on.';
  end if;
  return null;
end $fn$;

/* The journey's refusal asks the way back's for the stone 'back'. */
do $do$
declare v text; n int; a text; b text;
begin
  v := pg_get_functiondef('telestone_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  a := $a$  if p_target->>'kind' is distinct from 'item' then return telestone_said('item'); end if;$a$;
  b := $b$  if p_target->>'stone' = 'back' then return telestone_back_refusal(p_world, p_uid, p_action, p_target); end if;
  if p_target->>'kind' is distinct from 'item' then return telestone_said('item'); end if;$b$;
  n := (length(v) - length(replace(v, a, ''))) / length(a);
  if n <> 1 then raise exception 'telestone_refusal: % of an anchor, not 1', n; end if;
  execute replace(v, a, b);
end $do$;

/* The journey keeps where it left from and says it; the way back goes there and forgets it. */
do $do$
declare v text; n int; a text; b text;
begin
  v := pg_get_functiondef('perform_telestone(uuid,uuid,text,jsonb)'::regprocedure);
  -- (the way back, once the refusal has passed)
  a := $a$  select * into w from world where id = p_world;$a$;
  b := $b$  if p_target->>'stone' = 'back' then
    select l.x, l.y, l.level into v_bx, v_by, v_bl from telestone_back_landing(p_world, p_uid) l;
    update player set x = v_bx, y = v_by, level = v_bl, moved_at = now(), seen_at = now(), away = false
     where world_id = p_world and uid = p_uid;
    delete from telestone_back where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, 'Travelled back to where you left from.', 'event');
    if private.here(p_world, p_uid) then
      perform private.send('own:' || p_world || ':' || p_uid, 'moved',
        jsonb_build_object('x', v_bx, 'y', v_by, 'level', v_bl, 'back', null));
    end if;
    return;
  end if;
  select * into w from world where id = p_world;$b$;
  n := (length(v) - length(replace(v, a, ''))) / length(a);
  if n <> 1 then raise exception 'perform_telestone (back): % of an anchor, not 1', n; end if;
  v := replace(v, a, b);
  -- (its own variables)
  a := $a$declare v_why text;$a$;
  b := $b$declare v_bx double precision; v_by double precision; v_bl int; v_why text;$b$;
  n := (length(v) - length(replace(v, a, ''))) / length(a);
  if n <> 1 then raise exception 'perform_telestone (declare): % of an anchor, not 1', n; end if;
  v := replace(v, a, b);
  -- (the spot left from, kept before the body moves)
  a := $a$  update player set x = v_lx + 0.5, y = v_ly + 0.5, level = 0,$a$;
  b := $b$  insert into telestone_back (world_id, uid, x, y, level)
    select p_world, p_uid, q.x, q.y, q.level from player q where q.world_id = p_world and q.uid = p_uid
    on conflict (world_id, uid) do update set x = excluded.x, y = excluded.y, level = excluded.level;
  update player set x = v_lx + 0.5, y = v_ly + 0.5, level = 0,$b$;
  n := (length(v) - length(replace(v, a, ''))) / length(a);
  if n <> 1 then raise exception 'perform_telestone (keep): % of an anchor, not 1', n; end if;
  v := replace(v, a, b);
  -- (and said with the move)
  a := $a$'until', extract(epoch from v_until)::double precision)$a$;
  b := $b$'until', extract(epoch from v_until)::double precision,
                         'back', (select jsonb_build_object('x', k.x, 'y', k.y, 'level', k.level) from telestone_back k
                                   where k.world_id = p_world and k.uid = p_uid))$b$;
  n := (length(v) - length(replace(v, a, ''))) / length(a);
  if n <> 1 then raise exception 'perform_telestone (say): % of an anchor, not 1', n; end if;
  execute replace(v, a, b);
end $do$;

select private.lock_doors();
