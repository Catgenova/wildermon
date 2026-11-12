-- The tool in somebody's hands at a job, as everybody else sees it.
--
-- Asked for: "other players are shown mining with their own pickaxe's metal", not iron. A sculpted figure at mining
-- draws the pickaxe in both hands in its metal (`FigurePose.tool`); your own browser takes it from your pack
-- (`Inventory.tool`), and nobody else's pickaxe ever reached it.
--
-- `player.act_tool` is the tool the job in hand is done with, as the island takes it from the pack: the best of the
-- kind its `action_def.tool` names (`job_tool`, the one its quality and wear are taken from), as
-- [its id, its rarity from nought to three, its material as the item names it, whether it is enchanted] -- a worn
-- piece's wire (`rpc_worn`) with the enchantment in the dye's place. It is set by `act_tool_set` whenever the job in
-- hand starts or starts its next go (`act`, `act_started`), whichever door or sweep writes them, and is null with no
-- job or a job that names no tool. Never from the browser's say-so.
--
-- Other browsers read it with the rest of the roster (`PEOPLE_COLUMNS`), and the body broadcast carries it with `act`
-- as the island said it to the one at work: in `rpc_act`'s answer when the job starts (`tool`) and in `rpc_settle`'s
-- (`act_tool`) at every go.

set local lock_timeout = '3s';

alter table player add column if not exists act_tool jsonb;

/** The tool a job is done with, out of the pack, as `player.act_tool` carries it; null when it names none or there is none. */
create or replace function private.act_tool_of(p_world uuid, p_uid uuid, p_action text) returns jsonb
language sql stable set search_path = public as $fn$
  select jsonb_build_array(t.def,
           case t.rare when 'rare' then 1 when 'supreme' then 2 when 'fantastic' then 3 else 0 end,
           t.extra, t.enchant is not null)
    from job_tool(p_world, p_uid, action_tool(p_action)) t
   where p_action is not null and t.id is not null
$fn$;
revoke all on function private.act_tool_of(uuid, uuid, text) from public, anon, authenticated;

create or replace function private.act_tool_set() returns trigger language plpgsql set search_path = public as $fn$
begin
  new.act_tool := case when new.act is null then null else private.act_tool_of(new.world_id, new.uid, new.act) end;
  return new;
end $fn$;
revoke all on function private.act_tool_set() from public, anon, authenticated;

select private.shut('drop trigger if exists act_tool_set on public.player');
select private.shut($ddl$create trigger act_tool_set before update of act, act_started on public.player
  for each row when (old.act is distinct from new.act or old.act_started is distinct from new.act_started)
  execute function private.act_tool_set()$ddl$);

-- Whoever is at a job now: their tool, as the trigger would have set it.
update player set act_tool = private.act_tool_of(world_id, uid, act) where act is not null;

-- And said to the one at work, to send with `act` over the body broadcast: when the job starts, and at every beat.
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('public', 'rpc_act',
     $$      || jsonb_build_object('started', true, 'ends', now() + make_interval(secs => secs), 'seconds', secs);$$,
     $$      || jsonb_build_object('started', true, 'ends', now() + make_interval(secs => secs), 'seconds', secs,
                            'tool', (select q.act_tool from player q where q.world_id = p_world and q.uid = me));$$),
    ('public', 'rpc_settle',
     $$    'act', p.act,$$,
     $$    'act', p.act,
    'act_tool', p.act_tool,$$)
  ) as t(sch, fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '%.% has % of the lines to change, not 1', r.sch, r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
