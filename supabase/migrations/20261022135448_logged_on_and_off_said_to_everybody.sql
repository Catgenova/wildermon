-- Logged on and logged off, said to everybody on the island.
--
-- Asked for: a banner when a player logs on or off, and a line in Talk. Said off the player row itself, so every way
-- in (`rpc_join`, a step, an act, a settle) and every way out (`log_out_idle`) says it once and nothing can forget
-- to: 'Logged on: <name>' as `away` goes false or a body washes ashore, 'Logged off: <name>' as it goes true. Kind
-- `presence`, to every browser on the island (`uid` null), which writes it into Talk and puts up the banner.
-- `log_out_idle`'s own "<name> has gone home." goes, so logging off is said once.

set local lock_timeout = '3s';

create or replace function private.presence_said() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
declare v_on boolean;
begin
  if tg_op = 'INSERT' then
    if new.away then return null; end if;
    v_on := true;
  elsif old.away is not distinct from new.away then
    return null;
  else
    v_on := not new.away;
  end if;
  insert into public.event (world_id, uid, text, kind)
  values (new.world_id, null,
          case when v_on then 'Logged on: ' else 'Logged off: ' end || public.folk_name(new.world_id, new.uid),
          'presence');
  return null;
end $fn$;

drop trigger if exists presence_said on public.player;
create trigger presence_said after insert on public.player
  for each row execute function private.presence_said();
-- Only when `away` changes: a step writes `away = false` every time and costs nothing here.
drop trigger if exists presence_changed on public.player;
create trigger presence_changed after update of away on public.player
  for each row when (old.away is distinct from new.away) execute function private.presence_said();

do $do$
declare v_def text; v_old text;
begin
  v_def := pg_get_functiondef('log_out_idle'::regproc);
  v_old := $q$    perform tell(p_world, null, r.name || ' has gone home.', 'info');
$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'log_out_idle: anchor not once'; end if;
  execute replace(v_def, v_old, '');
end $do$;

select private.lock_doors();
