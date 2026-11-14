/*
 * The Path: an optional run of steps from the runestone to a settlement at its last level (`src/game/path.ts`).
 *
 *   player.thepath   the record, one jsonb per body: `on`, the steps skipped (`skip`), the supplies handed out
 *                    by step (`supply`: item, n, season) and the goes counted for steps nothing else counts (`did`),
 *                    counted only while the Path is on (`private.thepath_before`, `private.thepath_after`, run by
 *                    `private.act_go` round every go).
 *   guide_noted      the kinds turning the Path on notes in the field guide: Track takes them as if seen
 *                    (`track_refusal`), and nothing else reads them -- no count, goal or title.
 *
 * A step ticks as a journal goal does, its id `path:<step>` in `rpc_settle`'s `p_ticked`; the island keeps one only
 * when it is on the Path's list (`thepath_steps`, `thepath_detours`) and its own state says the step is met
 * (`thepath_met`). Everything else in `p_ticked` is kept as it always was.
 *
 *   rpc_thepath(p_world, p_on)              on or off; on notes the kinds;
 *   rpc_thepath_skip(p_world, p_step, p_skip) a step skipped, or taken back;
 *   rpc_thepath_supply(p_world, p_step)     a tame step's supply, once: the kind's favourite, sized to tame it
 *                                           `thepath_sure` of the time at its own chance, issued -- only while the
 *                                           step is open and nothing the kind eats is in season;
 *   rpc_thepath_sites(p_world)              the nearest founding tiles past the stones' gap, each passing every
 *                                           founding check (`deed_site_refusal`, which `deed_refusal` asks too)
 *                                           and with trees, water and rock round it.
 *
 * `deed_refusal` is split: the checks of a tile are `deed_site_refusal`, and the gap to the nearest stone is
 * `stone_gap_at`, so the sites and the walk out are asked by the same rule that founding is.
 */
set local lock_timeout = '3s';

alter table player add column if not exists thepath jsonb;

create table if not exists guide_noted (
  world_id uuid not null,
  uid uuid not null,
  species text not null,
  noted_at timestamptz not null default now(),
  primary key (world_id, uid, species),
  foreign key (world_id, uid) references player (world_id, uid) on delete cascade
);
alter table guide_noted enable row level security;
revoke all on guide_noted from anon, authenticated;

-- ------------------------------------------------------------------ the record

/** The record with every field there: off, nothing skipped, no supply, nothing counted. */
create or replace function thepath_state(p jsonb) returns jsonb
language sql immutable as $fn$
  select jsonb_build_object(
    'on', coalesce((p->>'on')::boolean, false),
    'skip', case when jsonb_typeof(p->'skip') = 'array' then p->'skip' else '[]'::jsonb end,
    'supply', case when jsonb_typeof(p->'supply') = 'object' then p->'supply' else '{}'::jsonb end,
    'did', case when jsonb_typeof(p->'did') = 'object' then p->'did' else '{}'::jsonb end)
$fn$;

/** What a door answers: the record, and the kinds noted. */
create or replace function thepath_said(p_world uuid, p_uid uuid) returns jsonb
language sql stable as $fn$
  select thepath_state((select thepath from player where world_id = p_world and uid = p_uid))
      || jsonb_build_object('noted', coalesce((select jsonb_agg(n.species order by n.species) from guide_noted n
                                               where n.world_id = p_world and n.uid = p_uid), '[]'::jsonb))
$fn$;

/** A count of the Path's goes (`did`). */
create or replace function thepath_did(p jsonb, p_key text) returns int
language sql immutable as $fn$ select coalesce((p->'did'->>p_key)::int, 0) $fn$;

/** Everything carried in the pack, counted: what a forage, a botanize or a mine adds to. */
create or replace function thepath_carried(p_world uuid, p_uid uuid) returns int
language sql stable as $fn$
  select coalesce(sum(i.count), 0)::int from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
$fn$;

/*
 * Before a go, while the Path is on: what the go will be measured against afterwards, for the goes the Path counts
 * and nothing else does. Null, and nothing read past the action's name, for every other go and every body with the
 * Path off.
 */
create or replace function private.thepath_before(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns jsonb
language plpgsql stable set search_path = public as $fn$
declare v_p player; v_def text;
begin
  if p_action not in ('eat', 'forage', 'botanize', 'mine', 'dig', 'prospect', 'pack', 'track') then return null; end if;
  select * into v_p from player where world_id = p_world and uid = p_uid;
  if not coalesce((v_p.thepath->>'on')::boolean, false) then return null; end if;
  if p_action = 'eat' then
    select i.def into v_def from item i where i.id = target_item(p_target);
    if v_def is null then return null; end if;
    return jsonb_build_object('def', v_def, 'n', pack_count(p_world, p_uid, v_def));
  elsif p_action in ('forage', 'botanize', 'mine') then
    return jsonb_build_object('n', thepath_carried(p_world, p_uid));
  elsif p_action = 'dig' then
    return jsonb_build_object('n', pack_count(p_world, p_uid, 'clay'));
  elsif p_action = 'prospect' then
    return jsonb_build_object('p', v_p.stats->'prospected');
  elsif p_action = 'track' then
    return jsonb_build_object('n', coalesce((v_p.tally->>'tracked')::int, 0));
  end if;
  return '{}'::jsonb;
end $fn$;

/* After it: counted under its key when it did what it is counted for. */
create or replace function private.thepath_after(p_world uuid, p_uid uuid, p_action text, p_target jsonb, p_before jsonb) returns void
language plpgsql set search_path = public as $fn$
declare v_p player; v_key text;
begin
  select * into v_p from player where world_id = p_world and uid = p_uid;
  if p_action = 'eat' then
    if pack_count(p_world, p_uid, p_before->>'def') < (p_before->>'n')::int then v_key := 'ate:' || (p_before->>'def'); end if;
  elsif p_action in ('forage', 'botanize', 'mine') then
    if thepath_carried(p_world, p_uid) > (p_before->>'n')::int then v_key := p_action; end if;
  elsif p_action = 'dig' then
    if pack_count(p_world, p_uid, 'clay') > (p_before->>'n')::int then v_key := 'clay'; end if;
  elsif p_action = 'prospect' then
    if jsonb_typeof(v_p.stats->'prospected') = 'object' and (v_p.stats->'prospected') is distinct from (p_before->'p') then
      v_key := 'prospect';
    end if;
  elsif p_action = 'pack' then
    if land_tile(p_world, (p_target->>'x')::int, (p_target->>'y')::int) = tile_id('Packed dirt') then v_key := 'pack'; end if;
  elsif p_action = 'track' then
    if coalesce((v_p.tally->>'tracked')::int, 0) > (p_before->>'n')::int then v_key := 'track:' || (p_target->>'species'); end if;
  end if;
  if v_key is null then return; end if;
  update player set thepath = thepath_state(thepath)
      || jsonb_build_object('did', thepath_state(thepath)->'did' || jsonb_build_object(v_key, thepath_did(thepath, v_key) + 1))
    where world_id = p_world and uid = p_uid;
end $fn$;

-- ------------------------------------------------------------------ founding, asked of any tile

/** How far a tile is from the nearest runestone, from the stone's nearest tile; null on an island without stones. */
create or replace function stone_gap_at(p_world uuid, p_x int, p_y int) returns double precision
language sql stable as $fn$
  select min(sqrt(power(greatest(0, abs(p_x - c.x) - stone_half()), 2) + power(greatest(0, abs(p_y - c.y) - stone_half()), 2)))
    from runestone_centres((select w.size from world w where w.id = p_world)) c
$fn$;

/*
 * Why a settlement's token may not go in at (x, y), or null: the map edge, the ground, another token, the stones and
 * the lairs, in `deed_refusal`'s order and words. Asked by founding and by the Path's sites.
 */
create or replace function deed_site_refusal(p_world uuid, tx int, ty int) returns text
language plpgsql stable as $fn$
declare v_lair record; want int := 5; other deed; v_apart int := deed_spacing(); v_stone record;
begin
  if tx - want < 0 or ty - want < 0
     or not in_bounds(p_world, tx + want, ty + want) then
    return 'Too close to the map edge.';
  end if;
  -- A poured slab is dry, level ground standing above whatever is under it,
  -- which is what a token wants and is sometimes the only such tile about.
  if slab_at(p_world, tx, ty) is null then
    if has_water(p_world, tx, ty) then return 'Totem needs dry land.'; end if;
    if not passable(p_world, tx, ty) then return 'Totem needs a clear tile.'; end if;
  end if;
  -- The nearest token closer than the spacing on both axes, by the larger of the two distances.
  select * into other from deed d
   where d.world_id = p_world
     and abs(tx - d.x) < v_apart
     and abs(ty - d.y) < v_apart
   order by greatest(abs(tx - d.x), abs(ty - d.y)), d.founded_at limit 1;
  if found then
    return 'Too close to ' || other.name || ': ' || greatest(abs(tx - other.x), abs(ty - other.y))
        || ' tiles token to token; ' || v_apart || ' needed (borders at level ' || max_deed_level()
        || ' ' || deed_gap() || ' tiles apart).';
  end if;
  -- And no nearer a runestone than deed_stone_gap(): the nearest one, by its gap from the stone's nearest tile.
  select c.name, sqrt(power(greatest(0, abs(tx - c.x) - stone_half()), 2) + power(greatest(0, abs(ty - c.y) - stone_half()), 2)) as gap
    into v_stone
    from runestone_centres((select w.size from world w where w.id = p_world)) c
   order by 2 limit 1;
  if v_stone.gap is not null and v_stone.gap < deed_stone_gap() then
    return 'Too close to ' || v_stone.name || ': ' || floor(v_stone.gap)::int || ' tiles; ' || deed_stone_gap() || ' needed.';
  end if;
  -- And no nearer a lair than its kind keeps from a token (`lair_kinds.keep_off`).
  select k.name, k.keep_off, sqrt((tx - l.x) ^ 2 + (ty - l.y) ^ 2) as d into v_lair
    from lair l join lair_kinds() k on k.id = l.kind
   where l.world_id = p_world and (tx - l.x) ^ 2 + (ty - l.y) ^ 2 < k.keep_off ^ 2
   order by 3, l.id limit 1;
  if v_lair.name is not null then
    return 'Too close to a ' || lower(v_lair.name) || ': ' || floor(v_lair.d)::int || ' tiles; ' || v_lair.keep_off || ' needed.';
  end if;
  return null;
end $fn$;

-- ------------------------------------------------------------------ whether a step is met, on the island's state

/** A kind tamed: marked tamed in the guide, or one of yours. */
create or replace function thepath_tamed(p_world uuid, p_uid uuid, p_kind text) returns boolean
language sql stable as $fn$
  select exists (select 1 from guide g where g.world_id = p_world and g.uid = p_uid and g.species = p_kind and g.tamed)
      or exists (select 1 from creature c where c.world_id = p_world and c.keeper = p_uid and c.species = p_kind and c.mode <> 'wild')
$fn$;

/** One of a kind of yours working the settlement: not round you, not at a post. */
create or replace function thepath_working(p_world uuid, p_uid uuid, p_kind text) returns boolean
language sql stable as $fn$
  select exists (select 1 from creature c where c.world_id = p_world and c.keeper = p_uid and c.species = p_kind
                   and c.mode = 'deed' and c.post is null and c.around is null)
$fn$;

/** An upgrade's requirement, by its place in `upgrade_wants`, met on your settlement. */
create or replace function thepath_wants(p_world uuid, p_uid uuid, p_level int, p_n int) returns boolean
language sql stable as $fn$
  select coalesce((select w.met from upgrade_wants(p_world, p_uid, p_level) with ordinality w(label, met, o) where w.o = p_n), false)
$fn$;

/** A skill some way past its start: done before the Path was on. */
create or replace function thepath_skilled_in(p_world uuid, p_uid uuid, p_skill text) returns boolean
language sql stable as $fn$
  select skill_of(p_world, p_uid, p_skill) >= coalesce((select d.start from skill_def d where d.id = p_skill), 0) + thepath_skilled()
$fn$;

/** A packed tile inside a settlement's border. */
create or replace function thepath_packed(p_world uuid, dd deed) returns boolean
language sql stable as $fn$
  select dd.world_id is not null and exists (
    select 1 from land_tile t, generate_series(greatest(0, dd.x - dd.radius), dd.x + dd.radius) x
     where t.world_id = p_world and t.y between dd.y - dd.radius and dd.y + dd.radius
       and x < length(t.tiles) and get_byte(t.tiles, x) = tile_id('Packed dirt'))
$fn$;

/*
 * Whether a step of the Path, or a detour, is met on the island's own state: the question `path.ts` asks of what the
 * browser holds, asked here of the rows. A step nobody named is not.
 */
create or replace function thepath_met(p_world uuid, p_uid uuid, p_step text) returns boolean
language plpgsql stable as $fn$
declare p player; dd deed; t jsonb;
begin
  select * into p from player where world_id = p_world and uid = p_uid;
  if not found then return false; end if;
  t := coalesce(p.tally, '{}'::jsonb);
  select * into dd from deed d where d.world_id = p_world and d.founded_by = p_uid;
  return coalesce(case p_step
    when 'cheese' then thepath_did(p.thepath, 'ate:cheese') > 0 or pack_count(p_world, p_uid, 'cheese') = 0
    when 'forage' then thepath_did(p.thepath, 'forage') >= thepath_need('forage') or thepath_skilled_in(p_world, p_uid, 'foraging')
    when 'track' then thepath_did(p.thepath, 'track:bevere') > 0 or thepath_tamed(p_world, p_uid, 'bevere')
    when 'tame' then thepath_tamed(p_world, p_uid, 'bevere')
    when 'around' then exists (select 1 from creature c where c.world_id = p_world and c.keeper = p_uid and c.species = 'bevere'
                                 and c.around is not null)
                    or (coalesce((t->>'around')::int, 0) > 0
                        and exists (select 1 from creature c where c.world_id = p_world and c.keeper = p_uid and c.species = 'bevere'
                                      and c.mode <> 'wild'))
    when 'tree' then coalesce((t->>'tree')::int, 0) > 0
    when 'shafts' then coalesce((t->>'made:shaft')::int, 0) > 0
    when 'fish' then (select coalesce(sum(e.value::int), 0) from jsonb_each_text(t) e where e.key like 'fish:%') >= thepath_need('fish')
    when 'cook' then coalesce((t->>'fire')::int, 0) > 0 and coalesce((t->>'made:cooked_fish')::int, 0) > 0
    when 'walk' then dd.world_id is not null or coalesce(stone_gap_at(p_world, floor(p.x)::int, floor(p.y)::int) >= deed_stone_gap(), true)
    when 'site' then dd.world_id is not null or deed_site_refusal(p_world, floor(p.x)::int, floor(p.y)::int) is null
    when 'found' then dd.world_id is not null
    when 'assign' then thepath_working(p_world, p_uid, 'bevere')
    when 'crate' then thepath_wants(p_world, p_uid, 2, 1)
    when 'campfire' then thepath_wants(p_world, p_uid, 2, 2)
    when 'up2' then coalesce(dd.level, 0) >= 2
    when 'clay' then thepath_did(p.thepath, 'clay') >= thepath_need('clay') or pack_count(p_world, p_uid, 'clay') >= thepath_need('clay')
    when 'chiptail' then thepath_working(p_world, p_uid, 'quarra')
    when 'bricks' then coalesce((t->>'made:stone_brick')::int, 0) >= thepath_need('bricks')
                    or coalesce((t->>'made:smelter')::int, 0) > 0 or thepath_wants(p_world, p_uid, 3, 1)
    when 'mortar' then coalesce((t->>'made:mortar')::int, 0) >= thepath_need('mortar')
                    or coalesce((t->>'made:smelter')::int, 0) > 0 or thepath_wants(p_world, p_uid, 3, 1)
    when 'smelter' then thepath_wants(p_world, p_uid, 3, 1)
    when 'up3' then coalesce(dd.level, 0) >= 3
    when 'prospect' then thepath_did(p.thepath, 'prospect') > 0 or thepath_skilled_in(p_world, p_uid, 'prospecting')
    when 'ironemole' then thepath_working(p_world, p_uid, 'mola')
    when 'lumps' then exists (select 1 from metal_def m where m.ore is not null
                                and pack_count(p_world, p_uid, m.lump) >= mould_lumps('anvil_mould', m.id))
                    or thepath_wants(p_world, p_uid, 4, 1) or pack_count(p_world, p_uid, 'anvil') > 0
    when 'anvil' then thepath_wants(p_world, p_uid, 4, 1)
    when 'up4' then coalesce(dd.level, 0) >= 4
    when 'snailglow' then thepath_working(p_world, p_uid, 'embra')
    when 'pack' then thepath_did(p.thepath, 'pack') > 0 or thepath_packed(p_world, dd)
    when 'plan' then dd.world_id is not null and exists (
                       select 1 from building b join building_tile bt on bt.world_id = b.world_id and bt.building = b.id
                        where b.world_id = p_world and abs(bt.x - dd.x) <= dd.radius and abs(bt.y - dd.y) <= dd.radius)
    when 'walls' then thepath_wants(p_world, p_uid, 5, 1)
    when 'workers' then thepath_wants(p_world, p_uid, 5, 2)
    when 'up5' then coalesce(dd.level, 0) >= 5
    when 'chestkit' then thepath_working(p_world, p_uid, 'magga')
    -- The detours.
    when 'snufflet' then thepath_tamed(p_world, p_uid, 'rabba')
    when 'finlet' then thepath_tamed(p_world, p_uid, 'wadd')
    when 'puddlehop' then thepath_tamed(p_world, p_uid, 'holla')
    when 'mudlet' then thepath_tamed(p_world, p_uid, 'noot')
    when 'sandpip' then thepath_tamed(p_world, p_uid, 'crawler')
    when 'botanize' then thepath_did(p.thepath, 'botanize') > 0 or thepath_skilled_in(p_world, p_uid, 'botanizing')
    when 'mine' then coalesce((t->>'ore')::int, 0) > 0
    else false end, false);
end $fn$;

/** The ticks a beat hands over, with any `path:` id the island does not keep taken out: one not on the list, or not met. */
create or replace function thepath_ticks(p_world uuid, p_uid uuid, p_ticked jsonb) returns jsonb
language sql stable as $fn$
  select coalesce(jsonb_agg(e.v order by e.o), '[]'::jsonb)
    from jsonb_array_elements_text(p_ticked) with ordinality e(v, o)
   where e.v not like 'path:%'
      or (substr(e.v, 6) = any (thepath_steps() || thepath_detours()) and thepath_met(p_world, p_uid, substr(e.v, 6)))
$fn$;

-- ------------------------------------------------------------------ supplies

/** Offerings that tame a kind `thepath_sure` of the time at its own chance: the fewest n with (1 - chance)^n at most 1 - sure. */
create or replace function thepath_supply_size(p_chance double precision) returns int
language sql immutable as $fn$
  select case when p_chance >= 1 then 1 when p_chance <= 0 then null
    else greatest(1, ceil(ln(1 - thepath_sure() + 1e-12) / ln(1 - p_chance)))::int end
$fn$;

/** Whether anything a kind eats is had now (`fruits_now`). */
create or replace function thepath_in_season(p_kind text) returns boolean
language sql stable as $fn$
  select exists (select 1 from species_diet d where d.species = p_kind and fruits_now(d.item))
$fn$;

-- ------------------------------------------------------------------ the doors

create or replace function rpc_thepath(p_world uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); v jsonb;
begin
  perform private.pace(auth.uid(), 'act');
  perform private.once();
  if p_on is null then perform private.bad_request('rpc_thepath', 'p_on: want true or false'); end if;
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select thepath into v from player where world_id = p_world and uid = me for update;
  if not found then raise exception 'not on this island'; end if;
  update player set thepath = thepath_state(v) || jsonb_build_object('on', p_on) where world_id = p_world and uid = me;
  if p_on then
    insert into guide_noted (world_id, uid, species)
    select p_world, me, k from unnest(thepath_kinds()) k
     where exists (select 1 from species_def d where d.id = k)
    on conflict do nothing;
  end if;
  perform tell(p_world, me, case when p_on then 'Path: on. Journal, Path tab.' else 'Path: off.' end, 'system');
  return thepath_said(p_world, me);
end $fn$;

create or replace function rpc_thepath_skip(p_world uuid, p_step text, p_skip boolean) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); v jsonb;
begin
  perform private.pace(auth.uid(), 'act');
  perform private.once();
  if p_skip is null then perform private.bad_request('rpc_thepath_skip', 'p_skip: want true or false'); end if;
  if p_step is null or not (p_step = any (thepath_steps())) then perform private.bad_request('rpc_thepath_skip', 'p_step: not a step of the Path'); end if;
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select thepath_state(thepath) into v from player where world_id = p_world and uid = me for update;
  if not found then raise exception 'not on this island'; end if;
  if not (v->>'on')::boolean then raise exception 'Path: off.'; end if;
  update player set thepath = v || jsonb_build_object('skip',
      (select coalesce(jsonb_agg(s order by s), '[]'::jsonb) from (
         select distinct s from jsonb_array_elements_text(v->'skip') s where s <> p_step
         union select p_step where p_skip) u(s)))
    where world_id = p_world and uid = me;
  return thepath_said(p_world, me);
end $fn$;

/*
 * A tame step's supply: the kind's favourite (`species_def.favourite`), as many as tame it `thepath_sure` of the time
 * at its own chance, issued (no sale, no trade, kept at death), at the kit's quality. Once a step; only while the
 * Path is on, the step is open (every step before it ticked or skipped) and nothing the kind eats is had now.
 */
create or replace function rpc_thepath_supply(p_world uuid, p_step text) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); v jsonb; p player; sd species_def; v_n int; v_season text; v_open boolean;
begin
  perform private.pace(auth.uid(), 'act');
  perform private.once();
  if p_step is null or not exists (select 1 from thepath_tames() t where t.step = p_step) then
    perform private.bad_request('rpc_thepath_supply', 'p_step: not a tame step of the Path');
  end if;
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me for update;
  if not found then raise exception 'not on this island'; end if;
  v := thepath_state(p.thepath);
  if not (v->>'on')::boolean then raise exception 'Path: off.'; end if;
  if v->'supply' ? p_step then raise exception 'Path supply: already handed out for this step.'; end if;
  -- Open: every step before it ticked or skipped.
  select bool_and(coalesce(p.ticked, '[]'::jsonb) ? ('path:' || s) or v->'skip' ? s) into v_open
    from unnest(thepath_steps()) with ordinality u(s, o)
   where u.o < (select u2.o from unnest(thepath_steps()) with ordinality u2(s, o) where u2.s = p_step);
  if not coalesce(v_open, true) then raise exception 'Path supply: not this step yet.'; end if;
  select d.* into sd from species_def d where d.id = (select t.species from thepath_tames() t where t.step = p_step);
  if thepath_in_season(sd.id) then raise exception 'Path supply: % eats what is in season now.', sd.name; end if;
  v_n := thepath_supply_size(sd.tame_chance);
  v_season := coalesce(fruit_season(), '');
  insert into item (world_id, holder, holder_uid, def, ql, count, issued)
  values (p_world, 'player', me, sd.favourite, 20, v_n, true);
  update player set thepath = v || jsonb_build_object('supply', v->'supply'
      || jsonb_build_object(p_step, jsonb_build_object('item', sd.favourite, 'n', v_n, 'season', v_season)))
    where world_id = p_world and uid = me;
  perform tell(p_world, me, 'Path supply: ' || lower((select i.name from item_def i where i.id = sd.favourite)) || ' ×' || v_n
    || ' (' || v_season || '), issued.', 'event');
  return thepath_said(p_world, me);
end $fn$;

/*
 * The nearest tiles a settlement could be founded on, past the stones' gap, each with at least
 * `thepath_site_trees` trees within `thepath_site_tree_reach` tiles (on either axis), water within
 * `thepath_site_water` and bare rock within `thepath_site_rock`; `thepath_site_count` of them, no two within
 * `thepath_site_apart` of each other, nearest to you first. Looked for every `thepath_site_every` tiles within
 * `thepath_site_reach` of you: the ground round there is read once, a row of land at a time, into summed tables, so
 * each candidate costs a handful of lookups whatever the island's size; only the ones that pass go to
 * `deed_site_refusal`, nearest first, until there are enough. Water here is a tile with a corner under the sea.
 */
create or replace function thepath_sites(p_world uuid, p_uid uuid) returns jsonb
language plpgsql stable set work_mem = '32MB' as $fn$
declare
  p player; v_size int; R int := thepath_site_reach(); E int := thepath_site_every();
  TR int := thepath_site_tree_reach(); WR int := thepath_site_water(); KR int := thepath_site_rock();
  M int; x0 int; y0 int; x1 int; y1 int; nx int; ny int; px int; py int; w1 int;
  v_tree int := tile_id('Tree'); v_rock int := tile_id('Rock');
  s_tree int[]; s_wet int[]; s_rock int[];
  c record; v_out jsonb := '[]'::jsonb; v_found int := 0; v_d int; v_w int; v_k int; v_trees int; v_lair record;
  a int; b int; lo int; hi int;
  v_want int := thepath_site_count(); v_apart double precision := thepath_site_apart();
begin
  select * into p from player where world_id = p_world and uid = p_uid;
  if not found then return '[]'::jsonb; end if;
  select size into v_size from world where id = p_world;
  M := greatest(TR, WR, KR);
  px := floor(p.x)::int; py := floor(p.y)::int;
  x0 := greatest(0, px - R - M); y0 := greatest(0, py - R - M);
  x1 := least(v_size - 1, px + R + M); y1 := least(v_size - 1, py + R + M);
  nx := x1 - x0 + 1; ny := y1 - y0 + 1; w1 := nx + 1;
  /*
   * Summed tables over the window: cell (i, j), i from 0 to ny and j from 0 to nx, holds the count over every tile
   * above and left of it, x from x0 to x0 + j - 1 and y from y0 to y0 + i - 1; kept a row at a time, the cell at
   * i * (nx + 1) + j + 1. Trees, tiles with a corner under water, bare rock.
   */
  with rw as materialized (
    -- Each row of the window cut out of its land row once: the tiles, and the corners above and below.
    select ii.i, substr(t.tiles, x0 + 1, nx) as tl, substr(c0.heights, 2 * x0 + 1, 2 * (nx + 1)) as h0,
           substr(c1.heights, 2 * x0 + 1, 2 * (nx + 1)) as h1
      from generate_series(0, ny) ii(i)
      left join land_tile t on ii.i > 0 and t.world_id = p_world and t.y = y0 + ii.i - 1
      left join land_corner c0 on ii.i > 0 and c0.world_id = p_world and c0.y = y0 + ii.i - 1
      left join land_corner c1 on ii.i > 0 and c1.world_id = p_world and c1.y = y0 + ii.i
  ), cell as materialized (
    select rw.i, jj.j, (b.tile = v_tree)::int as vt, (b.tile = v_rock)::int as vk,
           (jj.j > 0 and rw.tl is not null
            and least(b_i16(rw.h0, jj.j - 1), b_i16(rw.h0, jj.j), b_i16(rw.h1, jj.j - 1), b_i16(rw.h1, jj.j)) < 0)::int as vw
      from rw cross join generate_series(0, nx) jj(j)
      cross join lateral (select case when jj.j > 0 and rw.tl is not null then get_byte(rw.tl, jj.j - 1) else -1 end as tile) b
  )
  select array_agg(q.st order by q.i, q.j), array_agg(q.sw order by q.i, q.j), array_agg(q.sk order by q.i, q.j)
    into s_tree, s_wet, s_rock
    from (
      select r.i, r.j,
             sum(r.ct) over (partition by r.i order by r.j rows unbounded preceding)::int as st,
             sum(r.cw) over (partition by r.i order by r.j rows unbounded preceding)::int as sw,
             sum(r.ck) over (partition by r.i order by r.j rows unbounded preceding)::int as sk
        from (
          select g.i, g.j,
                 sum(g.vt) over (partition by g.j order by g.i rows unbounded preceding) as ct,
                 sum(g.vw) over (partition by g.j order by g.i rows unbounded preceding) as cw,
                 sum(g.vk) over (partition by g.j order by g.i rows unbounded preceding) as ck
            from cell g
        ) r
    ) q;
  for c in
    select cx, cy from generate_series(px - R, px + R, E) cx, generate_series(py - R, py + R, E) cy
     where cx - M >= x0 and cy - M >= y0 and cx + M <= x1 and cy + M <= y1
     order by (cx - px) * (cx - px) + (cy - py) * (cy - py), cy, cx
  loop
    -- A box of tiles (cx - r .. cx + r, cy - r .. cy + r) off a table: four cells.
    a := c.cx - TR - x0; b := c.cx + TR - x0 + 1; lo := c.cy - TR - y0; hi := c.cy + TR - y0 + 1;
    v_trees := s_tree[hi * w1 + b + 1] - s_tree[lo * w1 + b + 1] - s_tree[hi * w1 + a + 1] + s_tree[lo * w1 + a + 1];
    continue when v_trees < thepath_site_trees();
    a := c.cx - WR - x0; b := c.cx + WR - x0 + 1; lo := c.cy - WR - y0; hi := c.cy + WR - y0 + 1;
    continue when s_wet[hi * w1 + b + 1] - s_wet[lo * w1 + b + 1] - s_wet[hi * w1 + a + 1] + s_wet[lo * w1 + a + 1] = 0;
    a := c.cx - KR - x0; b := c.cx + KR - x0 + 1; lo := c.cy - KR - y0; hi := c.cy + KR - y0 + 1;
    continue when s_rock[hi * w1 + b + 1] - s_rock[lo * w1 + b + 1] - s_rock[hi * w1 + a + 1] + s_rock[lo * w1 + a + 1] = 0;
    continue when exists (select 1 from jsonb_array_elements(v_out) o
                           where sqrt(power((o->>'x')::int - c.cx, 2) + power((o->>'y')::int - c.cy, 2)) < v_apart);
    continue when deed_site_refusal(p_world, c.cx, c.cy) is not null;
    -- How far the water and the rock are: the smallest box round it that holds any.
    v_w := null;
    for v_d in 0..WR loop
      a := c.cx - v_d - x0; b := c.cx + v_d - x0 + 1; lo := c.cy - v_d - y0; hi := c.cy + v_d - y0 + 1;
      if s_wet[hi * w1 + b + 1] - s_wet[lo * w1 + b + 1] - s_wet[hi * w1 + a + 1] + s_wet[lo * w1 + a + 1] > 0 then
        v_w := v_d; exit;
      end if;
    end loop;
    v_k := null;
    for v_d in 0..KR loop
      a := c.cx - v_d - x0; b := c.cx + v_d - x0 + 1; lo := c.cy - v_d - y0; hi := c.cy + v_d - y0 + 1;
      if s_rock[hi * w1 + b + 1] - s_rock[lo * w1 + b + 1] - s_rock[hi * w1 + a + 1] + s_rock[lo * w1 + a + 1] > 0 then
        v_k := v_d; exit;
      end if;
    end loop;
    -- The nearest lair you have seen, within the reach looked over.
    v_lair := null;
    select k.name, floor(sqrt(power(l.x - c.cx, 2) + power(l.y - c.cy, 2)))::int as d into v_lair
      from lair_seen s join lair l on l.world_id = s.world_id and l.id = s.lair join lair_kinds() k on k.id = l.kind
     where s.world_id = p_world and s.uid = p_uid and power(l.x - c.cx, 2) + power(l.y - c.cy, 2) <= R * R
     order by 2 limit 1;
    v_out := v_out || jsonb_build_object('x', c.cx, 'y', c.cy, 'trees', v_trees, 'water', v_w, 'rock', v_k,
                                         'lair', v_lair.name, 'lair_at', v_lair.d);
    v_found := v_found + 1;
    exit when v_found >= v_want;
  end loop;
  return v_out;
end $fn$;

create or replace function rpc_thepath_sites(p_world uuid) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid();
begin
  perform private.pace(auth.uid(), 'act');
  perform private.once();
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then raise exception 'not on this island'; end if;
  return thepath_sites(p_world, me);
end $fn$;

-- ------------------------------------------------------------------ founding asks the same

CREATE OR REPLACE FUNCTION public.deed_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare p player; tx int; ty int;
begin
  select * into p from player where world_id = p_world and uid = p_uid;
  tx := floor(p.x)::int; ty := floor(p.y)::int;
  if exists (select 1 from deed d where d.world_id = p_world and d.founded_by = p_uid) then
    return 'Already founded a settlement. Disband it first.';
  end if;
  if pack_count(p_world, p_uid, 'deed_stake') <= 0 then return 'You have no ' || (select lower(d.name) from item_def d where d.id = 'deed_stake') || '.'; end if;
  -- The tile's own checks: the edge, the ground, other tokens, the stones and the lairs (`deed_site_refusal`).
  return deed_site_refusal(p_world, tx, ty);
end $function$;

-- ------------------------------------------------------------------ Track takes a noted kind

CREATE OR REPLACE FUNCTION public.track_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare sd species_def;
begin
  select * into sd from species_def d where d.id = p_target->>'species';
  if sd.id is null then return 'No such kind.'; end if;
  -- A monster's trail is its lair's, seen or not (`lair_track`).
  if sd.monster then return null; end if;
  -- A kind the Path noted (`guide_noted`) is tracked as if seen.
  if not exists (select 1 from guide g where g.world_id = p_world and g.uid = p_uid and g.species = sd.id)
     and not exists (select 1 from guide_noted n where n.world_id = p_world and n.uid = p_uid and n.species = sd.id) then
    return sd.name || ' not seen yet: only kinds marked seen in your field guide can be tracked.';
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_guide(p_world uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid();
begin
  perform private.pace(auth.uid(), 'look');
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then
    raise exception 'you are not on this island';
  end if;
  return (select jsonb_build_object(
      'seen', coalesce(jsonb_agg(g.species order by g.species), '[]'::jsonb),
      'tamed', coalesce(jsonb_agg(g.species order by g.species) filter (where g.tamed), '[]'::jsonb),
      'bred', coalesce(jsonb_agg(g.species order by g.species) filter (where g.bred), '[]'::jsonb))
    from guide g where g.world_id = p_world and g.uid = me)
    -- And the kinds the Path noted (`guide_noted`): Track takes them; nothing counts them.
    || jsonb_build_object('noted', coalesce((select jsonb_agg(n.species order by n.species) from guide_noted n
                                             where n.world_id = p_world and n.uid = me), '[]'::jsonb));
end $function$;

-- ------------------------------------------------------------------ every go, and every beat

CREATE OR REPLACE FUNCTION private.act_go(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_tool text; v_path jsonb;
begin
  -- Asked before the go changes what it is asked of: a wall's material, as the wall is finished.
  v_tool := private.job_tool(p_world, p_uid, p_action, p_target);
  perform set_config('wildermon.worn', '', true);
  -- The Path's goes (`private.thepath_before`): null, and nothing more read, unless it is on and counts this one.
  v_path := private.thepath_before(p_world, p_uid, p_action, p_target);
  perform act_perform(p_world, p_uid, p_action, p_target);
  if v_path is not null then perform private.thepath_after(p_world, p_uid, p_action, p_target, v_path); end if;
  if v_tool is not null and position(',' || v_tool || ',' in ',' || coalesce(current_setting('wildermon.worn', true), '')) = 0 then
    perform wear_tool(held_tool(p_world, p_uid, v_tool), private.job_wear(p_action));
  end if;
  perform set_config('wildermon.worn', '', true);
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_settle(p_seen bigint DEFAULT NULL::bigint, p_world uuid DEFAULT NULL::uuid, p_said bigint DEFAULT NULL::bigint, p_book boolean DEFAULT false, p_ticked jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); r record; n int := 0; p player; v_world uuid; v_ticked jsonb;
begin
  perform private.pace(auth.uid(), 'look');
  perform private.check_args('rpc_settle', 'p_ticked', p_ticked, private.spec_ticked());
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  perform private.note_ip(me);

  /*
   * Which island this is a heartbeat for, settled before anything is written.
   *
   * It used to be `order by seen_at desc limit 1` over every row with your uid
   * on it, and the update above it had no world in its `where` either — so one
   * beat set `seen_at` to the same instant on every island you have ever
   * joined, and then picked between them with a sort that had nothing left to
   * sort by. Three rows, one timestamp, no tie-break: the answer is whichever
   * one Postgres happens to hand back, and that is a choice of plan rather
   * than a fact about you.
   *
   * The same answer carries the hour and the bars, so when the choice moved,
   * both moved together — reported as "occasionally it switches randomly to
   * nighttime and hunger/thirst plummet until refreshed". A refresh put it
   * right because `rpc_join` names its island, and the next beat broke it
   * again because this one did not.
   *
   * So the browser says where it is standing. `rpc_settle` was the only door
   * of the twenty that did not take a `p_world`, and it is the one that runs
   * every minute of every session.
   */
  if p_world is not null then
    select world_id into v_world from player where uid = me and world_id = p_world;
  end if;
  if v_world is null then
    -- A page that has not been redeployed yet, and does not say. The best
    -- guess is still a guess, but `world_id` breaks the tie, so a session gets
    -- the same wrong island every beat rather than a different one each time.
    select world_id into v_world from player where uid = me
      order by seen_at desc, world_id limit 1;
  end if;
  if v_world is null then return jsonb_build_object('settled', 0); end if;

  -- Standing here, and only here. Keeping `seen_at` fresh on every island at
  -- once told each of them you were present, which is how a body could be left
  -- standing on an island you walked away from an hour ago.
  update player set seen_at = now(), away = false,
         seen_change = greatest(seen_change, coalesce(p_seen, 0))
    where uid = me and world_id = v_world
      and (away or seen_at < now() - interval '5 seconds' or coalesce(p_seen, 0) > seen_change);
  /*
   * And anything newly ticked off the journal.
   *
   * The ticking itself stays in the browser, because a goal is a question
   * about everything at once — the book, the pack, the ground, what is
   * standing on it — and eighty-five of those predicates are eighty-five
   * ports for another day. What the island owns is the *record*: which ones
   * are done, so that they stay done through a refresh and a change of
   * machine. An id nobody knows is kept as it is rather than refused; the
   * journal is a list of things somebody thought worth doing and there is
   * nothing here worth guarding.
   */
  /*
   * A Path step's tick (`path:<step>`) is kept only when it is on the Path's list and the island's own state says
   * the step is met (`thepath_ticks`): the browser cannot tick one by itself.
   */
  if p_ticked is not null and jsonb_typeof(p_ticked) = 'array' and jsonb_array_length(p_ticked) > 0 then
    v_ticked := thepath_ticks(v_world, me, p_ticked);
  end if;
  if v_ticked is not null and jsonb_array_length(v_ticked) > 0 then
    update player set
        ticked = (select coalesce(jsonb_agg(distinct g), '[]'::jsonb)
                  from (select jsonb_array_elements_text(coalesce(ticked, '[]'::jsonb)) as g
                        union
                        select jsonb_array_elements_text(v_ticked)) u),
        tally_at = now()
      where uid = me and world_id = v_world
        and not (coalesce(ticked, '[]'::jsonb) @> v_ticked);
  end if;
  for r in select world_id from player
    where uid = me and world_id = v_world and act is not null and act_ends <= now()
  loop
    n := n + settle(r.world_id, me);
  end loop;
  /*
   * And the body itself, which nothing had ever brought up to date.
   *
   * `settle` above runs only for somebody with a job whose time is up, and
   * `world_tick` only for the same — so a body standing still never got
   * hungry, never got its wind back and never healed. This is the heartbeat
   * every browser makes anyway, once a minute, and it is where a body that is
   * only standing there lives.
   */
  perform body_settle(v_world, me);
  select * into p from player where world_id = v_world and uid = me;
  -- Said before the row is read back, so what goes out is what was true when
  -- it was read rather than what was true a statement ago.
  if p.skills_at is not null and (p.skills_seen is null or p.skills_at > p.skills_seen) then
    update player set skills_seen = now() where world_id = v_world and uid = me;
  end if;
  if p.tally_at is not null and (p.tally_seen is null or p.tally_at > p.tally_seen) then
    update player set tally_seen = now() where world_id = v_world and uid = me;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'settled', n,
    -- How far the island has let the land's history go. A browser whose place
    -- in it is further back reads the land again; see `change_keep`.
    'land_from', (select nullif(changes_from, 0) from world where id = v_world),
    'act', p.act,
    'act_tool', p.act_tool,
    'blocked_at', p.blocked_at,
    'hurt_at', p.hurt_at,
    'hurt_where', p.hurt_where,
    'hurt_heavy', p.hurt_heavy,
    'fell', p.fell,
    'ends', p.act_ends,
    'left', p.act_left,
    -- And how many were asked for, which nothing wrote down until now. The bar
    -- says "3 of 10" off this and `left`; the browser used to keep its own
    -- tally, which is a second opinion about a number the island owns — and it
    -- only ever heard one for a job that *started*, never for one that waited
    -- its turn in the queue.
    'goes', p.act_goes,
    'secs', case when p.act_ends is null then null
                 else greatest(0, extract(epoch from (p.act_ends - now()))) end,
    'total', case when p.act_ends is null or p.act_started is null then null
                  else greatest(0.001, extract(epoch from (p.act_ends - p.act_started))) end,
    -- What is lined up behind it, and how much room is left in your head.
    'queue', coalesce((select jsonb_agg(jsonb_build_object(
                         'action', q->>'action',
                         'goes', greatest(1, coalesce((q->>'goes')::int, 1))) order by o)
                       from jsonb_array_elements(p.act_queue) with ordinality t(q, o)), '[]'::jsonb),
    'cap', case when v_world is null then null else queue_capacity(v_world, me) end,
    -- The bars, which have been the ones you came ashore with until now.
    'stats', p.stats,
    /*
     * And what you are carrying, which has never gone out at all.
     *
     * The island has kept wounds since they were ported — `wounds_settle`
     * drains your health from them, turns them bad, closes them over and says
     * so — and no door has ever mentioned them. So on an island the wound
     * window was empty however cut about you were, `bleeding()` was false, and
     * a bandage or a healing cover had nothing to be put on. The health you
     * were losing to them arrived as a number going down for no stated reason.
     *
     * Sent every beat rather than when they change, unlike the skill book
     * above: this is a column of the row that has already been read, not an
     * aggregate over a table, so there is nothing to save by leaving it out —
     * and `[]` has to be able to mean "they have all closed".
     */
    'wounds', coalesce(p.wounds, '[]'::jsonb),
    /*
     * And the rest of what you are, which the row has kept all along.
     *
     * Rest, the dishes favouring a trade, the knacks, the titles and what is
     * on your table: every one of them is a column the browser draws and none
     * of them has ever crossed. A hud saying "Rested 12m · everything ×2" off
     * a number the island never sent is a hud making it up.
     */
    'rested', coalesce(p.rested, 0),
    -- And whether it is switched on (`rpc_sleep_bonus`).
    'sleep_on', coalesce(p.sleep_on, false),
    -- And your favour as it stands now, with what has trickled in since it was last settled, up to what your faith holds.
    'favour', least(favour_cap(skill_of(p.world_id, me, faith_skill())),
                    coalesce(p.favour, 0) + greatest(0, extract(epoch from (now() - coalesce(p.favour_at, now())))) * favour_trickle()),
    'boons', coalesce(p.boons, '[]'::jsonb),
    'knacks', coalesce(p.knacks, '{}'::jsonb),
    'titles', coalesce(p.titles, '[]'::jsonb),
    -- The shut recipes read (`private.recipe_known`), which the crafting window opens.
    'recipes', coalesce((select jsonb_agg(k.recipe order by k.recipe) from private.recipe_known k
                          where k.world_id = p.world_id and k.uid = me), '[]'::jsonb),
    'title', p.title,
    'nutrition', coalesce(p.nutrition, '{}'::jsonb),
    /*
     * And what you have on.
     *
     * `equipped` is a column of this row that the island has written on every
     * `equip` and every `unequip` since the day those two were dispatched
     * here, and has never once handed back. So a browser that reloaded held
     * an empty record: nothing in the pack was marked worn, no armour of
     * yours counted towards what your back would take, and the only entry the
     * item menu would offer on the helm already on your head was `Wear or
     * wield`. Reported: *"there's no option to unequip gear."*
     *
     * Sent every beat rather than when it changes, like the wounds above and
     * for the same reason: it is a column of a row that has already been
     * read, so there is nothing to save by leaving it out -- and an empty
     * slot has to be able to mean "there is nothing on it".
     */
    'equipped', coalesce(p.equipped, '{}'::jsonb),
    /*
     * Every skill, but only when one of them has moved.
     *
     * The log says one went up and the window said it did not, which is why
     * this is here — and it was aggregating the whole book on every beat,
     * standing still, to hand back the forty numbers it handed back last time.
     * `skill_raise` stamps the player now, so a quiet beat costs nothing and a
     * busy one costs what it always did.
     *
     * Left out rather than emptied when nothing moved, and the browser applies
     * only the keys it is given.
     *
     * And `p_book`, which is the whole of what this got wrong. The stamp is on
     * the *player*, not on the session — so a browser that had just opened,
     * holding nothing but the starting value of every skill, was told nothing,
     * because the last session had already been told. Reported as mining
     * refusing an iron vein: "Iron vein needs mining 5 to work. Yours is 1.0",
     * with the island's own log line saying 13.26 two lines above it. Worse
     * than wrong — it locks: the seam you cannot start is the seam that would
     * have raised the skill that says you can.
     *
     * So the browser says whether it holds a book, the same way it says how
     * much of the talk it has heard. It asks once, gets the lot, and every
     * beat after that is the delta this was written for.
     */
    'skills', case when not coalesce(p_book, false)
                        and p.skills_seen is not null and p.skills_at is not null
                        and p.skills_at <= p.skills_seen then null
                   else coalesce((select jsonb_object_agg(s.id, s.value) from skill s
                                  where s.world_id = v_world and s.uid = me), '{}'::jsonb) end,
    /*
     * And the journal: what you have done, what you have made, and what is
     * ticked off.
     *
     * Behind the same cursor the book is behind, and for the same reason: it
     * only moves when something is noted, and a browser that has just opened
     * holds none of it. Three fields rather than one because they are three
     * different things — a count of goes, a record of a bench, and a list of
     * ids — and because the browser applies each of them differently.
     */
    'tally', case when not coalesce(p_book, false)
                       and p.tally_seen is not null and p.tally_at is not null
                       and p.tally_at <= p.tally_seen then null
                  else coalesce(p.tally, '{}'::jsonb) end,
    'ledger', case when not coalesce(p_book, false)
                        and p.tally_seen is not null and p.tally_at is not null
                        and p.tally_at <= p.tally_seen then null
                   else coalesce(p.ledger, '{}'::jsonb) end,
    'ticked', case when not coalesce(p_book, false)
                        and p.tally_seen is not null and p.tally_at is not null
                        and p.tally_at <= p.tally_seen then null
                   else coalesce(p.ticked, '[]'::jsonb) end,
    /*
     * And anything said since you last heard.
     *
     * Talk and the island's own lines arrive over Realtime, which is fast and
     * is not a promise: a channel that dropped for a moment loses them for
     * good, and `event` was the one table with no way to catch up. The browser
     * carries the highest `n` it has seen and gets whatever is newer, so a
     * dropped line is twenty seconds late rather than gone.
     */
    'said', case when p_said is null then null
                 when p_said <= 0 then '[]'::jsonb
                 else coalesce((select jsonb_agg(jsonb_build_object(
                        'n', e.n, 'text', e.text, 'kind', e.kind, 'at', e.at) order by e.n)
                      from event e
                      where e.world_id = v_world and e.n > p_said
                        and (e.uid is null or e.uid = me)
                      limit 60), '[]'::jsonb) end,
    /*
     * And where the talk had got to when you arrived.
     *
     * The catch-up above is for a channel that dropped, and it is counted from
     * the highest line the browser has heard. A browser that has just opened
     * has heard none, carries a nought, and was handed the *oldest* sixty
     * lines on the island — "You wash ashore on an untouched island", measured
     * on a body that came ashore a week ago — and then the next sixty on the
     * beat after that, walking forward through its own history while somebody
     * watched.
     *
     * So a nought means "I have just got here" rather than "from the
     * beginning": nothing is missed yet, and the mark to count from comes back
     * instead. What was said before you arrived is `rpc_chat`'s job and it
     * already does it, sixty lines of talk, which is a different question from
     * this one.
     */
    'saidTo', case when coalesce(p_said, 1) > 0 then null
                   else coalesce((select max(e.n) from event e where e.world_id = v_world), 0) end,
    -- The ore a prospector read, and how much longer it is lit for.
    -- Your path: its picks, Calm, the spots sat and what a technique marked (`path_beat`).
    'path', case when v_world is null then null else path_beat(v_world, me) end,
    'marks', case when jsonb_typeof(p.stats->'prospected') <> 'object' then null
                  else jsonb_build_object(
                    'tiles', p.stats->'prospected'->'tiles',
                    'secs', greatest(0, (p.stats->'prospected'->>'until')::double precision
                                        - extract(epoch from now()))) end,
    'queued', coalesce(jsonb_array_length(p.act_queue), 0),
    -- And what hour it is out there, which the browser had been keeping for
    -- itself. Seconds since the island began, so the browser works the hour
    -- out the way it always did rather than being handed a picture to draw.
    'time', case when v_world is null then null else world_time(v_world) end,
    -- The island's own reading of the same clock. Nothing draws from this: it
    -- is here so that two ends disagreeing about whether it is dark can be
    -- seen, rather than found out by a lantern that would not light.
    'night', case when v_world is null then null else is_night(v_world) end,
    /*
     * And what spells have left on you, and the skin over you: both kept on
     * this row and never said, so a reload lost every timer in the effects
     * row (`blessings_said`, `skin_said`). Sent every beat, as the wounds
     * are, so that an empty one can mean "nothing holds".
     */
    'blessings', blessings_said(p.blessings),
    'skin', skin_said(v_world, p.stats))
    -- Where the body fell and the settlements it may wake at, while it may pick (`respawn_offer`).
    || jsonb_build_object('fallen', respawn_offer(v_world, me))
    -- Seconds of the death grace left, or null once it is over (`death_grace_left`).
    || jsonb_build_object('grace', death_grace_left(v_world, me))
    -- Logged off asleep in a bed, by its name: the page logs off (`sleep_fall`).
    || jsonb_build_object('asleep', (select a.name from private.asleep a where a.world_id = v_world and a.uid = me))
    -- The Path's record (`player.thepath`): on, skipped, supplied, counted; null for a body that never turned it on.
    || jsonb_build_object('thepath', p.thepath));
end $function$;

select private.lock_doors();
