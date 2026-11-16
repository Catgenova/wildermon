-- Every kind the Guiding Light asks you to track or tame, the Sapgnaw (`bevere`) first, in every body's field guide
-- from the start, marked seen, so Track takes each at once; a wild Sapgnaw near where a new body comes ashore; and a
-- wild one of each Guiding Light tame step's kind near you as it comes up.
--
-- Reported: "players are not starting the game with Saginaw discovered in the field guide, so they cant track him".
-- Track (`track_refusal`) takes a kind with a row in `guide` (seen) or in `guide_noted` (the Guiding Light's notes, put
-- there only when it is turned on). Nothing put the Sapgnaw in either at the join: there was no list of kinds a
-- book starts with, so it was refused, "Sapgnaw not seen yet", until one was seen. Nothing else stood in the way: the
-- nearest wild one is looked for over every wild row of the kind (`perform_track`), with no kind left out.
--
-- Asked for as well: "A player spawning should also spawn a nearby sapgnaw. Similar logic for other requirements of
-- guiding light", and "Make sure for those that already populate as seen in the guide": the kinds a book starts with
-- are every step's and detour's `tame` in `src/game/path.ts`, read off them on both sides.
--
--   guide_start()                    the kinds a book starts with (`GUIDE_START`, `src/game/path.ts`);
--   ashore_kinds()                   the kinds a wild one of is put near a new body: the Track step's (`ASHORE_KINDS`);
--   wild_near()                      how near a wild one of a kind to track or tame is put (`WILD_NEAR`);
--   thepath_stocks()                 the Path's steps and detours that put one, with the step each comes up with
--                                    (`PATH_STOCKS`, `src/game/path.ts`);
--   thepath_crate(), thepath_crates() the wildermon crate, and how many each of them hands out (`PATH_CRATE`,
--                                    `PATH_CRATES`). The six are the definitions'; the definitions migration after
--                                    this one restates them from the TypeScript.
--   guide_begin(world, uid)          each start kind marked seen (`guide_mark`), and nothing else: a row already
--                                    there is left as it is, tamed and bred and all.
--   wild_near_has(world, kind, x, y) a wild one of the kind, nobody's, within `wild_near()` of (x, y).
--   private.wild_near_put(...)       where there is none: one put down on a tile the kind lives on (`suits`, deep
--                                    water for a kind of it; never on a settlement, nor in the safe ring for a kind it
--                                    keeps out), within `wild_near()`, else twice and four times that; of no rarity,
--                                    at its first stage, in no wild form. Its id, or null when none was put.
--   private.thepath_stock(world, uid) the Guiding Light, on: the step the island has you on (the first neither ticked
--                                    nor skipped), and for it and each taming detour beside it not yet met and not
--                                    stocked before, its kind marked seen and a wild one put near you if none is;
--                                    the creature's id kept under `player.thepath.stocked`, once a step, for good.
--                                    And for each of them not met and not crated before, `thepath_crates()` issued
--                                    wildermon crates, short of the empty ones you carry (each covers one), the
--                                    item's id kept under `player.thepath.crates`, once a step.
--
-- Asked for as well: "If necessary provide as quest rewards enough wildermon crates to capture the required mons".
-- A second wildermon is tamed only into an empty wildermon crate in the pack while one follows you
-- (`tame_room_refusal`, by an offering and out of a trap alike), and the crate is taken only by a tame that takes
-- (`crate_shut_in`), never by a failed offering: one a step, no spare. Nothing else is asked but the offering, which
-- the supply already covers (`rpc_thepath_supply`).
--
-- Where the island learns the step you are on has moved, it asks: a step's tick kept (`rpc_settle`), the Guiding Light
-- turned on (`rpc_thepath`), and a step skipped or taken back (`rpc_thepath_skip`). The browser's own reckoning of
-- the step (`currentStep`) is not asked: the island reads its own record of ticks and skips.
--
-- `thepath_state` keeps `stocked` and `crates` through every door that rewrites the record.
--
-- A new body (`rpc_join`): its book begun, and a wild one of each `ashore_kinds()` near it if none is.
--
-- And everybody already on an island: each start kind marked seen where it is not in the book, and no row that is
-- there touched. The mark counts as a kind seen in the journal (`guide_journal`), as any sighting does.
--
-- Deploy: the browser's book starts with the same kinds (`startGuide`) and reads no new column; `stocked` and
-- `crates` are keys in a record it already takes and ignores. Until this is on the project, Track from that page is refused by the island
-- in the words it always used, and nothing is put down.

set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

-- ------------------------------------------------------------------ the definitions, until the dump restates them

create or replace function guide_start() returns text[] language sql immutable as $fn$ select array['bevere', 'quarra', 'mola', 'embra', 'magga', 'rabba', 'wadd', 'holla', 'noot', 'crawler']::text[] $fn$;
create or replace function ashore_kinds() returns text[] language sql immutable as $fn$ select array['bevere']::text[] $fn$;
create or replace function wild_near() returns int language sql immutable as $fn$ select 12 $fn$;
create or replace function thepath_crate() returns text language sql immutable as $fn$ select 'creature_crate' $fn$;
create or replace function thepath_crates() returns int language sql immutable as $fn$ select 1 $fn$;
create or replace function thepath_stocks() returns table (id text, species text, beside text) language sql immutable as $fn$ select * from (values ('track', 'bevere', 'track'), ('tame', 'bevere', 'tame'), ('chiptail', 'quarra', 'chiptail'), ('ironemole', 'mola', 'ironemole'), ('snailglow', 'embra', 'snailglow'), ('chestkit', 'magga', 'chestkit'), ('snufflet', 'rabba', 'forage'), ('finlet', 'wadd', 'fish'), ('puddlehop', 'holla', 'clay'), ('mudlet', 'noot', 'mortar'), ('sandpip', 'crawler', 'mortar')) v (id, species, beside) $fn$;

-- ------------------------------------------------------------------ the book

/* A body's book begun: each of `guide_start()` marked seen, a kind already in it left as it is. */
create or replace function guide_begin(p_world uuid, p_uid uuid) returns void
language plpgsql as $fn$
begin
  perform guide_mark(p_world, p_uid, k, 'seen') from unnest(guide_start()) k order by k;
end $fn$;

-- ------------------------------------------------------------------ a wild one near

/* A wild one of a kind, nobody's, within `wild_near()` tiles of (x, y), where it is now along its leg. */
create or replace function wild_near_has(p_world uuid, p_species text, p_x double precision, p_y double precision) returns boolean
language sql stable as $fn$
  select exists (select 1 from creature c
                  where c.world_id = p_world and c.species = p_species and c.mode = 'wild' and c.keeper is null
                    and c.to_x between p_x - (wild_near() + leg_slack()) and p_x + (wild_near() + leg_slack())
                    and c.to_y between p_y - (wild_near() + leg_slack()) and p_y + (wild_near() + leg_slack())
                    and sqrt(power(creature_x(c) - p_x, 2) + power(creature_y(c) - p_y, 2)) <= wild_near())
$fn$;

/*
 * Where there is none (`wild_near_has`): one put down on a tile the kind lives on within `wild_near()` of (x, y), else
 * within twice and four times that, as the stock would put it (`site_for`'s checks, the safe ring's); an ordinary
 * one, of no rarity, at its first stage and in no wild form. Its id, or null when one was there or no tile would do.
 */
create or replace function private.wild_near_put(p_world uuid, p_species text, p_x double precision, p_y double precision) returns int
language plpgsql set search_path = public as $fn$
declare sd species_def; v_size int; v_reach int; i int; a double precision; d double precision; v_x int; v_y int;
        v_id int; v_tr text[];
begin
  select * into sd from species_def where id = p_species;
  if sd.id is null or coalesce(sd.monster, false) then return null; end if;
  if wild_near_has(p_world, p_species, p_x, p_y) then return null; end if;
  select w.size into v_size from world w where w.id = p_world;
  if v_size is null then return null; end if;
  foreach v_reach in array array[wild_near(), wild_near() * 2, wild_near() * 4] loop
    for i in 1 .. 96 loop
      a := random() * 2 * pi();
      d := sqrt(random()) * v_reach;
      v_x := floor(p_x + sin(a) * d)::int;
      v_y := floor(p_y + cos(a) * d)::int;
      continue when v_x < 0 or v_y < 0 or v_x >= v_size or v_y >= v_size;
      continue when sqrt(power(v_x + 0.5 - p_x, 2) + power(v_y + 0.5 - p_y, 2)) > v_reach;
      if coalesce(sd.deep_water, false) then
        continue when not deep_tile(p_world, v_x, v_y);
      else
        continue when not creature_tile_ok(p_world, v_x, v_y) or centre_height(p_world, v_x, v_y) < 2;
      end if;
      continue when on_deed(p_world, v_x, v_y);
      continue when not suits(p_world, p_species, v_x, v_y);
      continue when ring_keeps_out(p_species) and in_safe_ring(p_world, v_x + 0.5, v_y + 0.5);
      v_id := creature_spawn(p_world, p_species, v_x + 0.5, v_y + 0.5, 'wild', now() - make_interval(secs => old_at() * 0.5));
      -- Of no rarity: its traits and its health as one of none comes.
      v_tr := roll_traits(0, rarity_step(null));
      update creature c set rare = null, traits = v_tr,
             health = round(sd.health * trait_mul(v_tr, 'hardy') * rarity_blood(null, 'hardy'))
       where c.world_id = p_world and c.id = v_id;
      return v_id;
    end loop;
  end loop;
  return null;
end $fn$;

-- ------------------------------------------------------------------ the Guiding Light

/*
 * The record with every field there: `stocked`, the steps a wild one was put down for, by creature id; and `crates`,
 * the steps wildermon crates were handed out for, by item id.
 */
create or replace function thepath_state(p jsonb) returns jsonb
language sql immutable as $fn$
  select jsonb_build_object(
    'on', coalesce((p->>'on')::boolean, false),
    'skip', case when jsonb_typeof(p->'skip') = 'array' then p->'skip' else '[]'::jsonb end,
    'supply', case when jsonb_typeof(p->'supply') = 'object' then p->'supply' else '{}'::jsonb end,
    'did', case when jsonb_typeof(p->'did') = 'object' then p->'did' else '{}'::jsonb end,
    'stocked', case when jsonb_typeof(p->'stocked') = 'object' then p->'stocked' else '{}'::jsonb end,
    'crates', case when jsonb_typeof(p->'crates') = 'object' then p->'crates' else '{}'::jsonb end)
$fn$;

/*
 * The step the island has you on, and for it and each taming detour beside it (`thepath_stocks`) not met and not
 * stocked before: its kind marked seen, and a wild one put near you where none is (`private.wild_near_put`), kept
 * under `stocked` so it is never put again for that step. And for each not met and not crated before, wildermon
 * crates (`thepath_crates()`), issued, short of the empty ones you carry, kept under `crates`. Nothing with the
 * Guiding Light off or at its end.
 */
create or replace function private.thepath_stock(p_world uuid, p_uid uuid) returns void
language plpgsql set search_path = public as $fn$
declare p player; v jsonb; v_step text; r record; v_id int; v_d int; v_carried int; v_item bigint;
begin
  select * into p from player pl where pl.world_id = p_world and pl.uid = p_uid;
  if not found then return; end if;
  v := thepath_state(p.thepath);
  if not (v->>'on')::boolean then return; end if;
  select u.s into v_step from unnest(thepath_steps()) with ordinality u(s, o)
   where not (coalesce(p.ticked, '[]'::jsonb) ? ('path:' || u.s)) and not (v->'skip' ? u.s)
   order by u.o limit 1;
  if v_step is null then return; end if;
  -- The empty crates you carry, each covering one tame coming up.
  v_carried := cardinality(empty_crates_carried(p_world, p_uid));
  for r in select t.id, t.species, d.name from thepath_stocks() t join species_def d on d.id = t.species
            where t.beside = v_step order by t.id loop
    continue when thepath_met(p_world, p_uid, r.id);
    if not (v->'crates' ? r.id) then
      if v_carried >= thepath_crates() then
        v_carried := v_carried - thepath_crates();
      else
        -- Each a crate of its own: one holds one wildermon.
        for v_d in 1 .. thepath_crates() - v_carried loop
          insert into item (world_id, holder, holder_uid, def, ql, count, issued)
          values (p_world, 'player', p_uid, thepath_crate(), 20, 1, true)
          returning id into v_item;
        end loop;
        perform tell(p_world, p_uid, 'Guiding Light supply: ' || lower((select i.name from item_def i where i.id = thepath_crate()))
          || ' ×' || (thepath_crates() - v_carried) || ', issued.', 'event');
        v_carried := 0;
        v := v || jsonb_build_object('crates', (v->'crates') || jsonb_build_object(r.id, v_item));
        update player set thepath = v where world_id = p_world and uid = p_uid;
      end if;
    end if;
    continue when v->'stocked' ? r.id;
    perform guide_mark(p_world, p_uid, r.species, 'seen');
    v_id := private.wild_near_put(p_world, r.species, p.x, p.y);
    continue when v_id is null;
    v := v || jsonb_build_object('stocked', (v->'stocked') || jsonb_build_object(r.id, v_id));
    update player set thepath = v where world_id = p_world and uid = p_uid;
    select ceil(sqrt(power(creature_x(c) - p.x, 2) + power(creature_y(c) - p.y, 2)))::int into v_d
      from creature c where c.world_id = p_world and c.id = v_id;
    perform tell(p_world, p_uid, 'Guiding Light: wild ' || r.name || ', ' || v_d || ' tiles. Track: Field guide.', 'event');
  end loop;
end $fn$;

-- A step's tick kept: the step after it, asked.
select pg_temp.patch_fn('public.rpc_settle(bigint, uuid, bigint, boolean, jsonb)'::regprocedure,
  $o$        and not (coalesce(ticked, '[]'::jsonb) @> v_ticked);
  end if;
$o$,
  $n$        and not (coalesce(ticked, '[]'::jsonb) @> v_ticked);
    -- A step of the Guiding Light ticked just now: a wild one of the next one's kind near you (`private.thepath_stock`).
    if found and exists (select 1 from jsonb_array_elements_text(v_ticked) t where t like 'path:%') then
      perform private.thepath_stock(v_world, me);
    end if;
  end if;
$n$);

-- Turned on, and a step skipped or taken back: the step you are on, asked.
select pg_temp.patch_fn('public.rpc_thepath(uuid, boolean)'::regprocedure,
  $o$  return thepath_said(p_world, me);$o$,
  $n$  if p_on then perform private.thepath_stock(p_world, me); end if;
  return thepath_said(p_world, me);$n$);
select pg_temp.patch_fn('public.rpc_thepath_skip(uuid, text, boolean)'::regprocedure,
  $o$  return thepath_said(p_world, me);$o$,
  $n$  perform private.thepath_stock(p_world, me);
  return thepath_said(p_world, me);$n$);

-- ------------------------------------------------------------------ a new body

select pg_temp.patch_fn('public.rpc_join(uuid, text, text)'::regprocedure,
  $o$    perform starter_kit(p_world, me);
$o$,
  $n$    perform starter_kit(p_world, me);
    -- Its field guide begun: the kinds every book starts with, seen (`guide_begin`); and a wild Sapgnaw near it.
    perform guide_begin(p_world, me);
    perform private.wild_near_put(p_world, k, p.x, p.y) from unnest(ashore_kinds()) k;
$n$);

-- ------------------------------------------------------------------ everybody already on an island

-- Each kind a book starts with, seen, where it is not in the book; no row touched.
insert into guide (world_id, uid, species)
select p.world_id, p.uid, k
  from player p cross join unnest(guide_start()) k
 where exists (select 1 from species_def d where d.id = k)
 order by p.world_id, p.uid, k
on conflict (world_id, uid, species) do nothing;

select private.lock_doors();
