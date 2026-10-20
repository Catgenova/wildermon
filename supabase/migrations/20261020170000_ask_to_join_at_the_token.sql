-- Ask to join a settlement at its token.
--
-- Asked for: "Allow players to request to join a settlement at the totem." Until now the only way onto a roll was an
-- invitation (`rpc_invite`), which the founder or a rank holding Invite sends: somebody who wanted to live there had to
-- find them and say so. Now a stranger standing on the settlement asks from its token's menu (`rpc_join_ask`); the
-- founder and every citizen whose rank holds Invite hear it, and see it under Waiting in the Social window
-- (`rpc_social`'s `requests`), where one of them lets them in or turns them down (`rpc_join_answer`). The one who asked
-- sees it there too (`requesting`), and may take it back (`rpc_join_withdraw`).
--
-- Let in is the same as an invitation answered yes: on the roll at the settlement's rank for newcomers, and the same
-- words for it. The cap on how many settlements anybody lives on (`deeds_joined`) holds at both ends. Getting onto a
-- roll by either door takes any request or invitation for that settlement with it (`deed_member_clears_asking`).

set local lock_timeout = '3s';

create table if not exists deed_request (
  world_id uuid not null,
  founder uuid not null,
  uid uuid not null,
  made_at timestamptz not null default now(),
  primary key (world_id, founder, uid),
  foreign key (world_id, founder) references deed(world_id, founded_by) on delete cascade
);
create index if not exists deed_request_by on deed_request (world_id, uid);

alter table deed_request enable row level security;

-- A request is between the one who asked and the settlement's founder; the rest of who may answer reads it through `rpc_social`.
drop policy if exists deed_request_read on deed_request;
create policy deed_request_read on deed_request for select to authenticated
  using (uid = (select auth.uid()) or founder = (select auth.uid()));

-- On a roll by either door: whatever was asking for it is answered.
create or replace function deed_member_clears_asking() returns trigger language plpgsql as $fn$
begin
  delete from deed_request where world_id = new.world_id and founder = new.founder and uid = new.uid;
  delete from deed_invite where world_id = new.world_id and founder = new.founder and uid = new.uid;
  return new;
end $fn$;

drop trigger if exists deed_member_clears_asking on deed_member;
create trigger deed_member_clears_asking after insert on deed_member
  for each row execute function deed_member_clears_asking();

/**
 * Ask to live on the settlement whose token stands at (x, y), standing on its land.
 */
create or replace function rpc_join_ask(p_world uuid, p_x int, p_y int) returns jsonb
  language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); p player; d deed; v_n int; v_who text; r record;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me;
  if not found then raise exception 'you are not on this island'; end if;
  select * into d from deed where world_id = p_world and x = p_x and y = p_y;
  if not found then return jsonb_build_object('why', 'No settlement token here.'); end if;
  if d.founded_by = me then return jsonb_build_object('why', 'Your own settlement.'); end if;
  if exists (select 1 from deed_member m where m.world_id = p_world and m.founder = d.founded_by and m.uid = me) then
    return jsonb_build_object('why', 'Already a citizen of ' || d.name || '.');
  end if;
  if not deed_covers(d, floor(p.x)::int, floor(p.y)::int) then
    return jsonb_build_object('why', 'Stand on ' || d.name || ' to ask.');
  end if;
  if exists (select 1 from deed_invite i where i.world_id = p_world and i.founder = d.founded_by and i.uid = me) then
    return jsonb_build_object('why', 'Invitation from ' || d.name || ' waiting. (Social, to answer)');
  end if;
  v_n := deeds_joined_by(p_world, me);
  if v_n >= deeds_joined()::int then
    return jsonb_build_object('why', 'Citizen of ' || v_n || ' settlements: the most allowed. Leave one first.');
  end if;
  if exists (select 1 from deed_request q where q.world_id = p_world and q.founder = d.founded_by and q.uid = me) then
    return jsonb_build_object('why', 'Already asked: ' || d.name || '.');
  end if;
  insert into deed_request (world_id, founder, uid) values (p_world, d.founded_by, me);
  v_who := folk_name(p_world, me);
  -- Everybody who may answer it: its founder, and each citizen whose rank holds Invite.
  for r in
    select d.founded_by as uid
    union
    select m.uid from deed_member m
     where m.world_id = p_world and m.founder = d.founded_by
       and deed_may(p_world, d.founded_by, m.uid, power_bit('invite'))
  loop
    perform tell(p_world, r.uid, v_who || ' asks to join ' || d.name || '. (Social, to answer)', 'system');
  end loop;
  perform tell(p_world, me, 'Asked to join ' || d.name || '.', 'system');
  return jsonb_build_object('asked', d.name);
end $fn$;

/**
 * Let somebody in who asked, or turn them down: the founder, or a citizen whose rank holds Invite.
 */
create or replace function rpc_join_answer(p_world uuid, p_founder uuid, p_uid uuid, p_yes boolean) returns jsonb
  language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_why text; v_who text; v_n int; r deed_rank_def;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into d from deed where world_id = p_world and founded_by = p_founder;
  if not found then return jsonb_build_object('why', 'That settlement is gone.'); end if;
  v_why := rank_member_refusal(p_world, p_founder, me, 'invite');
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  v_who := folk_name(p_world, p_uid);
  if not exists (select 1 from deed_request q where q.world_id = p_world and q.founder = p_founder and q.uid = p_uid) then
    return jsonb_build_object('why', 'No request from ' || coalesce(v_who, 'them') || ' waiting.');
  end if;
  if not coalesce(p_yes, false) then
    delete from deed_request where world_id = p_world and founder = p_founder and uid = p_uid;
    perform tell(p_world, p_uid, 'Request to join ' || d.name || ': turned down.', 'event');
    perform tell(p_world, me, 'Turned down: ' || v_who || ', ' || d.name || '.', 'system');
    return jsonb_build_object('joined', false, 'name', v_who, 'deed', d.name);
  end if;
  v_n := deeds_joined_by(p_world, p_uid);
  if v_n >= deeds_joined()::int then
    -- Left standing: once they leave somewhere it can still be answered.
    return jsonb_build_object('why', v_who || ': citizen of ' || v_n || ' settlements, the most allowed.');
  end if;
  -- No rank named: the settlement's rank for newcomers (`deed_member_rank`). The request goes with the row (`deed_member_clears_asking`).
  insert into deed_member (world_id, founder, uid) values (p_world, p_founder, p_uid);
  r := deed_rank_of(p_world, p_founder, p_uid);
  -- The words an invitation answered yes says (`rpc_invite_answer`).
  perform tell(p_world, p_uid, 'You are a citizen of ' || d.name || ', at the rank of ' || r.name
    || ': you may ' || rank_may(r.perms) || '.', 'system');
  perform tell(p_world, me, v_who || ' has come to live at ' || d.name || '.', 'system');
  if me <> p_founder then
    perform tell(p_world, p_founder, v_who || ' has come to live at ' || d.name || '.', 'system');
  end if;
  return jsonb_build_object('joined', true, 'name', v_who, 'deed', d.name, 'rank', r.name);
end $fn$;

/** Take back a request to join. */
create or replace function rpc_join_withdraw(p_world uuid, p_founder uuid) returns jsonb
  language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); v_name text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select d.name into v_name from deed d where d.world_id = p_world and d.founded_by = p_founder;
  delete from deed_request where world_id = p_world and founder = p_founder and uid = me;
  if not found then return jsonb_build_object('why', 'No request waiting.'); end if;
  return jsonb_build_object('withdrawn', v_name);
end $fn$;

-- The Social window: requests to every settlement you may invite to, and your own out.
do $do$
declare v_def text; v_old text; v_n int;
begin
  v_old := $$    'friends', coalesce((select jsonb_agg(folk_row(p_world, f.other, true)$$;
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'rpc_social';
  if v_def is null then raise exception 'rpc_social is not there'; end if;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_social has % of its friends line, not 1', v_n; end if;
  execute replace(v_def, v_old, $$    -- Asking to live on a settlement you may invite to: who, which, and how many they live on already.
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
        'uid', q.uid, 'name', folk_name(p_world, q.uid),
        'founder', q.founder, 'deed', dd.name,
        'joined', deeds_joined_by(p_world, q.uid),
        'at', extract(epoch from q.made_at)) order by q.made_at)
      from deed_request q join deed dd
        on dd.world_id = q.world_id and dd.founded_by = q.founder
      where q.world_id = p_world
        and deed_may(p_world, q.founder, me, power_bit('invite'))), '[]'::jsonb),
    -- And yours, not answered yet.
    'requesting', coalesce((select jsonb_agg(jsonb_build_object(
        'founder', q.founder, 'deed', dd.name, 'at', extract(epoch from q.made_at)) order by q.made_at)
      from deed_request q join deed dd
        on dd.world_id = q.world_id and dd.founded_by = q.founder
      where q.world_id = p_world and q.uid = me), '[]'::jsonb),
$$ || v_old);
end $do$;

select private.lock_doors();
