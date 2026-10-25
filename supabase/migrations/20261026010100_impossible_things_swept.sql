/*
 * Impossible things: a sweep that finds them, a keeper report that names
 * them, and a keeper's hold on one. Report only: the sweep never changes,
 * moves or deletes a thing.
 *
 * ## The sweep
 *
 * `private.item_sweep()`, every ten minutes: the next `sweep_rows()` rows of
 * `item` by id after where the last one stopped, back to the first when it
 * reaches the end. Each row is held to:
 *
 *   ql_over       QL over `ql_top()`, or not a number
 *   ql_under      QL under 0
 *   dmg           damage under 0, over `damage_max()`, or not a number
 *   count_over    count over the most one stack holds: `item_stack_top()` of a
 *                 stackable thing, `work_count_max()` of one that is not
 *   count_under   count under 1
 *   no_def        a thing with no `item_def`
 *   ql_maker      QL over the best its maker could make it (`item_ql_ceiling`) and
 *                 the best anybody on the island could improve it to, where a
 *                 maker is recorded and its recipe's QL is not its inputs'
 *   rare_unknown  a rarity with no `rarity_def`
 *   rare_no_roll  a rarity on a thing made since its origin was kept (`item.origin`) by a
 *                 door that rolls none: no door, a move, a trade or a plain door
 *   no_origin     a thing made since its origin was kept with none recorded, or by no door
 *
 * The table's checks refuse most of these at the door; the sweep is for the
 * day one is dropped or got round.
 *
 * Each finding is a row of `private.item_flag` (world, item, reason, holder,
 * first and last seen); a row the sweep passes again and finds right goes,
 * and one not seen for `watch_keep_days()` goes. A finding new this sweep is
 * filed as a keeper report (`private.player_report`, reason `item`), one per
 * holder and island, by the island itself (`private.island_uid()`), unless
 * one is open about the same holder already.
 *
 * ## The keeper's doors
 *
 *   rpc_owner_item_flags(world)               the findings, newest first, at most 200.
 *   rpc_owner_quarantine_item(world, item, hold)
 *                    hold: the thing taken out of play (`holder = 'quarantine'`,
 *                    seen by no browser) and where it was kept in
 *                    `private.item_quarantine`; not hold: put back where it
 *                    was, or to whoever held it, or on the ground where
 *                    newcomers come ashore. Written in the keeper's trail.
 *
 * Both keeper-only, behind the authenticator code, paced, and written down.
 */
set local lock_timeout = '3s';

-- ------------------------------------------------------------------ numbers

/* The most of a stackable thing one stack holds. */
create or replace function private.item_stack_top() returns int language sql immutable as $fn$ select 1000000 $fn$;
/* What a QL may be over its ceiling by and still be the ceiling: a real's rounding. */
create or replace function private.item_ql_slack() returns double precision language sql immutable as $fn$ select 0.01::double precision $fn$;
/* Who the island's own reports are by. */
create or replace function private.island_uid() returns uuid language sql immutable as $fn$
  select '00000000-0000-0000-0000-000000000000'::uuid $fn$;

-- ------------------------------------------------------------------ tables

create table if not exists private.item_flag (
  world_id uuid not null references public.world (id) on delete cascade,
  item bigint not null,
  reason text not null,
  holder text,
  holder_uid uuid,
  def text,
  detail jsonb not null default '{}'::jsonb,
  first_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  primary key (item, reason)
);
create index if not exists item_flag_world on private.item_flag (world_id, first_at desc);
create index if not exists item_flag_seen on private.item_flag (seen_at);

-- Where the sweep stopped: one row.
create table if not exists private.item_sweep_mark (
  one boolean primary key default true check (one),
  last_id bigint not null default 0,
  rounds bigint not null default 0,
  at timestamptz
);

-- A thing a keeper took out of play, and where it was.
create table if not exists private.item_quarantine (
  item bigint primary key,
  world_id uuid not null references public.world (id) on delete cascade,
  was jsonb not null,
  by_uid uuid not null,
  at timestamptz not null default now()
);

do $do$
declare t text;
begin
  foreach t in array array['item_flag', 'item_sweep_mark', 'item_quarantine'] loop
    execute format('alter table private.%I enable row level security', t);
    execute format('revoke all on table private.%I from public, anon, authenticated', t);
  end loop;
end $do$;

-- ------------------------------------------------------------------ the ceiling

/*
 * The best QL a thing could have that `p_maker` made: the best its maker could
 * make it at their skill now (`product_ql` at its best roll, their trade's
 * `fine` with any rite, the recipe's perk, and the best Masterwork there is),
 * or the best anybody on the island could improve it to (`improve_ceiling`:
 * the improve floor or perk, the island's best skill at it, and its rarity),
 * whichever is higher. Null where nothing holds it: no maker on the island by
 * that name, no recipe for it, or a recipe whose QL is its inputs'.
 */
create or replace function private.item_ql_ceiling(p_world uuid, p_def text, p_maker text, p_rare text)
returns double precision language plpgsql stable set search_path = public as $fn$
declare v_uid uuid; v_craft double precision; v_improve double precision; v_master double precision; v_skill text;
begin
  if p_maker is null then return null; end if;
  select p.uid into v_uid from player p where p.world_id = p_world and p.name = p_maker;
  if v_uid is null or (select count(*) from player p where p.world_id = p_world and p.name = p_maker) <> 1 then
    return null;
  end if;
  if not exists (select 1 from recipe r where r.result = p_def)
     or exists (select 1 from recipe r where r.result = p_def and r.ql_from_inputs) then
    return null;
  end if;
  select coalesce(max(e.per_ql), 0) * ql_top() into v_master from enchantments() e where e.effect = 'master';
  select max(least(ql_top(),
           least(ql_top(),
             least(ql_top(), greatest(1, least(ql_top(), skill_of(p_world, v_uid, r.skill))) * private.watch_best_roll() + 1)
             * case when coalesce(pl.class_mul, '{}'::jsonb)->'skills' @> to_jsonb(r.skill)
                    then coalesce((pl.class_mul->>'fine')::double precision, 1)
                         * greatest(1, coalesce((pl.class_mul->'rite'->'muls'->>'fine')::double precision, 1))
                    else 1 end)
           * pk(p_world, v_uid, 'ql:' || r.id, 1) + v_master))
    into v_craft
    from recipe r join player pl on pl.world_id = p_world and pl.uid = v_uid
   where r.result = p_def;
  select d.skill into v_skill from improvable_def d where d.item = p_def;
  if v_skill is not null then
    select least(99.9, greatest(improve_floor(),
                                coalesce(max(pk(p_world, p.uid, 'floor:improve', improve_floor())), 0),
                                coalesce(max(skill_of(p_world, p.uid, v_skill)), 0))
                       + coalesce((select x.ceiling from rarity_def x where x.id = p_rare), 0))
      into v_improve
      from player p where p.world_id = p_world;
  end if;
  return greatest(v_craft, v_improve);
end $fn$;

-- ------------------------------------------------------------------ what a finding says

/* A finding, as its line says it: the thing, its number, and what it is held to. */
create or replace function private.item_flag_says(p_reason text, p_detail jsonb) returns text
language sql immutable set search_path = '' as $fn$
  select case p_reason
    when 'ql_over' then 'QL ' || (p_detail->>'ql') || ' over ' || (p_detail->>'top')
    when 'ql_under' then 'QL ' || (p_detail->>'ql') || ' under 0'
    when 'dmg' then 'damage ' || (p_detail->>'dmg') || ', 0 to ' || (p_detail->>'top')
    when 'count_over' then 'count ' || (p_detail->>'count') || ' over ' || (p_detail->>'top')
    when 'count_under' then 'count ' || (p_detail->>'count') || ' under 1'
    when 'no_def' then 'no such thing: ' || (p_detail->>'def')
    when 'ql_maker' then 'QL ' || (p_detail->>'ql') || ' over ' || (p_detail->>'ceiling') || ', best of ' || (p_detail->>'maker')
    when 'rare_unknown' then 'rarity ' || (p_detail->>'rare') || ': no such rarity'
    when 'rare_no_roll' then 'rarity ' || (p_detail->>'rare') || ', made by ' || coalesce(p_detail->>'fn', 'no door')
    when 'no_origin' then 'origin: ' || coalesce(p_detail->>'fn', 'none')
    else p_reason end
$fn$;

-- ------------------------------------------------------------------ the sweep

drop function if exists private.item_sweep();
create or replace function private.item_sweep(p_rows int default null) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare v_from bigint; v_to bigint; v_rows int; v_limit int := greatest(1, coalesce(p_rows, sweep_rows()::int)); v_end boolean;
        v_flags int; v_new int := 0; v_cleared int; v_reports int := 0; r record; v_note text;
begin
  if not pg_try_advisory_xact_lock(hashtext('item_sweep')::bigint) then
    return jsonb_build_object('busy', true);
  end if;
  insert into private.item_sweep_mark (one) values (true) on conflict (one) do nothing;
  select m.last_id into v_from from private.item_sweep_mark m where m.one for update;

  select count(*), max(b.id) into v_rows, v_to
    from (select i.id from item i where i.id > v_from order by i.id limit v_limit) b;
  v_end := v_rows < v_limit;
  if v_end then v_to := null; end if;

  create temp table if not exists item_sweep_hit (
    world_id uuid, item bigint, reason text, holder text, holder_uid uuid, def text, detail jsonb, fresh boolean
  ) on commit drop;
  truncate item_sweep_hit;

  insert into item_sweep_hit (world_id, item, reason, holder, holder_uid, def, detail)
  select b.world_id, b.id, x.reason, b.holder, b.holder_uid, b.def, x.detail
    from (select i.* from item i where i.id > v_from and (v_to is null or i.id <= v_to)) b
    left join item_def d on d.id = b.def
    cross join lateral (select case when b.maker is not null then private.item_ql_ceiling(b.world_id, b.def, b.maker, b.rare) end as ceiling) c
    cross join lateral (values
      ('ql_over', b.ql = 'NaN'::real or b.ql > ql_top(), jsonb_build_object('ql', b.ql::text, 'top', ql_top())),
      ('ql_under', b.ql < 0, jsonb_build_object('ql', b.ql::text)),
      ('dmg', b.dmg = 'NaN'::real or b.dmg < 0 or b.dmg > damage_max(), jsonb_build_object('dmg', b.dmg::text, 'top', damage_max())),
      ('count_over', d.id is not null and b.count > case when d.stackable then private.item_stack_top() else work_count_max() end,
       jsonb_build_object('count', b.count, 'top', case when d.stackable then private.item_stack_top() else work_count_max() end)),
      ('count_under', b.count < 1, jsonb_build_object('count', b.count)),
      ('no_def', d.id is null, jsonb_build_object('def', b.def)),
      ('ql_maker', c.ceiling is not null and b.ql > c.ceiling + private.item_ql_slack(),
       jsonb_build_object('ql', round(b.ql::numeric, 2)::double precision, 'ceiling', round(c.ceiling::numeric, 2)::double precision,
                         'maker', b.maker)),
      ('rare_unknown', b.rare is not null and not exists (select 1 from rarity_def x where x.id = b.rare),
       jsonb_build_object('rare', b.rare)),
      ('rare_no_roll', b.rare is not null and b.origin in ('none', 'move', 'trade', 'door'),
       jsonb_build_object('rare', b.rare, 'origin', b.origin, 'fn', b.origin_fn)),
      ('no_origin', b.origin is null or b.origin = 'none', jsonb_build_object('fn', b.origin_fn))
    ) as x(reason, bad, detail)
   where x.bad;
  get diagnostics v_flags = row_count;

  -- Written down, or seen again: a row the insert wrote is new (`xmax` 0), one it updated is not.
  with put as (
    insert into private.item_flag as f (world_id, item, reason, holder, holder_uid, def, detail)
    select h.world_id, h.item, h.reason, h.holder, h.holder_uid, h.def, h.detail from item_sweep_hit h
    on conflict (item, reason) do update
      set world_id = excluded.world_id, holder = excluded.holder, holder_uid = excluded.holder_uid,
          def = excluded.def, detail = excluded.detail, seen_at = now()
    returning f.item, f.reason, (f.xmax::text = '0') as fresh)
  update item_sweep_hit h set fresh = p.fresh from put p where p.item = h.item and p.reason = h.reason;
  select count(*) into v_new from item_sweep_hit h where h.fresh;

  -- Passed again and found right, or gone; and anything not seen for the keeping.
  delete from private.item_flag f
   where f.item > v_from and (v_to is null or f.item <= v_to)
     and not exists (select 1 from item_sweep_hit h where h.item = f.item and h.reason = f.reason);
  get diagnostics v_cleared = row_count;
  delete from private.item_flag f where f.seen_at < now() - make_interval(days => private.watch_keep_days());

  -- What is new, to the keepers: one report a holder and island, unless one is open already.
  for r in
    select f.world_id, coalesce(f.holder_uid, private.island_uid()) as whom, count(*) as n,
           string_agg(coalesce(d.name, f.def) || ' #' || f.item || ': ' || private.item_flag_says(f.reason, f.detail),
                      ' · ' order by f.item, f.reason) as said
      from item_sweep_hit f left join item_def d on d.id = f.def
     where f.fresh
     group by f.world_id, coalesce(f.holder_uid, private.island_uid())
  loop
    continue when exists (select 1 from private.player_report o
                           where o.world_id = r.world_id and o.whom = r.whom and o.by_uid = private.island_uid()
                             and o.reason = 'item' and o.handled_at is null);
    v_note := left('Impossible items: ' || r.n || ' · ' || r.said, private.report_note_max());
    insert into private.player_report (world_id, by_uid, whom, reason, note)
    values (r.world_id, private.island_uid(), r.whom, 'item', v_note);
    v_reports := v_reports + 1;
  end loop;

  update private.item_sweep_mark m
     set last_id = case when v_end then 0 else v_to end,
         rounds = m.rounds + case when v_end then 1 else 0 end, at = now()
   where m.one;
  return jsonb_build_object('from', v_from, 'to', v_to, 'rows', v_rows, 'flags', v_flags, 'new', v_new,
                            'cleared', v_cleared, 'reports', v_reports, 'round_done', v_end);
end $fn$;

revoke all on function private.item_stack_top(), private.item_ql_slack(), private.island_uid(),
  private.item_ql_ceiling(uuid, text, text, text), private.item_flag_says(text, jsonb), private.item_sweep(int)
  from public, anon, authenticated;

-- ------------------------------------------------------------------ the keeper's doors

/*
 * The findings on the island, newest first, at most 200: the thing, who holds
 * it, why, and whether a keeper holds it out of play. A look within ten
 * minutes of the same keeper's last look is counted on that look's row.
 */
create or replace function public.rpc_owner_item_flags(p_world uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); v jsonb; v_n int;
begin
  if not private.is_island_owner(p_world, me) then
    raise exception 'only a keeper of this island may do that';
  end if;
  if not private.keeper_code_ok(me) then
    return jsonb_build_object('why', 'Authenticator code needed: Island keeper window.');
  end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'item', f.item, 'reason', f.reason, 'def', f.def,
           'name', coalesce((select d.name from item_def d where d.id = f.def), f.def),
           'holder', f.holder, 'uid', f.holder_uid,
           'who', case when f.holder_uid is not null then folk_name(p_world, f.holder_uid) end,
           'line', private.item_flag_says(f.reason, f.detail), 'detail', f.detail,
           'ago', greatest(0, floor(extract(epoch from now() - f.first_at)))::bigint,
           'held', exists (select 1 from private.item_quarantine q where q.item = f.item))
         order by f.first_at desc, f.item), '[]'::jsonb), count(*)
    into v, v_n
    from (select * from private.item_flag q where q.world_id = p_world order by q.first_at desc, q.item limit 200) f;
  update private.owner_log l
     set detail = l.detail || jsonb_build_object('flags', v_n, 'looks', coalesce((l.detail->>'looks')::int, 1) + 1, 'last', now())
   where l.n = (select max(q.n) from private.owner_log q where q.world_id = p_world and q.owner = me and q.what = 'item_flags')
     and coalesce((l.detail->>'last')::timestamptz, l.at) > now() - interval '10 minutes';
  if not found then
    perform private.owner_note(me, p_world, 'item_flags', null, jsonb_build_object('flags', v_n, 'looks', 1, 'last', now()));
  end if;
  return jsonb_build_object('flags', v);
end $function$;

/*
 * A thing taken out of play (`p_hold`), or put back. Out of play it is held
 * by nobody and seen by no browser, what was in it with it, and where it was
 * is kept. Put back: where it was, if that is all still there; else to the
 * body that held it; else on the ground where newcomers come ashore.
 */
create or replace function public.rpc_owner_quarantine_item(p_world uuid, p_item bigint, p_hold boolean default true)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); it item; v_was jsonb; v_uid uuid; v_inside bigint; v_placed bigint; v_crate int;
        w world; v_where text;
begin
  if not private.is_island_owner(p_world, me) then
    raise exception 'only a keeper of this island may do that';
  end if;
  if not private.keeper_code_ok(me) then
    return jsonb_build_object('why', 'Authenticator code needed: Island keeper window.');
  end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into it from item where id = p_item and world_id = p_world for update;
  if not found then return jsonb_build_object('why', 'No such thing on this island.'); end if;

  if coalesce(p_hold, true) then
    if it.holder = 'quarantine' then return jsonb_build_object('why', 'Already held.'); end if;
    v_was := jsonb_build_object('holder', it.holder, 'holder_uid', it.holder_uid, 'gx', it.gx, 'gy', it.gy,
                                'inside', it.inside, 'crate', it.crate, 'placed', it.placed);
    insert into private.item_quarantine (item, world_id, was, by_uid) values (it.id, p_world, v_was, me)
    on conflict (item) do update set world_id = excluded.world_id, was = excluded.was, by_uid = excluded.by_uid, at = now();
    update item set holder = 'quarantine', holder_uid = null, gx = null, gy = null, inside = null, crate = null, placed = null
     where id = it.id;
    perform private.owner_note(me, p_world, 'item_hold', it.holder_uid, jsonb_build_object(
      'item', it.id, 'def', it.def, 'ql', it.ql, 'count', it.count, 'was', v_was));
    return jsonb_build_object('held', true, 'item', it.id);
  end if;

  if it.holder <> 'quarantine' then return jsonb_build_object('why', 'Not held.'); end if;
  select q.was into v_was from private.item_quarantine q where q.item = it.id;
  v_was := coalesce(v_was, '{}'::jsonb);
  v_uid := nullif(v_was->>'holder_uid', '')::uuid;
  v_inside := nullif(v_was->>'inside', '')::bigint;
  v_placed := nullif(v_was->>'placed', '')::bigint;
  v_crate := nullif(v_was->>'crate', '')::int;
  if v_was ? 'holder' and v_was->>'holder' <> 'quarantine'
     and (v_uid is null or exists (select 1 from player p where p.world_id = p_world and p.uid = v_uid))
     and (v_inside is null or exists (select 1 from item x where x.id = v_inside and x.world_id = p_world))
     and (v_placed is null or exists (select 1 from placed x where x.id = v_placed and x.world_id = p_world))
     and (v_crate is null or exists (select 1 from crate x where x.id = v_crate and x.world_id = p_world)) then
    update item set holder = v_was->>'holder', holder_uid = v_uid,
                    gx = nullif(v_was->>'gx', '')::int, gy = nullif(v_was->>'gy', '')::int,
                    inside = v_inside, crate = v_crate, placed = v_placed
     where id = it.id;
    v_where := 'where it was';
  elsif v_uid is not null and exists (select 1 from player p where p.world_id = p_world and p.uid = v_uid) then
    update item set holder = 'player', holder_uid = v_uid where id = it.id;
    v_where := 'to its holder';
  else
    select * into w from world where id = p_world;
    update item set holder = 'ground', gx = floor(w.spawn_x)::int, gy = floor(w.spawn_y)::int where id = it.id;
    v_where := 'ashore';
  end if;
  delete from private.item_quarantine q where q.item = it.id;
  perform private.owner_note(me, p_world, 'item_release', v_uid, jsonb_build_object(
    'item', it.id, 'def', it.def, 'ql', it.ql, 'count', it.count, 'to', v_where));
  return jsonb_build_object('held', false, 'item', it.id, 'to', v_where);
end $function$;

-- ------------------------------------------------------------------ on the clock

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then return; end if;
  -- `cron.schedule` is an upsert on the name, so a second deploy re-times the job rather than winding another.
  perform cron.schedule('item-sweep', '7-59/10 * * * *', 'set statement_timeout = ''2min''; select private.item_sweep()');
exception when others then
  raise notice 'could not wind the item sweep (%)', sqlerrm;
end $$;

select private.lock_doors();
