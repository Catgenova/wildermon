/*
 * Ranks of your own.
 *
 * A settlement's ranks were a fixed ladder -- founder, mayor, builder, guest
 * -- held in `deed_member.role` and asked as "at least a builder?" by
 * `deed_rank`. Asked for: "Allow the founder to establish ranks and advanced
 * permissions for all citizen ranks". So now:
 *
 *   * Every settlement has its own ranks (`deed_rank_def`): up to `rank_cap`
 *     besides its founder, each with a name of at most `rank_name_max`
 *     characters, unique on that settlement, a place in its list (`ord`, 1
 *     the highest) and a set of powers (`perms`, bits by `power_bit`).
 *   * The powers are one list, `rank_power`, mirrored from the browser's
 *     `RANK_POWERS` (`src/game/ranks.ts`): shape, stores, locks, gate, served,
 *     set_bauble, replace_bauble, invite, send_away, set_ranks, upgrade,
 *     rename. Every check that used to ask a rank's name asks a power:
 *
 *       shape            `may_shape`, and so digging, building, greening,
 *                        aqueducts, springs and pulling things down
 *       stores           `crate_yours`, `craft_stock`, `hod_stock`, `dye_barrels`
 *       locks            `lock_shut`: the master key the founder always held
 *       gate             `rune_gate_folk`
 *       served           `bauble_here`
 *       set_bauble,
 *       replace_bauble   `bauble_setting`
 *       invite           `rpc_invite`, and `rpc_social`'s invitations out
 *       send_away        `rpc_leave_deed`: only somebody ranked below you
 *       set_ranks        `rpc_rank`: only somebody ranked below you, only to a
 *                        rank below yours
 *       upgrade, rename  `settlement_refusal`, `perform_settlement`, on the
 *                        settlement whose token the job is aimed at
 *                        (`settlement_aimed`)
 *
 *     Disbanding is no power: it frees the founder's wildermon and tips out
 *     the founder's deed crate, which are theirs, so only the founder does it.
 *   * The founder is no rank and holds every power. Only the founder makes,
 *     renames, reorders and deletes ranks, sets what they may do and which
 *     one an invitation puts newcomers on (`rpc_rank_add`, `rpc_rank_rename`,
 *     `rpc_rank_move`, `rpc_rank_drop`, `rpc_rank_allow`,
 *     `rpc_rank_newcomers`). A rank somebody holds is not deleted: they are
 *     given another first.
 *   * Every settlement starts with Mayor, Builder and Guest
 *     (`deed_ranks_seed`), with exactly what each could do before -- a guest
 *     has always been able to use the crates on the settlement -- and Builder
 *     for newcomers, so nothing changes for anybody today. Existing
 *     settlements are given them here; new ones at founding, by a trigger on
 *     `deed`.
 *   * A power refused says the rank and what it lacks, in the browser's words
 *     (`rank_lacks`, `lacksSaid`): "Your rank at Hearth, Guest, may not open
 *     its locks without the key."
 *
 * `deed_member.rank_id` is the rank. `deed_member.role` stays, as that rank's
 * name in lower case, kept by a trigger (`deed_member_rank`): `deed_role`
 * reads it, a browser from before today reads it from `rpc_social`, and a
 * writer from before today that names a rank there still lands on it.
 * `supabase/test/customranks.ts` holds the two sides to each other.
 *
 * Rewritten here, each from the newest migration that defines it:
 *   may_shape, lock_shut, lock_refusal, ground_deed_refusal
 *                      -- 20260919193000_ranks_and_a_padlock.sql
 *   crate_yours        -- 20260915240000_own_stores2.sql
 *   crate_refusal      -- 20261002123916_piers_and_stilts.sql
 *   craft_stock, hod_stock -- 20261002152542_cellars.sql
 *   dye_barrels        -- 20261010145016_dye_by_weight_and_volume.sql
 *   bauble_here, bauble_setting -- 20260926184119_baubles.sql
 *   rune_gate_folk     -- 20261011052531_rune_gate.sql
 *   aqueduct_plan      -- 20261002164340_jetties_railings_and_columns.sql
 *   aqueduct_refusal   -- 20261002180114_portcullis_drawbridge_and_hidden_doors.sql
 *   green_refusal      -- 20261002135108_aqueducts.sql
 *   last_refusal       -- 20261011060546_memorial_stones.sql
 *                      (each says the rank, where a rank of yours lacks Shape and build)
 *   settlement_refusal -- 20260924150000_a_team_stays_in_the_traces.sql
 *   perform_settlement -- 20260927121838_the_mender_moved_onto_perks.sql
 *   rpc_ground         -- 20261010235813_emberbrand_a_held_stun_and_what_is_put_away.sql
 *   rpc_rank, rpc_invite, rpc_invite_answer, rpc_leave_deed, rpc_social
 *                      -- 20261012234500_mayors_invite_and_ranks_are_set.sql
 * And dropped: `deed_rank(text)`, the ladder, and `rank_may(text)`, a rank's
 * words by its name, which nothing asks any more.
 */
set local lock_timeout = '3s';

-- ---------------------------------------------------------------- the powers

/**
 * Every power a rank can be given: its bit in `perms`, and what it is called
 * after "you may" and after "may not". The browser's `RANK_POWERS`, row for
 * row; a rulebook, so `lock_doors` opens it to be read.
 */
create table if not exists rank_power (
  id text primary key,
  bit int not null unique check (bit between 0 and 30),
  may text not null,
  may_not text not null
);
insert into rank_power (id, bit, may, may_not) values
  ('shape', 0, 'shape its ground and build on it', 'shape its ground or build on it'),
  ('stores', 1, 'use the crates on it and craft from its stores', 'use the crates on it that somebody else made'),
  ('locks', 2, 'open every lock on it without the key', 'open its locks without the key'),
  ('gate', 3, 'light its rune gates', 'light its rune gates'),
  ('served', 4, 'have its baubles work for you on it', 'have its baubles work for them'),
  ('set_bauble', 5, 'set baubles into its altar', 'set baubles into its altar'),
  ('replace_bauble', 6, 'replace a bauble set in its altar', 'replace a bauble already set in its altar'),
  ('invite', 7, 'invite people to it', 'invite anybody to it'),
  ('send_away', 8, 'send away citizens of lower rank', 'send anybody away'),
  ('set_ranks', 9, 'give citizens of lower rank any lower rank', 'set anybody''s rank'),
  ('upgrade', 10, 'upgrade it', 'upgrade it'),
  ('rename', 11, 'rename it', 'rename it')
on conflict (id) do update set bit = excluded.bit, may = excluded.may, may_not = excluded.may_not;

/** A power's bit, written out so a check on every dig is a constant: `rank_power.bit`, and the browser's `powerBit`. */
create or replace function power_bit(p_id text) returns int language sql immutable as $fn$
  select case p_id
    when 'shape' then 1 when 'stores' then 2 when 'locks' then 4 when 'gate' then 8
    when 'served' then 16 when 'set_bauble' then 32 when 'replace_bauble' then 64
    when 'invite' then 128 when 'send_away' then 256 when 'set_ranks' then 512
    when 'upgrade' then 1024 when 'rename' then 2048 else 0 end
$fn$;

/** A rank's `perms` for a list of powers: the browser's `permsOf`. */
create or replace function power_bits(p_ids text[]) returns int language sql immutable as $fn$
  select coalesce(sum(distinct power_bit(x)), 0)::int from unnest(p_ids) x
$fn$;

/** How many ranks a settlement may have besides its founder: the browser's `RANK_CAP`. */
create or replace function rank_cap() returns int language sql immutable as $fn$ select 8 $fn$;
/** The longest a rank's name may be: the browser's `RANK_NAME_MAX`. */
create or replace function rank_name_max() returns int language sql immutable as $fn$ select 20 $fn$;

-- ---------------------------------------------------------------- the ranks

create table if not exists deed_rank_def (
  id bigint generated always as identity primary key,
  world_id uuid not null,
  -- Which settlement, named by whoever founded it, as `deed_member` names it.
  founder uuid not null,
  name text not null check (length(name) between 1 and 20 and name = btrim(name)),
  -- Its place in the list: 1 the highest. The founder is above them all.
  ord int not null check (ord >= 1),
  perms int not null default 0,
  -- The one an invitation puts newcomers on.
  newcomer boolean not null default false,
  foreign key (world_id, founder) references deed (world_id, founded_by) on delete cascade,
  unique (world_id, founder, id),
  -- Deferred, so two ranks swap places in one statement.
  constraint deed_rank_def_ord unique (world_id, founder, ord) deferrable initially deferred
);
create unique index if not exists deed_rank_def_name on deed_rank_def (world_id, founder, lower(name));
create unique index if not exists deed_rank_def_newcomer on deed_rank_def (world_id, founder) where newcomer;

-- Its citizens may read a settlement's ranks; nobody writes them but the doors.
alter table deed_rank_def enable row level security;
drop policy if exists deed_rank_def_read on deed_rank_def;
create policy deed_rank_def_read on deed_rank_def for select to authenticated
  using (founder = (select auth.uid())
         or exists (select 1 from deed_member m
                     where m.world_id = deed_rank_def.world_id and m.founder = deed_rank_def.founder
                       and m.uid = (select auth.uid())));
grant select on deed_rank_def to authenticated;
revoke insert, update, delete, truncate on deed_rank_def from anon, authenticated;
revoke all on deed_rank_def from anon;

/**
 * What every settlement starts with, highest first: Mayor, Builder and Guest,
 * each with exactly what it could do before ranks were the founder's to
 * make, and Builder for newcomers. The browser's `DEFAULT_RANKS` and
 * `NEWCOMER_RANK`. Nothing, for a settlement that has ranks already.
 */
create or replace function deed_ranks_seed(p_world uuid, p_founder uuid) returns void
  language sql as $fn$
  insert into deed_rank_def (world_id, founder, name, ord, perms, newcomer)
  select p_world, p_founder, r.name, r.ord, r.perms, r.newcomer
    from (values
      ('Mayor', 1, power_bits(array['shape', 'stores', 'gate', 'served', 'set_bauble', 'replace_bauble',
                                    'invite', 'send_away', 'set_ranks']), false),
      ('Builder', 2, power_bits(array['shape', 'stores', 'gate', 'served', 'set_bauble']), true),
      ('Guest', 3, power_bits(array['stores']), false)) r(name, ord, perms, newcomer)
   where not exists (select 1 from deed_rank_def x where x.world_id = p_world and x.founder = p_founder)
$fn$;

-- Every settlement standing now.
select deed_ranks_seed(d.world_id, d.founded_by) from deed d;

-- And every one founded from now on, however it is founded.
create or replace function deed_ranks_seeded() returns trigger language plpgsql as $fn$
begin
  perform deed_ranks_seed(new.world_id, new.founded_by);
  return null;
end $fn$;
drop trigger if exists deed_ranks_seeded on deed;
create trigger deed_ranks_seeded after insert on deed for each row execute function deed_ranks_seeded();

-- ---------------------------------------------------------------- the roll

alter table deed_member add column if not exists rank_id bigint;
alter table deed_member drop constraint if exists deed_member_role;
alter table deed_member alter column role drop default;
update deed_member m set rank_id = r.id
  from deed_rank_def r
 where m.rank_id is null and r.world_id = m.world_id and r.founder = m.founder and lower(r.name) = lower(m.role);
-- Anything the old constraint let through and no seeded rank is called: the newcomers' rank.
update deed_member m set rank_id = r.id
  from deed_rank_def r
 where m.rank_id is null and r.world_id = m.world_id and r.founder = m.founder and r.newcomer;
update deed_member m set role = lower(r.name) from deed_rank_def r where r.id = m.rank_id and m.role <> lower(r.name);
alter table deed_member alter column rank_id set not null;
alter table deed_member drop constraint if exists deed_member_rank;
-- Deferred, so disbanding -- which takes the ranks and the roll in one cascade -- is never caught half way.
alter table deed_member add constraint deed_member_rank foreign key (world_id, founder, rank_id)
  references deed_rank_def (world_id, founder, id) deferrable initially deferred;
create index if not exists deed_member_held on deed_member (rank_id);

/**
 * Which rank a row is on, and its name beside it.
 *
 * Without a rank, a newcomer: the settlement's rank for newcomers, or the
 * rank `role` names -- which is how a writer from before today said it. With
 * `role` changed and the rank not, the rank `role` names. Either way `role`
 * ends as the rank's name in lower case, which is what `deed_role` and a
 * browser from before today read.
 */
create or replace function deed_member_rank() returns trigger language plpgsql as $fn$
declare r deed_rank_def;
begin
  if new.rank_id is null or (tg_op = 'UPDATE' and new.rank_id = old.rank_id and new.role is distinct from old.role) then
    if new.role is null then
      select * into r from deed_rank_def d where d.world_id = new.world_id and d.founder = new.founder and d.newcomer;
    else
      select * into r from deed_rank_def d
       where d.world_id = new.world_id and d.founder = new.founder and lower(d.name) = lower(new.role);
    end if;
    if r.id is null then
      raise exception 'that settlement has no rank called %', coalesce(new.role, 'for newcomers');
    end if;
    new.rank_id := r.id;
  else
    select * into r from deed_rank_def d where d.id = new.rank_id;
  end if;
  new.role := lower(r.name);
  return new;
end $fn$;
drop trigger if exists deed_member_rank on deed_member;
create trigger deed_member_rank before insert or update of rank_id, role on deed_member
  for each row execute function deed_member_rank();

-- ---------------------------------------------------------------- the questions

/** Somebody's rank on a settlement, or nothing for its founder and for a stranger. */
create or replace function deed_rank_of(p_world uuid, p_founder uuid, p_uid uuid) returns deed_rank_def
  language sql stable as $fn$
  select r.* from deed_member m join deed_rank_def r on r.id = m.rank_id
   where m.world_id = p_world and m.founder = p_founder and m.uid = p_uid
$fn$;

/** Whether somebody may do this on a settlement: its founder always; a citizen when their rank holds it. */
create or replace function deed_may(p_world uuid, p_founder uuid, p_uid uuid, p_bit int) returns boolean
  language sql stable as $fn$
  select p_uid = p_founder
      or exists (select 1 from deed_member m join deed_rank_def r on r.id = m.rank_id
                  where m.world_id = p_world and m.founder = p_founder and m.uid = p_uid
                    and r.perms & p_bit <> 0)
$fn$;

/** Whether a settlement of theirs covers this tile and they may do this on it. */
create or replace function deed_may_at(p_world uuid, p_uid uuid, p_x int, p_y int, p_bit int) returns boolean
  language sql stable as $fn$
  select exists (select 1 from deeds_of(p_world, p_uid) d
                  where deed_covers(d, p_x, p_y) and deed_may(p_world, d.founded_by, p_uid, p_bit))
$fn$;

/**
 * What a rank lets you do, after "you may": every power it holds, in the
 * list's order. The browser's `rankMay`, word for word.
 */
create or replace function rank_may(p_perms int) returns text language sql stable as $fn$
  with held as (
    select p.may, row_number() over (order by p.bit) as n, count(*) over () as k
      from rank_power p where p_perms & (1 << p.bit) <> 0)
  select coalesce((select string_agg(case when n = 1 then '' when n = k then ' and ' else ', ' end || may, '' order by n)
                     from held), 'walk it and do nothing else there')
$fn$;

/**
 * Why a citizen's rank stops them doing this on a settlement, in the words
 * every such refusal says on both sides (the browser's `lacksSaid`); nothing
 * for its founder, for a stranger, and for a rank that holds it.
 */
create or replace function rank_lacks(p_world uuid, p_founder uuid, p_uid uuid, p_power text) returns text
  language sql stable as $fn$
  select 'Your rank at ' || d.name || ', ' || r.name || ', may not ' || p.may_not || '.'
    from deed d
    join deed_member m on m.world_id = d.world_id and m.founder = d.founded_by and m.uid = p_uid
    join deed_rank_def r on r.id = m.rank_id
    join rank_power p on p.id = p_power
   where d.world_id = p_world and d.founded_by = p_founder and r.perms & (1 << p.bit) = 0
$fn$;

/** The same, for the settlement of theirs that covers a tile. */
create or replace function rank_lacks_at(p_world uuid, p_uid uuid, p_x int, p_y int, p_power text) returns text
  language sql stable as $fn$
  select rank_lacks(p_world, d.founded_by, p_uid, p_power)
    from deeds_of(p_world, p_uid) d where deed_covers(d, p_x, p_y) limit 1
$fn$;

/**
 * Why somebody may not do this on a settlement as one of its people: not on
 * its roll at all, or on it at a rank that does not hold it. Nothing for its
 * founder.
 */
create or replace function rank_member_refusal(p_world uuid, p_founder uuid, p_uid uuid, p_power text) returns text
  language sql stable as $fn$
  select case
    when p_uid = p_founder then null
    when not exists (select 1 from deed_member m
                      where m.world_id = p_world and m.founder = p_founder and m.uid = p_uid)
      then 'You are not a citizen of ' || (select d.name from deed d where d.world_id = p_world and d.founded_by = p_founder) || '.'
    else rank_lacks(p_world, p_founder, p_uid, p_power) end
$fn$;

/**
 * Whether this body may shape the ground here, build on it, or pull down
 * what stands on it: a settlement of theirs covers the tile and they founded
 * it or their rank holds Shape and build.
 *
 * `on_my_deed` stays what it was -- whether a settlement of yours covers the
 * tile at all -- because that is the right question for entry, for the aura
 * and for where your own wildermon will work.
 */
create or replace function may_shape(p_world uuid, p_uid uuid, p_x int, p_y int)
returns boolean language sql stable as $fn$
  select deed_may_at(p_world, p_uid, p_x, p_y, power_bit('shape'))
$fn$;

/**
 * Whether a store is shut against this body.
 *
 * The key in their pack, or the ground under it: the founder of the
 * settlement it stands on has the master key, and so does every citizen
 * whose rank holds Open its locks. Nothing else opens it.
 */
create or replace function lock_shut(p_world uuid, p_uid uuid, p_lock bigint,
                                     p_x int, p_y int) returns boolean
language sql stable as $fn$
  select coalesce(p_lock, 0) <> 0
     and not exists (select 1 from item i
                      where i.world_id = p_world and i.holder = 'player'
                        and i.holder_uid = p_uid and i.def = 'key' and i.keyed = p_lock)
     and not deed_may_at(p_world, p_uid, p_x, p_y, power_bit('locks'))
$fn$;

/**
 * What a shut store says, in the browser's own words: on a settlement of
 * yours, what your rank lacks; anywhere else, that you have no key.
 */
create or replace function lock_refusal(p_world uuid, p_uid uuid, p_lock bigint,
                                        p_x int, p_y int) returns text
language sql stable as $fn$
  select case when lock_shut(p_world, p_uid, p_lock, p_x, p_y)
              then coalesce(rank_lacks_at(p_world, p_uid, p_x, p_y, 'locks'),
                            'It is locked, and you have no key to it.') end
$fn$;

/**
 * Whether a crate is yours to use: you made it, nobody did, or it stands on
 * a settlement of yours that you founded or whose rank of yours holds Crates
 * and stores.
 */
create or replace function crate_yours(p_world uuid, p_uid uuid, p_id int) returns boolean
  language sql stable as $fn$
  select coalesce(c.made_by = p_uid, true) or deed_may_at(p_world, p_uid, c.x, c.y, power_bit('stores'))
    from crate c where c.world_id = p_world and c.id = p_id
$fn$;

/**
 * Ground inside a settlement that is not yours to shape, in the browser's
 * order and words (`foreignGround`): each tile the job touches in turn -- a
 * corner's four, a tile's own, or the one underfoot -- and on the first that
 * refuses, your rank, on a settlement of yours whose rank does not hold Shape
 * and build, or whose it is, on anybody else's.
 */
CREATE OR REPLACE FUNCTION public.ground_deed_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $fn$
declare d action_def; v_name text; cx int; cy int; v record; v_why text; v_corner boolean := false;
begin
  if not shapes_ground(p_action) then return null; end if;
  select * into d from action_def where id = p_action;
  if p_target->>'kind' is distinct from 'tile' then
    select floor(p.x)::int, floor(p.y)::int into cx, cy from player p
      where p.world_id = p_world and p.uid = p_uid;
    if cx is null then return null; end if;
  elsif coalesce(d.corner, false) then
    cx := (p_target->>'cx')::int; cy := (p_target->>'cy')::int;
    v_corner := true;
  else
    cx := (p_target->>'x')::int; cy := (p_target->>'y')::int;
  end if;
  for v in
    -- A corner's four tiles in the browser's order; the last of them is the tile itself.
    select t.x, t.y from (values (cx - 1, cy - 1, 1), (cx, cy - 1, 2), (cx - 1, cy, 3), (cx, cy, 4)) t(x, y, n)
     where v_corner or t.n = 4 order by t.n
  loop
    if (deed_here(p_world, p_uid, v.x, v.y)).world_id is not null then
      v_why := rank_lacks_at(p_world, p_uid, v.x, v.y, 'shape');
      if v_why is not null then return v_why; end if;
      continue;
    end if;
    select dd.name into v_name from deed_covering(p_world, v.x, v.y) dd limit 1;
    if v_name is not null then
      return 'That ground is part of ' || v_name || '. Only its citizens may shape it.';
    end if;
  end loop;
  return null;
end $fn$;

/** The baubles working for this person where they stand: those of the settlement of theirs under their feet, while they founded it or their rank holds Bauble effects (`Game.baubleHere`). */
create or replace function bauble_here(p_world uuid, p_uid uuid) returns setof deed_bauble
  language plpgsql stable as $fn$
declare v_x int; v_y int; v_deed deed;
begin
  -- Most islands have none set anywhere, and this is asked on every go.
  if not exists (select 1 from deed_bauble b where b.world_id = p_world) then return; end if;
  select floor(p.x)::int, floor(p.y)::int into v_x, v_y from player p where p.world_id = p_world and p.uid = p_uid;
  if v_x is null then return; end if;
  v_deed := deed_here(p_world, p_uid, v_x, v_y);
  if v_deed.world_id is null or not deed_may(p_world, v_deed.founded_by, p_uid, power_bit('served')) then return; end if;
  return query select b.* from deed_bauble b where b.world_id = p_world and b.founder = v_deed.founded_by;
end $fn$;

/**
 * The roll of each settlement a rune gate stands on: its founder, and every
 * citizen whose rank holds Rune gate, for whom it lights.
 */
create or replace function rune_gate_folk(p_world uuid) returns jsonb language sql stable as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'x', d.x, 'y', d.y,
           'folk', (select jsonb_agg(f.uid order by f.uid)
                      from (select d.founded_by as uid
                            union
                            select m.uid from deed_member m join deed_rank_def r on r.id = m.rank_id
                             where m.world_id = p_world and m.founder = d.founded_by
                               and r.perms & power_bit('gate') <> 0) f))
         order by d.x, d.y), '[]'::jsonb)
    from deed d
   where d.world_id = p_world
     and exists (select 1 from wall w
                  where w.world_id = p_world and w.type = 'rune_gate' and w.level = 0
                    and (deed_covers(d, w.x, w.y)
                         or deed_covers(d, w.x - case when w.dir = 'v' then 1 else 0 end,
                                           w.y - case when w.dir = 'h' then 1 else 0 end)))
$fn$;

/**
 * The settlement a settlement job is aimed at: the one of yours whose token
 * stands on the tile picked, or your own when the tile is no token of yours.
 * The browser's `deedAimed`.
 */
create or replace function settlement_aimed(p_world uuid, p_uid uuid, p_target jsonb) returns deed
  language sql stable as $fn$
  select d.* from deeds_of(p_world, p_uid) d
   where coalesce(d.x = (p_target->>'x')::int and d.y = (p_target->>'y')::int, false) or d.founded_by = p_uid
   order by coalesce(d.x = (p_target->>'x')::int and d.y = (p_target->>'y')::int, false) desc
   limit 1
$fn$;

/* ---- bauble_setting: from 20260926184119_baubles.sql. Set and Replace baubles are powers of a rank. ---- */

create or replace function bauble_setting(p_world uuid, p_uid uuid, p_target jsonb,
  out o_why text, out o_founder uuid, out o_tier text, out o_slot int, out o_kind text, out o_key text,
  out o_amount double precision, out o_item item, out o_was deed_bauble)
  language plpgsql stable as $fn$
declare v_pc placed; v_deed deed; v_slots int; v_asked int; v_read record;
begin
  select * into v_pc from placed pl where pl.world_id = p_world and pl.id = (p_target->>'id')::bigint;
  if not found or not is_altar(v_pc) then o_why := 'That is not an altar.'; return; end if;
  if not near_piece(p_world, p_uid, v_pc, 2.4) then o_why := 'Stand at the altar.'; return; end if;
  v_deed := deed_here(p_world, p_uid, v_pc.x, v_pc.y);
  if v_deed.world_id is null then o_why := 'This altar does not stand on a settlement of yours.'; return; end if;
  -- What the rank holds there, in the browser's words (`lacks`).
  o_why := rank_lacks(p_world, v_deed.founded_by, p_uid, 'set_bauble');
  if o_why is not null then return; end if;
  select * into o_item from item i where i.world_id = p_world and i.id = target_item(p_target)
    and i.holder = 'player' and i.holder_uid = p_uid;
  if o_item.def = 'tarnished_bauble' then o_why := 'Restore it first: tarnished, it does nothing.'; return; end if;
  select * into v_read from bauble_read(o_item.def, o_item.extra);
  if o_item.id is null or v_read.kind is null then o_why := 'That is not a bauble you can set.'; return; end if;
  select t.id, t.slots into o_tier, v_slots from bauble_tier t where t.item = o_item.def;
  o_kind := v_read.kind; o_key := v_read.key; o_amount := v_read.amount; o_founder := v_deed.founded_by;
  if jsonb_typeof(p_target->'slot') = 'number' then
    if (p_target->>'slot')::numeric <> floor((p_target->>'slot')::numeric) then
      o_why := 'That is not a bauble you can set.'; return;
    end if;
    v_asked := (p_target->>'slot')::int;
    if v_asked < 0 or v_asked >= v_slots then o_why := 'That is not a bauble you can set.'; return; end if;
    select * into o_was from deed_bauble b where b.world_id = p_world and b.founder = v_deed.founded_by
      and b.tier = o_tier and b.slot = v_asked;
    if o_was.world_id is not null then
      o_why := rank_lacks(p_world, v_deed.founded_by, p_uid, 'replace_bauble');
      if o_why is not null then return; end if;
    end if;
    o_slot := v_asked;
    return;
  end if;
  select min(s.n) into o_slot from generate_series(0, v_slots - 1) s(n)
   where not exists (select 1 from deed_bauble b where b.world_id = p_world and b.founder = v_deed.founded_by
                       and b.tier = o_tier and b.slot = s.n);
  if o_slot is null then
    o_why := 'All ' || v_slots || ' ' || o_tier || ' sockets are filled. Choose one to replace.';
  end if;
end $fn$;

/* ---- crate_refusal: from 20261002123916_piers_and_stilts.sql. A crate somebody else made, on a settlement of yours whose rank lacks Crates and stores, says so. ---- */

CREATE OR REPLACE FUNCTION public.crate_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare v_p player; v_it item; v_c crate; v_pl placed;
        v_tx int; v_ty int; v_sx int; v_sy int; v_want int;
begin
  select * into v_p from player where world_id = p_world and uid = p_uid;

  if p_action = 'place_crate' then
    v_tx := (p_target->>'x')::int; v_ty := (p_target->>'y')::int;
    v_sx := (p_target->>'sx')::int; v_sy := (p_target->>'sy')::int;
    if v_tx is null or v_sx is null or v_sy is null or target_item(p_target) is null then
      return 'Choose a crate and a spot.';
    end if;
    select * into v_it from item where id = target_item(p_target)
      and world_id = p_world and holder = 'player' and holder_uid = p_uid;
    if not found or crate_kind_of_item(v_it.def) is null then return 'That is not a crate.'; end if;
    /*
     * A rack's deck is a crate spot, and the ground under it is the rack's
     * business rather than the crate's: whoever set the rack there already
     * answered for the footing. So the ground rules are asked on bare earth
     * and skipped on a deck, which is the only difference between the two — a
     * crate on a rack is an ordinary crate at an ordinary subtile, with its own
     * contents, its own name and its own deed flag.
     */
    if (rack_at(p_world, v_tx, v_ty, v_sx, v_sy)).id is null then
      -- Piers: a finished deck is dry, level floor whatever is under it, and one not built yet nothing to stand on.
      if on_piers(p_world, v_tx, v_ty) then
        if deck_surface(p_world, v_tx, v_ty) is null then return 'Crates need dry, open ground.'; end if;
      elsif not passable(p_world, v_tx, v_ty) or has_water(p_world, v_tx, v_ty) then
        return 'Crates need dry, open ground.';
      elsif tile_slope(p_world, v_tx, v_ty) > 20 then return 'The ground is too steep for a crate to stand.';
      end if;
    elsif crate_kind_of_item(v_it.def) <> 'plank' then
      return 'A ' || lower((select name from item_def where id = v_it.def))
        || ' will not sit on the runners. The rack takes plank crates.';
    end if;
    if (crate_at(p_world, v_tx, v_ty, v_sx, v_sy)).id is not null then return 'There is already a crate on that spot.'; end if;
    if is_token(p_world, v_tx, v_ty) then return 'Not on the token.'; end if;
    return null;

  elsif p_action in ('pick_up_crate', 'crate_take_all') then
    v_c := target_crate(p_world, p_target);
    if v_c.id is null then return 'It is gone.'; end if;
    if not crate_yours(p_world, p_uid, v_c.id) then
      return coalesce(rank_lacks_at(p_world, p_uid, v_c.x, v_c.y, 'stores'),
                      'The ' || lower(crate_name(v_c)) || ' is not yours.');
    end if;
    if sqrt((crate_centre_x(v_c) - v_p.x) ^ 2 + (crate_centre_y(v_c) - v_p.y) ^ 2) > 2.4 then
      return 'Stand next to the crate.';
    end if;
    -- A crate with a padlock on it opens for its key and for the founder of
    -- the settlement it stands on, and for nobody else. Picking it up is
    -- shut the same way: a locked thing you could simply carry off is not
    -- locked at all.
    if lock_shut(p_world, p_uid, v_c.lock, v_c.x, v_c.y) then
      return lock_refusal(p_world, p_uid, v_c.lock, v_c.x, v_c.y);
    end if;
    if p_action = 'pick_up_crate' then
      return case when crate_units(p_world, v_c.id) > 0 then 'Empty it first.' end;
    end if;
    return case when crate_units(p_world, v_c.id) = 0 then 'The crate is empty.' end;

  elsif p_action = 'store_in_crate' then
    -- The crate the ask names, when it names one you can reach; the nearest
    -- when it names none, which is what an item's own menu means by it.
    v_c := named_crate(p_world, v_p.x, v_p.y, p_target);
    if v_c.id is null then v_c := nearest_crate(p_world, v_p.x, v_p.y); end if;
    if v_c.id is null then return 'Stand next to a crate.'; end if;
    -- Putting your things into somebody else's crate is a way of losing them.
    if not crate_yours(p_world, p_uid, v_c.id) then
      return coalesce(rank_lacks_at(p_world, p_uid, v_c.x, v_c.y, 'stores'),
                      'The ' || lower(crate_name(v_c)) || ' is not yours to put anything in.');
    end if;
    if lock_shut(p_world, p_uid, v_c.lock, v_c.x, v_c.y) then
      return lock_refusal(p_world, p_uid, v_c.lock, v_c.x, v_c.y);
    end if;
    select * into v_it from item where id = target_item(p_target)
      and world_id = p_world and holder = 'player' and holder_uid = p_uid;
    if not found then return 'It is gone.'; end if;
    if crate_kind_of_item(v_it.def) is not null then return 'A crate does not go in a crate.'; end if;
    v_want := greatest(1, least(v_it.count, coalesce((p_target->>'count')::int, 1)));
    /*
     * Room for some of it is enough.
     *
     * Asked for: "when trying to put 48 items in a container that has room for
     * 13, deposit 13 and reject the 35." It was all or nothing, so an armful
     * of ore and a nearly full crate meant counting the difference yourself
     * and splitting the stack by hand. A thing that stacks goes in as far as
     * there is room; a thing that does not is one row and goes in whole or not
     * at all, which is what it always was.
     */
    if crate_spare(p_world, v_c)
       < (case when coalesce((select stackable from item_def where id = v_it.def), false)
               then 1 else v_want end) then
      return 'The ' || lower(crate_name(v_c)) || ' is full.';
    end if;
    return null;

  elsif p_action = 'take_from_store' then
    /*
     * Taking one thing out, which the island could not do until now.
     *
     * There has been a way to put a thing in and a way to take *everything*
     * out, and nothing in between — so the browser did the in-between itself,
     * moving the row from one window to the other in its own copy and never
     * telling anybody. On an island the next answer put it back, which is what
     * "it rubber bands from crate to inventory" was.
     */
    select * into v_it from item where id = target_item(p_target) and world_id = p_world;
    if not found or v_it.holder not in ('crate', 'furniture', 'bag') then return 'It is gone.'; end if;
    -- A bag is worn rather than stood next to, so there is nothing to walk to
    -- and the only question is whether it is on you.
    if v_it.holder = 'bag' then
      if (carried(p_world, p_uid, v_it.id)).id is null then return 'It is gone.'; end if;
      return null;
    end if;
    if v_it.holder = 'crate' then
      select * into v_c from crate where world_id = p_world and id = v_it.crate;
      if not found then return 'It is gone.'; end if;
      if sqrt((crate_centre_x(v_c) - v_p.x) ^ 2 + (crate_centre_y(v_c) - v_p.y) ^ 2) > 2.4 then
        return 'Stand next to the crate.';
      end if;
      if not crate_yours(p_world, p_uid, v_c.id) then
        return 'The ' || lower(crate_name(v_c)) || ' is not yours.';
      end if;
    else
      select * into v_pl from placed where id = v_it.placed and world_id = p_world;
      if not found then return 'It is gone.'; end if;
      if greatest(abs(v_pl.cx - v_p.x), abs(v_pl.cy - v_p.y)) > 2.4 then
        return 'Stand next to the ' || lower(placed_name(v_pl)) || '.';
      end if;
      if v_pl.kind = 'furniture' and coalesce((select stall from furniture_def where id = v_pl.sub), false)
         and v_pl.made_by is distinct from p_uid then
        return 'That is on somebody else''s stall. Buy it at the counter.';
      end if;
    end if;
    return null;
  end if;
  return null;
end $function$;

/* ---- craft_stock: from 20261002152542_cellars.sql. A piece on a settlement of yours is drawn on when your rank holds Crates and stores. ---- */

CREATE OR REPLACE FUNCTION public.craft_stock(p_world uuid, p_uid uuid, p_chosen bigint DEFAULT NULL::bigint)
 RETURNS TABLE(id bigint, def text, count integer, extra text, ql real, carried boolean, draw bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with me as (
    select p.x, p.y, floor(p.x)::int as tx, floor(p.y)::int as ty,
           coalesce(p.craft_from_stores, true) as stores,
           coalesce(p.craft_spare_rare, false) as spare,
           -- Asked once: three tiles, or further for a Smith's Forge Reach at the smelter or the anvil.
           craft_reach() as r
      from player p where p.world_id = p_world and p.uid = p_uid
  ),
  crates as materialized (
    select c.id, sqrt((crate_centre_x(c) - me.x) ^ 2 + (crate_centre_y(c) - me.y) ^ 2) as d
      from crate c, me
     where me.stores and c.world_id = p_world
       and c.x between me.tx - me.r and me.tx + me.r
       and c.y between me.ty - me.r and me.ty + me.r
       and crate_yours(p_world, p_uid, c.id)
       and same_floor(c.level, c.world_id, c.x, c.y) -- cellar
       and not lock_shut(p_world, p_uid, c.lock, c.x, c.y)
  ),
  pieces as materialized (
    select pl.id, sqrt((pl.cx - me.x) ^ 2 + (pl.cy - me.y) ^ 2) as d
      from placed pl join furniture_def f on f.id = pl.sub, me
     where me.stores and pl.world_id = p_world and pl.kind = 'furniture'
       and pl.x between me.tx - me.r and me.tx + me.r
       and pl.y between me.ty - me.r and me.ty + me.r
       and furniture_holds(pl)
       and same_floor(pl.level, pl.world_id, pl.x, pl.y) -- cellar
       and coalesce(f.trash, 0) = 0 and not f.stall
       -- Yours, or on a settlement of yours -- or a cart, a wagon or a boat,
       -- which is anybody's to load and to empty, and so anybody's to use.
       and (pl.made_by = p_uid or deed_may_at(p_world, p_uid, pl.x, pl.y, power_bit('stores')) or f.cart or is_driveable(pl))
       and not lock_shut(p_world, p_uid, pl.lock, pl.x, pl.y)
  ),
  stock as (
    -- Loose in your hands.
    select i.id, i.def, i.count, i.extra, i.ql, i.rare, true as carried,
           0 as rank, 0::double precision as d, 0 as kind, 0::bigint as store
      from item i
     where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
       and not i.locked and i.deal is null
    union all
    -- In a bag you are carrying: `carried`, the lookup `in_the_bag` made.
    select i.id, i.def, i.count, i.extra, i.ql, i.rare, true, 1, 0, 0, b.id
      from item b join item i on i.inside = b.id and i.holder = 'bag'
     where b.world_id = p_world and b.holder = 'player' and b.holder_uid = p_uid
       and not i.locked and i.deal is null
    union all
    select i.id, i.def, i.count, i.extra, i.ql, i.rare, false, 2, c.d, 0, c.id::bigint
      from crates c join item i on i.world_id = p_world and i.holder = 'crate' and i.crate = c.id
     where not i.locked and i.deal is null and i.price is null and i.letter is null
    union all
    select i.id, i.def, i.count, i.extra, i.ql, i.rare, false, 2, pc.d, 1, pc.id
      from pieces pc join item i on i.world_id = p_world and i.holder = 'furniture' and i.placed = pc.id
     where not i.locked and i.deal is null and i.price is null and i.letter is null
  )
  select s.id, s.def, s.count, s.extra, s.ql, s.carried,
         row_number() over (order by s.rank, s.d, s.kind, s.store, s.id)
    from stock s
   where coalesce(s.rare, '') = ''
      or s.id is not distinct from p_chosen
      or not coalesce((select m.spare from me m), false)
$function$;

/* ---- hod_stock: from 20261002152542_cellars.sql. The same rule as `craft_stock`. ---- */

CREATE OR REPLACE FUNCTION public.hod_stock(p_world uuid, p_uid uuid, p_item text, p_reach double precision)
 RETURNS TABLE(id bigint, count integer, draw bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with me as (
    select p.x, p.y, floor(p.x)::int as tx, floor(p.y)::int as ty, ceil(p_reach)::int as r
      from player p where p.world_id = p_world and p.uid = p_uid and p_reach > 0
  ),
  crates as materialized (
    select c.id, sqrt((crate_centre_x(c) - me.x) ^ 2 + (crate_centre_y(c) - me.y) ^ 2) as d
      from crate c, me
     where c.world_id = p_world
       and c.x between me.tx - me.r and me.tx + me.r
       and c.y between me.ty - me.r and me.ty + me.r
       and crate_yours(p_world, p_uid, c.id)
       and same_floor(c.level, c.world_id, c.x, c.y) -- cellar
       and not lock_shut(p_world, p_uid, c.lock, c.x, c.y)
  ),
  pieces as materialized (
    select pl.id, sqrt((pl.cx - me.x) ^ 2 + (pl.cy - me.y) ^ 2) as d
      from placed pl join furniture_def f on f.id = pl.sub, me
     where pl.world_id = p_world and pl.kind = 'furniture'
       and pl.x between me.tx - me.r and me.tx + me.r
       and pl.y between me.ty - me.r and me.ty + me.r
       and furniture_holds(pl)
       and same_floor(pl.level, pl.world_id, pl.x, pl.y) -- cellar
       and coalesce(f.trash, 0) = 0 and not f.stall
       and (pl.made_by = p_uid or deed_may_at(p_world, p_uid, pl.x, pl.y, power_bit('stores')) or f.cart or is_driveable(pl))
       and not lock_shut(p_world, p_uid, pl.lock, pl.x, pl.y)
  ),
  stock as (
    select i.id, i.count, c.d, 0 as kind, c.id::bigint as store
      from crates c join item i on i.world_id = p_world and i.holder = 'crate' and i.crate = c.id
     where i.def = p_item and i.count > 0 and not i.locked and i.deal is null and i.price is null and i.letter is null
    union all
    select i.id, i.count, pc.d, 1, pc.id
      from pieces pc join item i on i.world_id = p_world and i.holder = 'furniture' and i.placed = pc.id
     where i.def = p_item and i.count > 0 and not i.locked and i.deal is null and i.price is null and i.letter is null
  )
  select s.id, s.count, row_number() over (order by s.d, s.kind, s.store, s.id) from stock s
$function$;

/* ---- dye_barrels: from 20261010145016_dye_by_weight_and_volume.sql. The same rule as `craft_stock`. ---- */

create or replace function dye_barrels(p_world uuid, p_uid uuid) returns setof placed language sql stable as $$
  with me as (
    select floor(p.x)::int as tx, floor(p.y)::int as ty, coalesce(p.craft_from_stores, true) as stores, craft_reach() as r
      from player p where p.world_id = p_world and p.uid = p_uid
  )
  select pl.* from placed pl, me
   where me.stores and pl.world_id = p_world and pl.kind = 'furniture'
     and pl.x between me.tx - me.r and me.tx + me.r
     and pl.y between me.ty - me.r and me.ty + me.r
     and holds_liquid(pl) and not is_well(pl)
     and placed_dye(pl) is not null and floor(placed_litres(pl)) >= 1
     and same_floor(pl.level, pl.world_id, pl.x, pl.y)
     and (pl.made_by = p_uid or deed_may_at(p_world, p_uid, pl.x, pl.y, power_bit('stores')))
     and not lock_shut(p_world, p_uid, pl.lock, pl.x, pl.y)
   order by pl.id
$$;

/* ---- aqueduct_plan: from 20261002164340_jetties_railings_and_columns.sql. On a settlement of yours, a rank without Shape and build is named, in the browser's words; anybody else's is still whose it is. ---- */

create or replace function aqueduct_plan(p_world uuid, p_uid uuid, p_sx int, p_sy int, p_tx int, p_ty int)
  returns jsonb language plpgsql stable as $fn$
declare v_rank text; n int; v_name text; v_head text; v_top int; v_foot text; v_level int; hs foundation; fs foundation;
        v_c int[]; v_r jsonb; r record; e record; ob bridge;
begin
  if not in_bounds(p_world, p_sx, p_sy) or not in_bounds(p_world, p_tx, p_ty) then
    return jsonb_build_object('refused', 'Not there.');
  end if;
  if (p_sx <> p_tx and p_sy <> p_ty) or (p_sx = p_tx and p_sy = p_ty) then
    return jsonb_build_object('refused', 'An aqueduct runs straight: its head due north, south, east or west of the tile it pours into.');
  end if;
  select count(*)::int into n from span_tiles(p_sx, p_sy, p_tx, p_ty);
  if n = 0 then
    return jsonb_build_object('refused', 'That water is right beside it: there is nothing for an aqueduct to carry it over.');
  end if;
  if n > (select d.span from bridge_def d where d.id = 'aqueduct') then
    return jsonb_build_object('refused', 'An aqueduct spans ' || (select d.span from bridge_def d where d.id = 'aqueduct')
      || ' tiles; that is ' || n || '.');
  end if;
  for e in select * from (values (1, p_sx, p_sy), (2, p_tx, p_ty)) v(o, x, y) order by o loop
    select dd.name, rank_lacks(p_world, dd.founded_by, p_uid, 'shape') into v_name, v_rank
      from deed_covering(p_world, e.x, e.y) dd where not may_shape(p_world, p_uid, e.x, e.y) limit 1;
    if v_name is not null then
      return jsonb_build_object('refused', coalesce(v_rank,
        'That is part of ' || v_name || '. Only its builders may lead water from it or to it.'));
    end if;
  end loop;
  -- The head: a pool, or a spring's pond.
  hs := slab_at(p_world, p_sx, p_sy);
  if hs.id is not null and hs.pool then
    v_head := 'pool'; v_top := hs.top - pool_lip();
  elsif exists (select 1 from spring_tile t where t.world_id = p_world and t.x = p_sx and t.y = p_sy) then
    v_head := 'pond';
    select max(t.level) into v_top from spring_tile t where t.world_id = p_world and t.x = p_sx and t.y = p_sy;
  elsif least(land_height(p_world, p_sx, p_sy), land_height(p_world, p_sx + 1, p_sy),
              land_height(p_world, p_sx + 1, p_sy + 1), land_height(p_world, p_sx, p_sy + 1)) < 0 then
    return jsonb_build_object('refused', 'The sea is below everything: an aqueduct carries a spring''s water, from a pond or a pool.');
  else
    return jsonb_build_object('refused', 'There is no pond or pool there for an aqueduct to draw from.');
  end if;
  -- The foot: a pool, a fountain, a pond, or a hollow that would hold one.
  fs := slab_at(p_world, p_tx, p_ty);
  if fs.id is not null and not fs.pool then
    return jsonb_build_object('refused', 'Dig a pool in the foundation first: the water would run straight off its top.');
  end if;
  if fs.id is not null then
    v_foot := 'pool'; v_level := fs.top - pool_lip();
  elsif exists (select 1 from placed q where q.world_id = p_world and q.kind = 'furniture' and q.sub = 'fountain'
                  and q.x = p_tx and q.y = p_ty) then
    -- To the nearest unit, as a pond's and a pool's water stand.
    v_foot := 'fountain'; v_level := floor(surface_height(p_world, p_tx, p_ty) + fountain_rim() + 0.5)::int;
  elsif exists (select 1 from spring_tile t where t.world_id = p_world and t.x = p_tx and t.y = p_ty) then
    v_foot := 'pond';
    select max(t.level) into v_level from spring_tile t where t.world_id = p_world and t.x = p_tx and t.y = p_ty;
  elsif least(land_height(p_world, p_tx, p_ty), land_height(p_world, p_tx + 1, p_ty),
              land_height(p_world, p_tx + 1, p_ty + 1), land_height(p_world, p_tx, p_ty + 1)) < 0 then
    return jsonb_build_object('refused', 'An aqueduct pours into a pool, a pond, a fountain or a hollow, not the sea.');
  else
    v_c := spring_corner(p_world, p_tx, p_ty);
    v_r := settle_chain(p_world, v_c[1], v_c[2]);
    if v_r->>'refused' = 'wide' then
      return jsonb_build_object('refused', 'That hollow is too wide ever to fill: a pond spreads over ' || pond_most() || ' corners at most.');
    end if;
    if v_r ? 'refused' then
      return jsonb_build_object('refused', 'Water poured here would run straight off downhill: the foot of an aqueduct wants a pool, a pond, a fountain, or a hollow that holds '
        || to_char(spring_depth() / 10.0, 'FM990.0') || ' m of water or more.');
    end if;
    v_foot := 'hollow'; v_level := (v_r->'ponds'->0->>'level')::int;
  end if;
  -- Not the water it draws from: one pool, or one pond, under both ends.
  if v_head = 'pool' and v_foot = 'pool' then
    v_c := spring_corner(p_world, p_sx, p_sy);
    v_r := settle_chain(p_world, v_c[1], v_c[2], p_sx, p_sy);
    if not (v_r ? 'refused') and pond_covers(v_r->'ponds'->0, p_tx, p_ty) then
      return jsonb_build_object('refused', 'That is the water it would draw from.');
    end if;
  end if;
  if v_head = 'pond' and v_foot = 'pond'
     and exists (select 1 from spring_tile a join spring_tile b on b.world_id = a.world_id and b.spring_id = a.spring_id and b.pond = a.pond
                  where a.world_id = p_world and a.x = p_sx and a.y = p_sy and b.x = p_tx and b.y = p_ty) then
    return jsonb_build_object('refused', 'That is the water it would draw from.');
  end if;
  -- Not the line of one there already.
  if exists (select 1 from bridge b where b.world_id = p_world and b.kind = 'aqueduct'
              and b.ax = p_sx and b.ay = p_sy and b.bx = p_tx and b.by = p_ty) then
    return jsonb_build_object('refused', 'An aqueduct already runs from there to here.');
  end if;
  -- Not water another aqueduct draws from already: the first of them takes all of it.
  select b.* into ob from bridge b where b.world_id = p_world and b.id = aqueduct_draws(p_world, p_sx, p_sy, v_head);
  if ob.id is not null then
    return jsonb_build_object('refused', 'The aqueduct from ' || ob.ax || ', ' || ob.ay || ' draws from that water already.');
  end if;
  if v_level > v_top then
    return jsonb_build_object('refused', 'The water there stands at ' || v_level || ', over the ' || v_top
      || ' its head stands at: water only runs downhill.');
  end if;
  if bridge_at(p_world, p_sx, p_sy) is not null or bridge_at(p_world, p_tx, p_ty) is not null then
    return jsonb_build_object('refused', 'A bridge is carried over one end of it already.');
  end if;
  for r in select * from span_tiles(p_sx, p_sy, p_tx, p_ty) order by n loop
    if bridge_at(p_world, r.x, r.y) is not null then return jsonb_build_object('refused', 'Something is already bridged across there.'); end if;
    if building_at(p_world, r.x, r.y) is not null then return jsonb_build_object('refused', 'Not over a building.'); end if;
    -- Frame: nor through a building's jetty, as a bridge is not (`frame_jetty_of`).
    if frame_jetty_of(p_world, r.x, r.y) is not null then return jsonb_build_object('refused', 'Not over a building''s jetty.'); end if;
    if land_tile(p_world, r.x, r.y) in (tile_id('Tree'), tile_id('Bush')) then
      return jsonb_build_object('refused', 'A ' || case when land_tile(p_world, r.x, r.y) = tile_id('Tree') then 'tree' else 'bush' end
        || ' stands at ' || r.x || ', ' || r.y || ', under where a span would go. Cut it down first.');
    end if;
    if v_top - channel_deep() - surface_height(p_world, r.x, r.y) < clearance() then
      fs := slab_at(p_world, r.x, r.y);
      return jsonb_build_object('refused', case when fs.id is null then 'The ground' when fs.pool then 'The water in the pool' else 'The foundation' end
        || ' at ' || r.x || ', ' || r.y || ' stands within '
        || to_char(clearance() / 10.0, 'FM990.0') || ' m of the channel''s bed: an aqueduct is carried over '
        || case when fs.id is null then 'the ground' when fs.pool then 'the water' else 'a foundation' end || ', not through it.');
    end if;
  end loop;
  return jsonb_build_object('height', v_top, 'head', v_head, 'foot', v_foot, 'level', v_level);
end $fn$;

/* ---- aqueduct_refusal: from 20261002180114_portcullis_drawbridge_and_hidden_doors.sql. On a settlement of yours, a rank without Shape and build is named, in the browser's words; anybody else's is still whose it is. ---- */

CREATE OR REPLACE FUNCTION public.aqueduct_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare v_rank text; p player; b bridge; s bridge_span; v_short text;
begin
  select * into p from player where world_id = p_world and uid = p_uid;
  if p_action = 'plan_bridge' then
    return 'An aqueduct is set out from the pool, pond, fountain or hollow it pours into, not thrown from a bank.';
  end if;
  if p_action = 'plan_aqueduct' then
    if p_target->>'kind' is distinct from 'tile' then return 'Choose where it pours.'; end if;
    if jsonb_typeof(p_target->'head') is distinct from 'array' then return 'Choose the water it draws from.'; end if;
    if not in_reach(p.x, p.y, p_target, false, (select d.range from action_def d where d.id = 'plan_aqueduct')) then
      return 'You are too far away from that.';
    end if;
    return aqueduct_plan(p_world, p_uid, (p_target->'head'->>0)::int, (p_target->'head'->>1)::int,
                         (p_target->>'x')::int, (p_target->>'y')::int)->>'refused';
  end if;
  select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint and kind = 'aqueduct';
  if not found then return 'It is gone.'; end if;
  if p_action in ('build_aqueduct', 'build_bridge') then
    select * into s from bridge_span sp where sp.world_id = p_world and sp.bridge = b.id
      and not span_done(sp.needed) order by sp.n limit 1;
    if not found then return 'It is finished.'; end if;
    if tool_ql(p_world, p_uid, 'trowel') <= 0 then
      return 'You need a ' || lower((select coalesce(name, 'trowel') from item_def where id = 'trowel')) || '.';
    end if;
    if sqrt((s.x + 0.5 - p.x) ^ 2 + (s.y + 0.5 - p.y) ^ 2) > 4.5 then
      return 'Work from one end. Walk to the open part of the span.';
    end if;
    select e.key into v_short from jsonb_each(s.needed) e
      where (e.value)::int > 0 and pack_count(p_world, p_uid, e.key) < 1 order by e.key limit 1;
    if v_short is not null then
      return 'That span wants ' || span_wants(s.needed) || '; you are carrying no '
        || lower((select coalesce(name, v_short) from item_def where id = v_short)) || '.';
    end if;
    return null;
  end if;
  -- gates: pulled down from as near either end as a bridge is (`bridge_pull_reach`), and on a settlement only by its
  -- builders, as a bridge is (`last_refusal`, `pullDownRefusal`), named by the job's own label.
  if sqrt((b.ax + 0.5 - p.x) ^ 2 + (b.ay + 0.5 - p.y) ^ 2) > bridge_pull_reach()
     and sqrt((b.bx + 0.5 - p.x) ^ 2 + (b."by" + 0.5 - p.y) ^ 2) > bridge_pull_reach() then
    return 'Stand at one end of it.';
  end if;
  select dd.name, rank_lacks(p_world, dd.founded_by, p_uid, 'shape') into v_short, v_rank
    from (values (1, b.ax, b.ay), (2, b.bx, b."by")) v(o, x, y)
    cross join lateral deed_covering(p_world, v.x, v.y) dd
   where not may_shape(p_world, p_uid, v.x, v.y)
   order by v.o, dd.founded_at limit 1;
  if v_short is not null then
    return coalesce(v_rank, 'That is part of ' || v_short || '. Only its builders may '
        || lower((select a.label from action_def a where a.id = p_action)) || ' there.');
  end if;
  return null;
end $function$;

/* ---- green_refusal: from 20261002135108_aqueducts.sql. On a settlement of yours, a rank without Shape and build is named, in the browser's words; anybody else's is still whose it is. ---- */

CREATE OR REPLACE FUNCTION public.green_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare v_rank text; p player; d action_def; v_from timestamptz; tx int; ty int; v_days int := 0; v_found boolean := false;
        v_side text; pc placed; br bridge; v_name text;
begin
  select * into p from player where world_id = p_world and uid = p_uid;
  select * into d from action_def where id = p_action;
  select w.green_from into v_from from world w where w.id = p_world;
  if p_action = 'clear_ivy' then
    v_side := p_target->>'side';
    if p_target->>'kind' is distinct from 'tile' or v_side is null then return 'Choose a side.'; end if;
    tx := (p_target->>'x')::int; ty := (p_target->>'y')::int;
    -- Every storey's wall on that border: a house is cleared a side at a time, top to bottom.
    select coalesce(max(green_days(green_start(g.since, v_from))), 0), count(*) > 0 into v_days, v_found
      from border_of(tx, ty, v_side) bo
      join wall wl on wl.world_id = p_world and wl.dir = bo.dir and wl.x = bo.x and wl.y = bo.y
      join build_material_def m on m.id = wl.material and m.kind = 'stone'
      left join green_since g on g.world_id = p_world and g.thing = 'wall' and g.x = wl.x and g.y = wl.y
                             and g.k = green_wall_k(wl.level, wl.dir)
     where bill_done(wl.needed);
    if not v_found then return 'There is no finished wall of stone or brick there.'; end if;
  elsif p_target->>'kind' = 'tile' then
    tx := (p_target->>'x')::int; ty := (p_target->>'y')::int;
    if coalesce((select td.paved from tile_def td where td.id = land_tile(p_world, tx, ty)), false) then
      v_found := true;
      v_days := green_days(green_start((select g.since from green_since g where g.world_id = p_world
                  and g.thing = 'paving' and g.x = tx and g.y = ty and g.k = 0), v_from));
    end if;
    if (slab_at(p_world, tx, ty)).id is not null then
      v_found := true;
      v_days := greatest(v_days, green_days(green_start((select g.since from green_since g where g.world_id = p_world
                  and g.thing = 'slab' and g.x = tx and g.y = ty and g.k = 0), v_from)));
    end if;
    if not v_found then return 'There is no paving or poured foundation here.'; end if;
  elsif p_target->>'kind' = 'furniture' then
    pc := target_placed(p_world, p_target);
    if pc.id is null or pc.kind is distinct from 'furniture'
       or not coalesce((select f.mossy from furniture_def f where f.id = pc.sub), false) then
      return 'No moss grows on that.';
    end if;
    tx := pc.x; ty := pc.y;
    v_days := green_days(green_start(greatest(pc.made_at, (select g.since from green_since g where g.world_id = p_world
                and g.thing = 'piece' and g.x = pc.x and g.y = pc.y and g.k = pc.id)), v_from));
  elsif p_target->>'kind' = 'bridge' then
    select * into br from bridge b where b.world_id = p_world and b.id = (p_target->>'id')::bigint;
    if br.id is null or br.kind not in ('stone', 'aqueduct')
       or exists (select 1 from bridge_span s where s.world_id = p_world and s.bridge = br.id and not span_done(s.needed)) then
      return 'No moss grows on that.';
    end if;
    tx := br.ax; ty := br.ay;
    v_days := green_days(green_start((select g.since from green_since g where g.world_id = p_world
                and g.thing = 'bridge' and g.x = br.ax and g.y = br.ay and g.k = br.id), v_from));
  else
    return 'No moss grows on that.';
  end if;
  if not in_reach(p.x, p.y, jsonb_build_object('x', tx, 'y', ty), false, d.range) then
    return 'You are too far away from that.';
  end if;
  if tool_ql(p_world, p_uid, d.tool) <= 0 then
    return 'You need a ' || lower((select coalesce(i.name, d.tool) from item_def i where i.id = d.tool))
        || ' to ' || lower(d.label) || '.';
  end if;
  -- Somebody else's garden is not yours to strip, and a guest of yours is a guest (`may_shape`).
  select dd.name, rank_lacks(p_world, dd.founded_by, p_uid, 'shape') into v_name, v_rank from deed_covering(p_world, tx, ty) dd
   where not may_shape(p_world, p_uid, tx, ty) order by dd.founded_at limit 1;
  if v_name is not null then
    return coalesce(v_rank, 'That is part of ' || v_name || '. Only its builders may ' || lower(d.label) || ' there.');
  end if;
  if v_days <= 0 then return green_nothing_yet(); end if;
  return null;
end $function$;

/* ---- last_refusal: from 20261011060546_memorial_stones.sql. On a settlement of yours, a rank without Shape and build is named, in the browser's words; anybody else's is still whose it is. ---- */

CREATE OR REPLACE FUNCTION public.last_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare v_rank text; p player; pc placed; b bridge; d bridge_def; s bridge_span; c creature; mate creature;
        it item; dye item; bd brew_def; v_kind text; v_short text;
begin
  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action = 'set_bauble' then
    return bauble_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = 'sacrifice' then
    return sacrifice_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = 'absorb_mote' then
    return absorb_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = enchant_action() then
    return enchant_refusal(p_world, p_uid, p_target);
  end if;
  if memorial_action(p_action) then
    return memorial_refusal(p_world, p_uid, p_action, p_target);
  end if;

  if p_action = 'plan_bridge' then
    v_kind := coalesce(p_target->>'material', 'rope');
    return bridge_reason(p_world, p_uid, v_kind, floor(p.x)::int, floor(p.y)::int,
      (p_target->>'x')::int, (p_target->>'y')::int);

  elsif p_action in ('build_bridge', 'demolish_bridge') then
    select * into b from bridge where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return 'It is gone.'; end if;
    select * into d from bridge_def where id = b.kind;
    if p_action = 'build_bridge' then
      select * into s from bridge_span sp where sp.world_id = p_world and sp.bridge = b.id
        and not span_done(sp.needed) order by sp.n limit 1;
      if not found then return 'It is finished.'; end if;
      if tool_ql(p_world, p_uid, d.tool) <= 0 then
        return 'You need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || '.';
      end if;
      if sqrt((s.x + 0.5 - p.x) ^ 2 + (s.y + 0.5 - p.y) ^ 2) > 4.5 then
        return 'Work from one end. Walk to the open part of the span.';
      end if;
      select e.key into v_short from jsonb_each(s.needed) e
        where (e.value)::int > 0 and pack_count(p_world, p_uid, e.key) < 1 order by e.key limit 1;
      if v_short is not null then
        return 'That span wants ' || span_wants(s.needed) || '; you are carrying no '
          || lower((select coalesce(name, v_short) from item_def where id = v_short)) || '.';
      end if;
    else
      -- gates: the far end's row, quoted: a record's field named by a reserved word is not found unquoted, so
      -- this refused nothing and raised "record b has no field by" instead, and nobody could pull a bridge down;
      -- and the reach, written once (`bridge_pull_reach`, `PULL_REACH`).
      if sqrt((b.ax + 0.5 - p.x) ^ 2 + (b.ay + 0.5 - p.y) ^ 2) > bridge_pull_reach()
         and sqrt((b.bx + 0.5 - p.x) ^ 2 + (b."by" + 0.5 - p.y) ^ 2) > bridge_pull_reach() then
        return 'Stand at one end of it.';
      end if;
      -- gates: where either end stands on a settlement, only its builders pull a bridge down, as only they take
      -- down a building's wall there (`may_shape`); anywhere else anybody may (`pullDownRefusal`).
      select dd.name, rank_lacks(p_world, dd.founded_by, p_uid, 'shape') into v_short, v_rank
        from (values (1, b.ax, b.ay), (2, b.bx, b."by")) v(o, x, y)
        cross join lateral deed_covering(p_world, v.x, v.y) dd
       where not may_shape(p_world, p_uid, v.x, v.y)
       order by v.o, dd.founded_at limit 1;
      if v_short is not null then
        return coalesce(v_rank, 'That is part of ' || v_short || '. Only its builders may '
            || lower((select a.label from action_def a where a.id = p_action)) || ' there.');
      end if;
      -- gates: a padlock on a drawbridge's winch keeps it from being pulled down as from being worked.
      v_short := lock_refusal(p_world, p_uid, b.lock, b.ax, b.ay);
      if v_short is not null then return v_short; end if;
    end if;
    return null;

  elsif p_action = 'ring_bell' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    if not found or not coalesce((select f.bell from furniture_def f where f.id = pc.sub), false) then
      return 'That is not a bell.';
    end if;
    if not near_piece(p_world, p_uid, pc) then return 'Stand next to it.'; end if;
    if not on_my_deed(p_world, p_uid, pc.x, pc.y) then
      return 'Ring it on a settlement of yours; a bell in the wild calls nobody.';
    end if;
    return null;

  elsif p_action in ('sleep', 'set_home') then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    if not found or not is_bed(pc) then return 'That is not a bed.'; end if;
    if not near_piece(p_world, p_uid, pc) then return 'Stand next to it.'; end if;
    if p_action = 'sleep' and not is_night(p_world) then
      return 'It is ' || world_clock(p_world) || ' and broad daylight. Sleep when it is dark.';
    end if;
    if p_action = 'set_home' and p.home_x = pc.x and p.home_y = pc.y then
      return 'You already wake up here.';
    end if;
    return null;

  elsif p_action in ('pair_creature', 'read_blood') then
    perform creature_settle(p_world, (p_target->>'id')::int);
    perform herd_settle(p_world);
    c := target_creature(p_world, p_target);
    if c.world_id is null then return 'It is gone.'; end if;
    if p_action = 'read_blood' then return null; end if;
    if (my_deed(p_world, p_uid)).world_id is null then
      return 'Breeding is settled work. Found a settlement first: the young one goes to the token.';
    end if;
    if not creature_in_reach(p_world, p_uid, c, 2.4) then return 'Stand next to ' || c.name || '.'; end if;
    if c.due is not null then return c.name || ' is already in young.'; end if;
    mate := mate_for(p_world, c);
    if mate.id is null then
      return 'There is no ' || lower((select name from species_def where id = c.species))
        || ' of the other sex within ' || round(pair_range()) || ' tiles. ' || c.name
        || ' is ' || c.sex || '.';
    end if;
    return pair_refuses(p_world, c, mate);

  elsif p_action in ('dye_item', 'strip_dye') then
    select * into it from item where world_id = p_world and id = target_item(p_target)
      and holder = 'player' and holder_uid = p_uid;
    if p_action = 'dye_item' then
      if not found then return 'It is gone.'; end if;
      if not takes_dye(it.def) then return 'Nothing will take on that.'; end if;
      -- Out of the bucket or barrel chosen (`dyeFrom`), or the only one that holds enough (`dyeReason`).
      return dye_reason(p_world, p_uid, dye_litres_for(it.def), p_target, it.dye);
    else
      if not found or it.dye is null or not takes_dye(it.def) then return 'It has taken no colour.'; end if;
      if pack_count(p_world, p_uid, 'lye_bucket') <= 0 then
        return 'You need a bucket of lye to strip it.';
      end if;
    end if;
    return null;

  elsif p_action = 'start_brew' then
    select * into bd from brew_def where id = p_target->>'brew';
    if not found then return 'Choose what to brew.'; end if;
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint
      and kind = 'furniture';
    return brew_reason(p_world, p_uid, pc, bd);
  end if;
  return null;
end $function$;

/* ---- settlement_refusal: from 20260924150000_a_team_stays_in_the_traces.sql. Upgrade and Rename are powers of a rank, on the settlement aimed at; disbanding stays the founder's. ---- */

CREATE OR REPLACE FUNCTION public.settlement_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare dd deed; p placed; it item; c creature; v_name text;
begin
  if p_action in ('upgrade_deed', 'disband_deed', 'rename_deed') then
    -- The one whose token the job is aimed at, or your own (`deedAimed`).
    dd := settlement_aimed(p_world, p_uid, p_target);
    if dd.world_id is null then return 'You have no settlement.'; end if;
    -- Disbanding is its founder's alone: no rank may be given it.
    if p_action = 'disband_deed' then
      return case when dd.founded_by <> p_uid then 'Only whoever founded ' || dd.name || ' may disband it.' end;
    end if;
    v_name := rank_lacks(p_world, dd.founded_by, p_uid, case when p_action = 'upgrade_deed' then 'upgrade' else 'rename' end);
    if v_name is not null then return v_name; end if;
    if p_action = 'upgrade_deed' then return upgrade_reason(p_world, dd.founded_by); end if;
    if p_action = 'rename_deed'
       and nullif(btrim(coalesce(p_target->>'name', '')), '') is null then
      return 'Choose a name.';
    end if;
    return null;
  end if;

  if p_action = 'place_post' then
    select * into it from item where world_id = p_world and holder = 'player' and holder_uid = p_uid
      and def = 'work_post' and not locked
      and (target_item(p_target) is null or id = target_item(p_target))
      order by id limit 1;
    if not found then return 'You have no work post to drive in.'; end if;
    return post_place_reason(p_world, (p_target->>'x')::int, (p_target->>'y')::int,
      coalesce((p_target->>'sx')::int, 0), coalesce((p_target->>'sy')::int, 0));
  end if;

  -- Everything else is asked of a post, so the post is brought up to date
  -- before it is asked: one nobody has looked at for a day is not there.
  perform post_settle((p_target->>'id')::bigint);
  select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint
    and kind = 'post';
  if not found then return 'It is gone.'; end if;
  if not near_piece(p_world, p_uid, p) then return 'Stand at the post.'; end if;

  if p_action = 'assign_post' then
    if exists (select 1 from creature q where q.world_id = p_world and q.post = p.id) then
      return 'Something is already working out of it.';
    end if;
    select * into c from creature where world_id = p_world and id = (p_target->>'creature')::int;
    if not found then return 'Choose a wildermon.'; end if;
    if c.mode = 'wild' then return c.name || ' is not yours to set to work.'; end if;
    -- The browser's words, which the island never had.
    if c.hitched_to is not null or c.rider is not null then return c.name || ' is in harness.'; end if;
    if not worker_job_ported((select gathers from species_def where id = c.species)) then
      return 'Nobody has taught this island what '
        || (select plain from gather_def where id = (select gathers from species_def where id = c.species))
        || ' looks like yet.';
    end if;
  elsif p_action = 'unassign_post' then
    if not exists (select 1 from creature q where q.world_id = p_world and q.post = p.id) then
      return 'Nothing is working out of it.';
    end if;
  end if;
  return null;
end $function$;

/* ---- perform_settlement: from 20260927121838_the_mender_moved_onto_perks.sql. Upgrading and renaming act on the settlement aimed at; disbanding is unchanged. ---- */

CREATE OR REPLACE FUNCTION public.perform_settlement(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare dd deed; p placed; it item; c creature; v_name text; v_level int; v_sx int; v_sy int;
        v_freed int := 0; v_tipped int := 0; cr crate; r record;
begin
  if p_action = 'upgrade_deed' then
    -- The settlement aimed at, which a rank allowed it may upgrade for its founder.
    dd := settlement_aimed(p_world, p_uid, p_target);
    v_level := dd.level + 1;
    update deed set level = v_level, radius = deed_radius(v_level)
      where world_id = p_world and founded_by = dd.founded_by;
    perform tell(p_world, p_uid, dd.name || ' grows to level ' || v_level
      || '. The border reaches ' || deed_radius(v_level) || ' tiles from the token and '
      || worker_cap(p_world, dd.founded_by) || ' wildermon may work here.', 'system');
    if dd.founded_by <> p_uid then
      perform tell(p_world, dd.founded_by, folk_name(p_world, p_uid) || ' upgrades ' || dd.name
        || ' to level ' || v_level || '.', 'system');
    end if;
    perform land_announce(p_world, dd.x, dd.y);

  elsif p_action = 'rename_deed' then
    dd := settlement_aimed(p_world, p_uid, p_target);
    v_name := left(btrim(p_target->>'name'), 32);
    update deed set name = v_name where world_id = p_world and founded_by = dd.founded_by;
    perform tell(p_world, p_uid, 'The settlement is now called ' || v_name || '.', 'system');
    if dd.founded_by <> p_uid then
      perform tell(p_world, dd.founded_by, folk_name(p_world, p_uid) || ' renames ' || dd.name
        || ' to ' || v_name || '.', 'system');
    end if;

  elsif p_action = 'disband_deed' then
    select * into dd from deed where world_id = p_world and founded_by = p_uid;
    -- Everything working here runs wild, and what it was carrying goes on the
    -- ground where it stood rather than with it. One in a creature crate is in
    -- your crate rather than the settlement's, and stays yours.
    for c in select * from creature where world_id = p_world and keeper = p_uid and mode = 'deed' loop
      if c.carrying is not null then
        perform drop_on_ground(p_world, floor(creature_x(c))::int, floor(creature_y(c))::int,
          c.carrying->>'def', (c.carrying->>'ql')::double precision, c.carrying->>'extra',
          (c.carrying->>'count')::int);
      end if;
      update creature set mode = 'wild', phase = 'idle', job = null, post = null, carrying = null,
          name = (select name from species_def where id = c.species)
        where world_id = p_world and id = c.id;
      v_freed := v_freed + 1;
    end loop;
    -- The settlement's own crate goes with the settlement, and whatever was in
    -- it is tipped out where it stood rather than vanishing with it.
    cr := deed_crate(p_world, p_uid);
    if cr.id is not null then
      for r in select * from item where world_id = p_world and crate = cr.id loop
        update item set holder = 'ground', holder_uid = null, crate = null, gx = cr.x, gy = cr.y
          where id = r.id;
        v_tipped := v_tipped + 1;
      end loop;
      delete from crate where world_id = p_world and id = cr.id;
    end if;
    /*
     * Yours, and not the island's.
     *
     * Reported by somebody whose settlement was gone while his crate still
     * stood and who had not disbanded anything: somebody else had, at the
     * other end of the island, and this line took every settlement on it. The
     * deed crate is the tell — the disbanding tips out and removes the
     * *caller's* crate, so everybody else was left with an orphan standing in
     * a field and nothing to say what it had belonged to.
     *
     * `deed` was keyed on the island alone until a day ago, when it became
     * `(world_id, founded_by)`. The reads either side of this were re-scoped
     * with the key; the delete was not, and a delete is the one statement
     * where the whole island being in range does not read as a mistake.
     */
    delete from deed where world_id = p_world and founded_by = p_uid;
    perform tell(p_world, p_uid, dd.name || ' is disbanded. '
      || v_freed || case when v_freed = 1 then ' wildermon runs' else ' wildermon run' end
      || ' wild and ' || v_tipped
      || case when v_tipped = 1 then ' thing is' else ' things are' end
      || ' tipped out where the crate stood.', 'system');
    perform land_announce(p_world, dd.x, dd.y);

  elsif p_action = 'place_post' then
    select * into it from item where world_id = p_world and holder = 'player' and holder_uid = p_uid
      and def = 'work_post' and not locked
      and (target_item(p_target) is null or id = target_item(p_target))
      order by id limit 1;
    if not found then return; end if;
    v_sx := least(subtiles() - 1, greatest(0, coalesce((p_target->>'sx')::int, 0)));
    v_sy := least(subtiles() - 1, greatest(0, coalesce((p_target->>'sy')::int, 0)));
    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (p_world, 'post', it.extra, (p_target->>'x')::int, (p_target->>'y')::int, v_sx, v_sy,
            (p_target->>'x')::int + (v_sx + 0.5) / subtiles(),
            (p_target->>'y')::int + (v_sy + 0.5) / subtiles(), it.ql, p_uid)
    returning * into p;
    delete from item where id = it.id;
    perform tell(p_world, p_uid, 'You drive the post in and tack the ribbon to it. It will stand about '
      || round(post_life(p.ql) * kept_life(p) / 60) || ' minutes and reach ' || post_radius(p.ql)
      || ' tiles. Set a wildermon to it.', 'event');
    perform land_announce(p_world, p.x, p.y);
    return;
  end if;

  if p_action in ('upgrade_deed', 'rename_deed', 'disband_deed') then return; end if;

  select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint;
  if not found then return; end if;

  if p_action = 'pick_up_post' then
    -- Half rotten by now, most likely, and it comes up as it went in.
    perform give(p_world, p_uid, 'work_post', 1,
      greatest(1, p.ql * (1 - post_dmg(p) / 100)), p.sub);
    update creature set post = null, phase = 'idle' where world_id = p_world and post = p.id;
    delete from placed where id = p.id;
    perform tell(p_world, p_uid, 'You pull the post up and coil the ribbon round it.', 'event');
    perform land_announce(p_world, p.x, p.y);

  elsif p_action = 'assign_post' then
    select * into c from creature where world_id = p_world and id = (p_target->>'creature')::int;
    if not found then return; end if;
    update creature set post = p.id, mode = 'deed', phase = 'idle', enemy = null, hunting = null,
        from_x = p.cx, from_y = p.cy + 0.6, to_x = p.cx, to_y = p.cy + 0.6,
        leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
      where world_id = p_world and id = c.id;
    perform journal_note(p_world, p_uid, 'posted');
    perform tell(p_world, p_uid, c.name || ' will '
      || coalesce((select g.plain from gather_def g
                   where g.id = (select gathers from species_def where id = c.species)),
                  'keep to the post')
      || ' within ' || least(work_range(c), post_radius(p.ql))
      || ' tiles of the post while it stands. (' || post_state(p) || ')', 'system');

  elsif p_action = 'unassign_post' then
    select * into c from creature where world_id = p_world and post = p.id limit 1;
    if not found then return; end if;
    select * into dd from my_deed(p_world, c.keeper) md where md.world_id is not null;
    update creature set post = null, phase = 'idle',
        from_x = coalesce(dd.x + 0.5, p.cx), from_y = coalesce(dd.y + 1.5, p.cy),
        to_x = coalesce(dd.x + 0.5, p.cx), to_y = coalesce(dd.y + 1.5, p.cy),
        leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
      where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, c.name || ' is called off the post.', 'system');
  end if;
end $function$;

-- ---------------------------------------------------------------- the roll's doors

/**
 * Set somebody's rank on a settlement, by the rank's name (any case, which is
 * also how a browser from before today names mayor, builder and guest).
 *
 * Its founder sets anybody else on the roll to any of its ranks. A citizen
 * whose rank holds Set ranks sets somebody ranked below them, to a rank below
 * their own. Nobody changes the founder's rank or their own. The refusals are
 * the browser's `rankRefusal`, in its order and its words.
 */
create or replace function rpc_rank(p_world uuid, p_founder uuid, p_uid uuid, p_role text)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_mine deed_rank_def; v_theirs deed_rank_def; v_to deed_rank_def;
        v_name text; v_by text; v_why text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into d from deed where world_id = p_world and founded_by = p_founder;
  if not found then return jsonb_build_object('why', 'That settlement is gone.'); end if;
  v_why := rank_member_refusal(p_world, p_founder, me, 'set_ranks');
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  if p_uid is null or p_uid = me then
    return jsonb_build_object('why', 'Nobody may change their own rank.');
  end if;
  if p_uid = p_founder then
    return jsonb_build_object('why', 'Nobody may change the rank of whoever founded ' || d.name || '.');
  end if;
  v_name := folk_name(p_world, p_uid);
  v_theirs := deed_rank_of(p_world, p_founder, p_uid);
  if v_theirs.id is null then
    return jsonb_build_object('why', v_name || ' is not a citizen of ' || d.name || '.');
  end if;
  select * into v_to from deed_rank_def r
   where r.world_id = p_world and r.founder = p_founder and lower(r.name) = lower(btrim(coalesce(p_role, '')));
  if not found then
    return jsonb_build_object('why', d.name || ' has no rank called ' || btrim(coalesce(p_role, '')) || '.');
  end if;
  if me <> p_founder then
    v_mine := deed_rank_of(p_world, p_founder, me);
    if v_theirs.ord <= v_mine.ord then
      return jsonb_build_object('why', v_name || ' holds ' || v_theirs.name || ' at ' || d.name || '. Your rank, '
        || v_mine.name || ', may set the rank only of those ranked below it.');
    end if;
    if v_to.ord <= v_mine.ord then
      return jsonb_build_object('why', 'Your rank at ' || d.name || ', ' || v_mine.name || ', may give only ranks below it.');
    end if;
  end if;
  if v_theirs.id = v_to.id then
    return jsonb_build_object('why', v_name || ' already holds ' || v_to.name || ' at ' || d.name || '.');
  end if;
  update deed_member set rank_id = v_to.id
   where world_id = p_world and founder = p_founder and uid = p_uid;
  v_by := folk_name(p_world, me);
  perform tell(p_world, p_uid, v_by || ' gives you the rank of ' || v_to.name || ' at ' || d.name
    || ': you may ' || rank_may(v_to.perms) || '.', 'system');
  perform tell(p_world, me, v_name || ' now holds ' || v_to.name || ' at ' || d.name || '.', 'event');
  if me <> p_founder then
    perform tell(p_world, p_founder, v_by || ' gives ' || v_name || ' the rank of ' || v_to.name
      || ' at ' || d.name || '.', 'event');
  end if;
  return jsonb_build_object('ranked', v_name, 'role', lower(v_to.name), 'rank', v_to.name, 'deed', d.name);
end $fn$;

/**
 * Ask somebody to come and live on a settlement: its founder, or a citizen
 * whose rank holds Invite.
 *
 * Which settlement is named by its founder. Left out -- as a browser from
 * before mayors leaves it -- it is the one the caller founded. Holding land
 * of their own is no bar to the person asked, but a full roll of three is.
 */
create or replace function rpc_invite(p_world uuid, p_uid uuid, p_founder uuid default null) returns jsonb
  language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_name text; v_why text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if p_uid is null or p_uid = me then
    return jsonb_build_object('why', 'You are already here.');
  end if;
  select * into d from deed where world_id = p_world and founded_by = coalesce(p_founder, me);
  if not found then
    if p_founder is null or p_founder = me then
      return jsonb_build_object('why', 'You hold no settlement to invite anybody to.');
    end if;
    return jsonb_build_object('why', 'That settlement is gone.');
  end if;
  v_why := rank_member_refusal(p_world, d.founded_by, me, 'invite');
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  if not exists (select 1 from player where world_id = p_world and uid = p_uid) then
    return jsonb_build_object('why', 'Nobody by that name is on this island.');
  end if;
  v_name := folk_name(p_world, p_uid);
  if p_uid = d.founded_by
     or exists (select 1 from deed_member m where m.world_id = p_world and m.uid = p_uid
                  and m.founder = d.founded_by) then
    return jsonb_build_object('why', v_name || ' already lives here.');
  end if;
  if deeds_joined_by(p_world, p_uid) >= deeds_joined()::int then
    return jsonb_build_object('why', v_name || ' is a citizen of '
      || deeds_joined()::int || ' settlements already, which is as many as anybody may be.');
  end if;
  if exists (select 1 from deed_invite i where i.world_id = p_world and i.founder = d.founded_by
               and i.uid = p_uid) then
    return jsonb_build_object('why', v_name || ' has already been asked, and has not answered.');
  end if;
  insert into deed_invite (world_id, founder, uid, asked_by) values (p_world, d.founded_by, p_uid, me);
  perform tell(p_world, p_uid, folk_name(p_world, me) || ' invites you to live at '
    || d.name || '. (Social, to answer)', 'system');
  return jsonb_build_object('asked', v_name, 'deed', d.name);
end $fn$;

/**
 * Yes or no to an invitation.
 *
 * Yes puts you on the roll at the rank its founder chose for newcomers, and
 * says what that rank may do. The founder hears the answer, and so does
 * whoever sent it.
 */
create or replace function rpc_invite_answer(p_world uuid, p_founder uuid, p_yes boolean)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_n int; v_asker uuid; r deed_rank_def;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into d from deed where world_id = p_world and founded_by = p_founder;
  if not found or not exists (select 1 from deed_invite i
        where i.world_id = p_world and i.founder = p_founder and i.uid = me) then
    return jsonb_build_object('why', 'There is no invitation waiting from there.');
  end if;
  select i.asked_by into v_asker from deed_invite i
   where i.world_id = p_world and i.founder = p_founder and i.uid = me;
  if v_asker = p_founder then v_asker := null; end if;
  if not coalesce(p_yes, false) then
    delete from deed_invite where world_id = p_world and founder = p_founder and uid = me;
    perform tell(p_world, p_founder, folk_name(p_world, me) || ' will not come to '
      || d.name || '.', 'event');
    if v_asker is not null then
      perform tell(p_world, v_asker, folk_name(p_world, me) || ' will not come to '
        || d.name || '.', 'event');
    end if;
    return jsonb_build_object('joined', false, 'deed', d.name);
  end if;
  v_n := deeds_joined_by(p_world, me);
  if v_n >= deeds_joined()::int then
    -- The invitation is left standing: leave one of the three and it is still
    -- there to answer.
    return jsonb_build_object('why', 'You are a citizen of ' || v_n
      || ' settlements already, which is as many as anybody may be. Leave one first.');
  end if;
  delete from deed_invite where world_id = p_world and founder = p_founder and uid = me;
  -- No rank named: the settlement's rank for newcomers (`deed_member_rank`).
  insert into deed_member (world_id, founder, uid) values (p_world, p_founder, me);
  r := deed_rank_of(p_world, p_founder, me);
  perform tell(p_world, me, 'You are a citizen of ' || d.name || ', at the rank of ' || r.name
    || ': you may ' || rank_may(r.perms) || '.', 'system');
  perform tell(p_world, p_founder, folk_name(p_world, me) || ' has come to live at '
    || d.name || '.', 'system');
  if v_asker is not null then
    perform tell(p_world, v_asker, folk_name(p_world, me) || ' has come to live at '
      || d.name || '.', 'system');
  end if;
  return jsonb_build_object('joined', true, 'deed', d.name, 'rank', r.name);
end $fn$;

/**
 * Off one roll: yourself, or somebody you are sending away.
 *
 * Its founder sends away anybody on the roll; a citizen whose rank holds
 * Send away sends away anybody ranked below them. The refusals are the
 * browser's `sendAwayRefusal`, in its order and its words.
 */
create or replace function rpc_leave_deed(p_world uuid, p_founder uuid, p_uid uuid default null)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); who uuid; d deed; v_mine deed_rank_def; v_theirs deed_rank_def; v_why text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  who := coalesce(p_uid, me);
  select * into d from deed where world_id = p_world and founded_by = p_founder;
  if found and who <> me and who = p_founder then
    return jsonb_build_object('why', 'Nobody may send away whoever founded ' || d.name || '.');
  end if;
  if not exists (select 1 from deed_member m
        where m.world_id = p_world and m.uid = who and m.founder = p_founder) then
    return jsonb_build_object('why', 'Nobody there to send away.');
  end if;
  if who <> me then
    v_why := rank_member_refusal(p_world, p_founder, me, 'send_away');
    if v_why is not null then return jsonb_build_object('why', v_why); end if;
    if me <> p_founder then
      v_mine := deed_rank_of(p_world, p_founder, me);
      v_theirs := deed_rank_of(p_world, p_founder, who);
      if v_theirs.ord <= v_mine.ord then
        return jsonb_build_object('why', folk_name(p_world, who) || ' holds ' || v_theirs.name || ' at ' || d.name
          || '. Your rank, ' || v_mine.name || ', may send away only those ranked below it.');
      end if;
    end if;
  end if;
  delete from deed_member where world_id = p_world and uid = who and founder = p_founder;
  if who = me then
    perform tell(p_world, me, 'You are no longer a citizen of ' || d.name || '.', 'system');
    if p_founder <> me then
      perform tell(p_world, p_founder, folk_name(p_world, me) || ' has left ' || d.name || '.', 'event');
    end if;
  else
    perform tell(p_world, who, 'You are no longer welcome at ' || d.name || '.', 'error');
    perform tell(p_world, me, folk_name(p_world, who) || ' is off the roll of ' || d.name || '.', 'event');
    if p_founder <> me then
      perform tell(p_world, p_founder, folk_name(p_world, me) || ' has taken '
        || folk_name(p_world, who) || ' off the roll of ' || d.name || '.', 'event');
    end if;
  end if;
  return jsonb_build_object('left', d.name);
end $fn$;

-- ---------------------------------------------------------------- the founder's doors

/** The settlement the caller founded, which is the only one whose ranks they may change. */
create or replace function rank_book(p_world uuid, p_uid uuid) returns deed language sql stable as $fn$
  select d.* from deed d where d.world_id = p_world and d.founded_by = p_uid
$fn$;

/** What the founder is told when they have founded nothing to set ranks on: the browser's `NO_RANK_BOOK`. */
create or replace function rank_book_none() returns text language sql immutable as $fn$
  select 'You have founded no settlement to set ranks on.'
$fn$;

/**
 * Why a name will not do for a rank of this settlement, or nothing: the
 * browser's `rankNameRefusal`. `p_except` is the rank being renamed.
 */
create or replace function rank_name_refusal(p_world uuid, p_founder uuid, p_name text, p_except bigint default null)
  returns text language sql stable as $fn$
  select case
    when btrim(coalesce(p_name, '')) = '' then 'Name the rank.'
    when length(btrim(p_name)) > rank_name_max() then 'A rank''s name is at most ' || rank_name_max() || ' characters.'
    when lower(btrim(p_name)) = 'founder' then 'Founder is whoever founded the settlement, not a rank.'
    when exists (select 1 from deed_rank_def r where r.world_id = p_world and r.founder = p_founder
                   and r.id is distinct from p_except and lower(r.name) = lower(btrim(p_name)))
      then (select d.name from deed d where d.world_id = p_world and d.founded_by = p_founder)
           || ' already has a rank called ' || btrim(p_name) || '.'
  end
$fn$;

/** A new rank, at the foot of the list and allowed nothing until its founder says otherwise. */
create or replace function rpc_rank_add(p_world uuid, p_name text) returns jsonb
  language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_why text; v_n int; v_id bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  d := rank_book(p_world, me);
  if d.world_id is null then return jsonb_build_object('why', rank_book_none()); end if;
  select count(*)::int into v_n from deed_rank_def r where r.world_id = p_world and r.founder = me;
  if v_n >= rank_cap() then
    return jsonb_build_object('why', d.name || ' has ' || rank_cap()
      || ' ranks besides its founder, which is as many as a settlement may have.');
  end if;
  v_why := rank_name_refusal(p_world, me, p_name);
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  insert into deed_rank_def (world_id, founder, name, ord, perms)
  values (p_world, me, btrim(p_name),
          coalesce((select max(r.ord) from deed_rank_def r where r.world_id = p_world and r.founder = me), 0) + 1, 0)
  returning id into v_id;
  return jsonb_build_object('added', btrim(p_name), 'id', v_id);
end $fn$;

/** A rank by another name: everybody holding it holds it still. */
create or replace function rpc_rank_rename(p_world uuid, p_id bigint, p_name text) returns jsonb
  language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; r deed_rank_def; v_why text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  d := rank_book(p_world, me);
  if d.world_id is null then return jsonb_build_object('why', rank_book_none()); end if;
  select * into r from deed_rank_def x where x.world_id = p_world and x.founder = me and x.id = p_id;
  if not found then return jsonb_build_object('why', 'That rank is gone.'); end if;
  v_why := rank_name_refusal(p_world, me, p_name, p_id);
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  update deed_rank_def set name = btrim(p_name) where id = p_id;
  update deed_member set role = lower(btrim(p_name)) where world_id = p_world and founder = me and rank_id = p_id;
  return jsonb_build_object('renamed', btrim(p_name));
end $fn$;

/** A rank a place up the list (-1) or down it (1), trading places with its neighbour. */
create or replace function rpc_rank_move(p_world uuid, p_id bigint, p_dir int) returns jsonb
  language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; r deed_rank_def; o deed_rank_def;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  d := rank_book(p_world, me);
  if d.world_id is null then return jsonb_build_object('why', rank_book_none()); end if;
  select * into r from deed_rank_def x where x.world_id = p_world and x.founder = me and x.id = p_id;
  if not found then return jsonb_build_object('why', 'That rank is gone.'); end if;
  if coalesce(p_dir, 0) < 0 then
    select * into o from deed_rank_def x where x.world_id = p_world and x.founder = me and x.ord < r.ord
     order by x.ord desc limit 1;
    if not found then return jsonb_build_object('why', r.name || ' is already the highest rank.'); end if;
  else
    select * into o from deed_rank_def x where x.world_id = p_world and x.founder = me and x.ord > r.ord
     order by x.ord limit 1;
    if not found then return jsonb_build_object('why', r.name || ' is already the lowest rank.'); end if;
  end if;
  update deed_rank_def set ord = case when id = r.id then o.ord else r.ord end where id in (r.id, o.id);
  return jsonb_build_object('moved', r.name);
end $fn$;

/**
 * A rank gone. Nobody is moved to another rank behind the founder's back: a
 * rank somebody holds stays until they hold another, and the rank for
 * newcomers until another is.
 */
create or replace function rpc_rank_drop(p_world uuid, p_id bigint) returns jsonb
  language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; r deed_rank_def; v_n int;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  d := rank_book(p_world, me);
  if d.world_id is null then return jsonb_build_object('why', rank_book_none()); end if;
  select * into r from deed_rank_def x where x.world_id = p_world and x.founder = me and x.id = p_id;
  if not found then return jsonb_build_object('why', 'That rank is gone.'); end if;
  if r.newcomer then
    return jsonb_build_object('why', r.name || ' is the rank newcomers are given. Choose another for them first.');
  end if;
  select count(*)::int into v_n from deed_member m where m.rank_id = p_id;
  if v_n > 0 then
    return jsonb_build_object('why', v_n || case when v_n = 1 then ' citizen holds ' else ' citizens hold ' end
      || r.name || '. Give them another rank first.');
  end if;
  delete from deed_rank_def where id = p_id;
  update deed_rank_def set ord = ord - 1 where world_id = p_world and founder = me and ord > r.ord;
  return jsonb_build_object('dropped', r.name);
end $fn$;

/** One power given to a rank, or taken from it. */
create or replace function rpc_rank_allow(p_world uuid, p_id bigint, p_power text, p_on boolean) returns jsonb
  language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; r deed_rank_def; v_bit int;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  d := rank_book(p_world, me);
  if d.world_id is null then return jsonb_build_object('why', rank_book_none()); end if;
  select * into r from deed_rank_def x where x.world_id = p_world and x.founder = me and x.id = p_id;
  if not found then return jsonb_build_object('why', 'That rank is gone.'); end if;
  v_bit := power_bit(p_power);
  if v_bit = 0 then return jsonb_build_object('why', 'There is no such permission.'); end if;
  update deed_rank_def
     set perms = case when coalesce(p_on, false) then perms | v_bit else perms & ~v_bit end
   where id = p_id
  returning * into r;
  return jsonb_build_object('rank', r.name, 'perms', r.perms);
end $fn$;

/** The rank an invitation puts newcomers on. */
create or replace function rpc_rank_newcomers(p_world uuid, p_id bigint) returns jsonb
  language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; r deed_rank_def;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  d := rank_book(p_world, me);
  if d.world_id is null then return jsonb_build_object('why', rank_book_none()); end if;
  select * into r from deed_rank_def x where x.world_id = p_world and x.founder = me and x.id = p_id;
  if not found then return jsonb_build_object('why', 'That rank is gone.'); end if;
  update deed_rank_def set newcomer = false where world_id = p_world and founder = me and newcomer and id <> p_id;
  update deed_rank_def set newcomer = true where id = p_id;
  return jsonb_build_object('newcomers', r.name);
end $fn$;

/* ---- rpc_social: from 20261012234500_mayors_invite_and_ranks_are_set.sql. Each settlement's ranks, and the invitations out from those you may invite to by your rank's Invite. ---- */

CREATE OR REPLACE FUNCTION public.rpc_social(p_world uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then
    raise exception 'you are not on this island';
  end if;
  return jsonb_build_object(
    /*
     * Every settlement that is yours, the one you founded first.
     *
     * A list rather than the one it used to be: a person holds at most one and
     * may be a citizen of `deeds_joined` others, and a window that showed only
     * the first of four would be hiding three places somebody lives.
     *
     * Each carries its own roll — founder included, you left off it — with
     * whereabouts, because people off the same land are near by definition.
     * And your rank on it, and everybody's on its roll by uid, which is what
     * says where you may invite, send away and set ranks.
     */
    'deeds', coalesce((select jsonb_agg(jsonb_build_object(
        'name', d.name, 'x', d.x, 'y', d.y, 'level', d.level, 'radius', d.radius,
        'founder', d.founded_by, 'by', folk_name(p_world, d.founded_by),
        'mine', d.founded_by = me,
        'role', deed_role(p_world, d.founded_by, me),
        -- Your rank by its name and what it may do (nothing for the founder, who may do everything).
        'rank', (deed_rank_of(p_world, d.founded_by, me)).name,
        'perms', (deed_rank_of(p_world, d.founded_by, me)).perms,
        'ranks', coalesce((select jsonb_object_agg(m.uid, m.role) from deed_member m
                  where m.world_id = p_world and m.founder = d.founded_by), '{}'::jsonb),
        -- Everybody's rank by its id, and the settlement's ranks in order, with how many hold each.
        'held', coalesce((select jsonb_object_agg(m.uid, m.rank_id) from deed_member m
                  where m.world_id = p_world and m.founder = d.founded_by), '{}'::jsonb),
        'defs', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', r.id, 'name', r.name, 'ord', r.ord, 'perms', r.perms, 'newcomer', r.newcomer,
                  'held', (select count(*) from deed_member m where m.rank_id = r.id)) order by r.ord, r.id)
                  from deed_rank_def r where r.world_id = p_world and r.founder = d.founded_by), '[]'::jsonb),
        'folk', coalesce((
          select jsonb_agg(folk_row(p_world, q.uid, true)
                 order by q.ord, folk_name(p_world, q.uid))
            from (select d.founded_by as uid, 0 as ord
                  union all
                  select m.uid, 1 from deed_member m
                   where m.world_id = p_world and m.founder = d.founded_by) q
            where q.uid <> me), '[]'::jsonb))
        order by d.founded_by = me desc, d.founded_at)
      from deeds_of(p_world, me) d), '[]'::jsonb),
    -- And how many more you may join, which is what the window says when the
    -- answer is none.
    'room', greatest(0, deeds_joined()::int - deeds_joined_by(p_world, me)),
    /*
     * And how many other people's settlements everybody else is a citizen
     * of, by uid, leaving out whoever is on none. The window's Invite reads
     * it to say "Citizen of 3" where the cap is the bar, in the words
     * `rpc_invite` would refuse in.
     */
    'joined', coalesce((select jsonb_object_agg(q.uid, deeds_joined_by(p_world, q.uid))
      from (select distinct m.uid from deed_member m
             where m.world_id = p_world and m.uid <> me) q), '{}'::jsonb),
    -- Asked to live somewhere, and waiting on you: by whoever asked.
    'invites', coalesce((select jsonb_agg(jsonb_build_object(
        'founder', i.founder, 'by', folk_name(p_world, coalesce(i.asked_by, i.founder)),
        'deed', dd.name, 'at', extract(epoch from i.made_at)) order by i.made_at)
      from deed_invite i join deed dd
        on dd.world_id = i.world_id and dd.founded_by = i.founder
      where i.world_id = p_world and i.uid = me), '[]'::jsonb),
    -- And the ones out from every settlement you may invite to: whoever of
    -- its people sent them, which settlement each is for.
    'sent', coalesce((select jsonb_agg(jsonb_build_object(
        'uid', i.uid, 'name', folk_name(p_world, i.uid),
        'founder', i.founder, 'deed', dd.name,
        'by', folk_name(p_world, coalesce(i.asked_by, i.founder)),
        'at', extract(epoch from i.made_at)) order by i.made_at)
      from deed_invite i join deed dd
        on dd.world_id = i.world_id and dd.founded_by = i.founder
      where i.world_id = p_world
        and deed_may(p_world, i.founder, me, power_bit('invite'))), '[]'::jsonb),
    'friends', coalesce((select jsonb_agg(folk_row(p_world, f.other, true)
        order by afoot(p_world, f.other) desc, folk_name(p_world, f.other))
      from friend f where f.world_id = p_world and f.uid = me and f.state = 'friends'), '[]'::jsonb),
    'asked', coalesce((select jsonb_agg(jsonb_build_object(
        'uid', f.uid, 'name', folk_name(p_world, f.uid),
        'at', extract(epoch from f.at)) order by f.at)
      from friend f where f.world_id = p_world and f.other = me and f.state = 'asked'), '[]'::jsonb),
    'asking', coalesce((select jsonb_agg(jsonb_build_object(
        'uid', f.other, 'name', folk_name(p_world, f.other),
        'at', extract(epoch from f.at)) order by f.at)
      from friend f where f.world_id = p_world and f.uid = me and f.state = 'asked'), '[]'::jsonb),
    -- Letters waiting, by whoever wrote them, so the window can put a number
    -- against a name rather than a bare total nobody can act on.
    'unread', coalesce((select jsonb_agg(jsonb_build_object(
        'uid', q.sender, 'name', folk_name(p_world, q.sender), 'n', q.n) order by q.n desc)
      from (select l.sender, count(*)::int as n from letter l
             where l.world_id = p_world and l.reader = me and l.read_at is null
             group by l.sender) q), '[]'::jsonb),
    /*
     * And everybody ashore. Whereabouts with them while the island is quiet
     * and not once there are people in it — a list of every body on the
     * island with a position beside it is a radar, and it is also, on an
     * island with six people on four thousand tiles, the only way any of them
     * ever meets another.
     */
    'here', folk_ashore(p_world, me),
    -- Which side of that line the island is on, so the window can say why.
    'open', folk_seen(p_world),
    'crowd', crowd_hides()::int);
end $function$;

/* ---- rpc_ground: from 20261010235813_emberbrand_a_held_stun_and_what_is_put_away.sql. Your rank on each settlement of yours by its name and what it may do, so the browser asks a power rather than a name. ---- */

CREATE OR REPLACE FUNCTION public.rpc_ground(p_world uuid, p_range double precision DEFAULT 40, p_slow boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p player; v_field double precision; v_box double precision; v_hand double precision;
        -- When greening came to this island (`greening.ts`).
        v_from timestamptz := (select w.green_from from world w where w.id = p_world);
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me;
  if not found then raise exception 'you are not on this island'; end if;
  /*
   * On the slow half only, because this writes.
   *
   * The fast read runs about once a second per body — everything burning, what
   * is on the tile under you — and a settle on that path is an update a second
   * per player whether or not anything is due. The crops ride the slow half
   * beside the settlements, and any of your own work forces one of those, so
   * sowing is seen at once and a stage is at worst one reconcile late.
   */
  if p_slow then
    perform crops_settle(p_world, p.x, p.y, p_range);
    perform planters_settle(p_world, p.x, p.y, p_range);
    -- Each clock read once, for every crop on it.
    v_field := crop_clock(false, now());
    v_box := crop_clock(true, now());
    v_hand := hand_clock(now());
  end if;
  return jsonb_build_object(
    'placed', coalesce((select jsonb_agg(
        (to_jsonb(pl) - 'world_id' - 'made_by' - 'since' - 'made_at' - 'cx' - 'cy' - 'crumbles_at')
        || jsonb_build_object('fuel', placed_fuel(pl), 'ash', placed_ash(pl),
                              'lit', placed_lit(pl), 'mine', coalesce(pl.made_by = me, false),
        /*
         * And what is in it, which this never said.
         *
         * Reported as "i opened it and dragged my dirt into it and the dirt
         * vanished". It had not: the island had the dirt in the bin and told
         * nobody. Every chest, bin, larder and cart on an island read as
         * empty over there, so anything put away went out of the pack and was
         * never seen again — the same hole a crate fell down before crates
         * carried their contents, and closed the same way. Within six tiles
         * only: you must be within two and a half to reach into one, so six
         * is generous, and a yard of full chests is not worth a phone's
         * second.
         */
                              'things', case when pl.kind = 'furniture'
                                              and greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= 6
                                              -- A grave's, to whoever lies under it and nobody else.
                                              and (pl.crumbles_at is null or pl.made_by = me)
                                then coalesce((select jsonb_agg(jsonb_build_object(
                                       'id', i.id, 'def', i.def, 'ql', i.ql, 'dmg', i.dmg,
                                       'count', i.count, 'extra', i.extra,
                                       -- And its rarity, its colour and its enchantment, which a chest's name for it carries (`storedThing`).
                                       'rare', i.rare, 'dye', i.dye, 'enchant', i.enchant) order by i.id)
                                     from item i
                                     where i.world_id = p_world and i.holder = 'furniture' and i.placed = pl.id),
                                   '[]'::jsonb)
                                else '[]'::jsonb end)
        /*
         * Whether a helm is as good as empty, its holder gone away, and who is
         * aboard as a passenger and in which place: only for a piece that has
         * either, so nothing else carries two more keys it does not need.
         */
        || case when pl.driver is null then '{}'::jsonb
                else jsonb_build_object('helm_open', coalesce((select r.away from player r
                       where r.world_id = p_world and r.uid = pl.driver), true)) end
        || coalesce((select jsonb_build_object('riders', jsonb_agg(jsonb_build_object('uid', r.uid, 'seat', r.seat)
                       order by r.seat))
                     from player r where r.world_id = p_world and r.aboard = pl.id
                     having count(*) > 0), '{}'::jsonb)
        /*
         * And a grave: whose it is, for what anybody else is told when they
         * try it; the seconds it has left, which a browser counts down on its
         * own clock rather than reading this island's; and, to its owner, how
         * many things are in it, which `things` only says from within reach --
         * the way `units` rides beside a crate's contents.
         */
        || case when pl.crumbles_at is null then '{}'::jsonb
                else jsonb_build_object('grave', jsonb_build_object('name', grave_owner(pl),
                       'left', greatest(0, extract(epoch from (pl.crumbles_at - now()))),
                       'units', case when pl.made_by = me then (select coalesce(sum(i.count), 0) from item i
                                  where i.placed = pl.id and i.holder = 'furniture') end)) end
        /*
         * And for a piece with roses on it, the moment it was set down, which
         * is what its roses grow from (`roses.ts`): the same moment for
         * everybody, and sent for nothing else.
         */
        || case when coalesce((select fd.roses from furniture_def fd where fd.id = pl.sub), false)
                then jsonb_build_object('set', extract(epoch from pl.made_at)) else '{}'::jsonb end
        /*
         * And for a piece that gathers moss -- a statue -- the seconds since
         * the moss on it began: since it was set down or last scrubbed, and
         * never from before greening came in (`greening.ts`). Only for those,
         * so nothing else carries a key it does not need.
         */
        || case when pl.kind = 'furniture' and pl.sub in (select fd.id from furniture_def fd where fd.mossy)
                then jsonb_build_object('green_ago', green_ago(greatest(pl.made_at,
                       (select gs.since from green_since gs where gs.world_id = p_world and gs.thing = 'piece'
                           and gs.x = pl.x and gs.y = pl.y and gs.k = pl.id)), v_from))
                else '{}'::jsonb end
        -- And for a shop counter's store, what is set out on it and for whom (`counters.ts`).
        || case when pl.kind = 'counter' then counter_json(pl, me, p.x, p.y) else '{}'::jsonb end
        order by pl.id)
      from placed pl
      where pl.world_id = p_world
        -- The box first, in the whole tiles `placed_near` is keyed on, and then
        -- the exact question. A btree cannot look up a function of a column, so
        -- the exact test on its own read every placed thing on the island, on
        -- every ground poll, for every player. `x` is `floor(cx)` and `y` is
        -- `floor(cy)` -- `drag_along` and every placing write both together --
        -- so a tile of slack each way makes the box a superset of the answer
        -- and the line below still decides who is in it.
        and pl.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and pl.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= p_range), '[]'::jsonb),
    'crates', crates_near(p_world, me, p_range),
    /*
     * And what is lying on the ground, which this never carried.
     *
     * Reported as "killed a roxxa, no corpse dropped to butcher, or at least
     * isn't displaying". The corpse was there: `wound_beast` drops one where
     * the thing fell, and the suite has measured it since kills were ported.
     * This sent the fires, the crates, the crops and the walls, and never a
     * thing lying on the grass — and the browser's map of the ground was only
     * ever written by its own rules, which do not run on an island. So a
     * corpse, a log a worker put down, a hatchet somebody else dropped: all
     * in this table and drawn by nobody.
     *
     * On the fast half, because a corpse is looked for the second the thing
     * goes down; `item_on_ground` serves the box. The whole row, the way the
     * pack is sent, so the browser reads it with the same map.
     */
    'lying', coalesce((select jsonb_agg(to_jsonb(i) - 'world_id' order by i.id)
      from item i
      where i.world_id = p_world and i.holder = 'ground'
        and i.gx between floor(p.x - p_range)::int and floor(p.x + p_range)::int
        and i.gy between floor(p.y - p_range)::int and floor(p.y + p_range)::int), '[]'::jsonb),
    -- cellar: and what is lying on the floors of the cellars in range, the same way (`item_in_cellar` serves the box).
    'cellarLying', coalesce((select jsonb_agg(to_jsonb(i) - 'world_id' order by i.id) from item i -- cellar
      where i.world_id = p_world and i.holder = 'cellar' -- cellar
        and i.gx between floor(p.x - p_range)::int and floor(p.x + p_range)::int -- cellar
        and i.gy between floor(p.y - p_range)::int and floor(p.y + p_range)::int), '[]'::jsonb))
  /*
   * And the half that hardly ever moves.
   *
   * A fire burns down and a kiln works through its load while you stand and
   * watch it, which is why this is asked for every second. A wall is not like
   * that: it goes up when somebody builds it and then it is a wall. Sending
   * both at one pace meant a correlated subquery over `building_tile` per
   * building, a scan of `wall` and one of `floor_tile`, every second for every
   * player, to say that the house is still a house.
   *
   * So the caller says whether it wants them. A browser asks for the lot on
   * its twenty-second reconcile and after any of its own work, and for the
   * burning half the rest of the time. Left out rather than emptied: the
   * browser applies only the keys it is given, so what it holds stands.
   *
   * `p_slow` defaults true, so a page that has not been redeployed gets
   * exactly what it always got.
   */
  || case when not p_slow then '{}'::jsonb else jsonb_build_object(
    /*
     * And everybody ashore, on the slow half, which is the beat that already
     * carries the settlements. The map draws them; `folk_ashore` decides
     * whether there is anything to draw them at.
     */
    'folk', folk_ashore(p_world, me),
    /*
     * And every grave of yours, however far off: you wake a long way from
     * where you fell, and `placed` above is only what is in range. The map
     * marks them and takes the mark up when one goes. Off the index the
     * sweep uses, which holds nothing but graves.
     */
    'graves', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'x', g.x, 'y', g.y) order by g.id)
      from placed g
      where g.world_id = p_world and g.crumbles_at is not null and g.made_by = me), '[]'::jsonb),
    /*
     * What is growing here, settled first so the stage reported is the stage
     * it is actually at rather than the stage it was at when somebody last
     * touched it. Everything on this island settles lazily off a timestamp,
     * and for a crop nobody had ever been the one to ask.
     *
     * `grown` rather than `stage_at`: how far into its stage it has grown, in
     * growing seconds on the clock it grows on, which the browser lays on its
     * own reading of the same clock -- a winter between the stage's start and
     * now adds nothing to it. `ago`, the wall seconds, is what a page from
     * before the year reads.
     */
    'crops', coalesce((select jsonb_agg(jsonb_build_object(
        'x', c.x, 'y', c.y, 'id', c.id, 'stage', c.stage,
        'grown', case when c.hand and not c.glass then v_hand - hand_clock(c.stage_at) else crop_grown(c.glass, c.stage_at, v_field) end,
        'ago', extract(epoch from (now() - c.stage_at)),
        'tended', c.tended, 'tendedNow', c.tended_now, 'ql', c.ql, 'pace', c.pace)
        -- And a crop under glass says so, and `grown` is on the glass clock (`glasshouse.ts`).
        || case when c.glass then '{"glass": true}'::jsonb else '{}'::jsonb end
        -- And one sown with Love's Season's Hand, on its clock (`hand_clock`).
        || case when c.hand then '{"hand": true}'::jsonb else '{}'::jsonb end)
      from crop c
      where c.world_id = p_world
        and greatest(abs(c.x + 0.5 - p.x), abs(c.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
    -- And what grows in the planters, by the piece, on the planter's own clock.
    'planted', coalesce((select jsonb_agg(jsonb_build_object(
        'planter', c.placed, 'x', pl.x, 'y', pl.y, 'id', c.id, 'stage', c.stage,
        'grown', v_box - crop_clock(true, c.stage_at),
        'ago', extract(epoch from (now() - c.stage_at)),
        'tended', c.tended, 'tendedNow', c.tended_now, 'ql', c.ql, 'pace', c.pace) order by c.placed)
      from placed pl join planter_crop c on c.placed = pl.id
      where pl.world_id = p_world
        and pl.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and pl.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= p_range), '[]'::jsonb),
    -- And the island's wall clock, which a field's clock is read off, so the browser reads it off the same one.
    'now', extract(epoch from now())::double precision,
    /*
     * The felling notches near you, and how long ago the woods last turned
     * over. Look reads both: "2 of 3 strokes in it", "the woods turn over in
     * 9 hours". A browser on an island keeps no clock of its own for the
     * woods, so this is the only place it hears the hour.
     */
    /*
     * The water lilies and lotus planted near you: when each was planted and
     * last picked, which is all of one. The browser works out the rest from
     * the year, as `water_plant_state` does.
     */
    'waterPlants', water_plants_near(p_world, p.x, p.y, p_range),
    'notches', coalesce((select jsonb_agg(jsonb_build_object('x', n.x, 'y', n.y, 'cuts', n.cuts))
      from tree_notch n
      where n.world_id = p_world
        and greatest(abs(n.x + 0.5 - p.x), abs(n.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
    'treesAgo', (select extract(epoch from (now() - w.trees_at)) from world w where w.id = p_world),
    -- The mark the ground is being worked to, which lives on the player row
    -- so that it is the same mark in every browser you open.
    'level', p.level_h,
    -- What you are on each of them, so the browser can say what you may do
    -- rather than finding out by being refused. Your own first one is your
    -- own or one you were asked onto; either way `deed_role` says which.
    'deed', (select jsonb_build_object(
        'name', d.name, 'x', d.x, 'y', d.y, 'radius', d.radius, 'level', d.level, 'mine', true,
        'role', deed_role(p_world, d.founded_by, me),
        'rank', (deed_rank_of(p_world, d.founded_by, me)).name,
        'perms', (deed_rank_of(p_world, d.founded_by, me)).perms,
        'baubles', deed_baubles_json(p_world, d.founded_by))
      from my_deed(p_world, me) d where d.world_id is not null),
    'deeds', coalesce((select jsonb_agg(jsonb_build_object(
        'name', d.name, 'x', d.x, 'y', d.y, 'radius', d.radius, 'level', d.level,
        -- Land you were asked onto is land you may work, so it is drawn as
        -- yours rather than as a stranger's border you happen to be inside.
        'mine', exists (select 1 from deed_member m where m.world_id = p_world
                          and m.uid = me and m.founder = d.founded_by),
        'role', deed_role(p_world, d.founded_by, me),
        'rank', (deed_rank_of(p_world, d.founded_by, me)).name,
        'perms', (deed_rank_of(p_world, d.founded_by, me)).perms,
        'holder', account_name(d.founded_by),
        -- And what is in its altar, for the settlements you are a citizen of.
        'baubles', case when exists (select 1 from deed_member m where m.world_id = p_world
                                       and m.uid = me and m.founder = d.founded_by)
                        then deed_baubles_json(p_world, d.founded_by) end) order by d.founded_at)
      from deed d
      where d.world_id = p_world and d.founded_by <> me
        and greatest(abs(d.x + 0.5 - p.x), abs(d.y + 0.5 - p.y)) <= p_range + d.radius),
      '[]'::jsonb),
    /*
     * And what is standing.
     *
     * `building`, `wall` and `floor_tile` have been kept here since buildings
     * were ported and have never been sent to anybody. The rules answered
     * about them, a plan went up in Postgres, and no browser ever drew a wall
     * of it — so on an island a building was invisible to everyone, the person
     * who planned it included.
     *
     * Shaped as the browser's own `BuildingsJSON`, so it is laid straight in.
     * A building comes along whole if any of its tiles is in range: half a
     * house is worse than none, and a house is a handful of rows.
     */
    'buildings', jsonb_build_object(
      -- cellar: what is dug out under the buildings sent (`BuildingsJSON.cellars`).
      'cellars', cellars_near(p_world, p.x, p.y, p_range),
      'nextId', coalesce((select max(b.id) + 1 from building b where b.world_id = p_world), 1),
      'list', coalesce((select jsonb_agg(jsonb_build_object(
          'id', b.id, 'name', b.name, 'levels', b.levels, 'workLevel', b.work_level,
          -- Frame: the shape of its roof, which says whether it is a terrace to rail.
          'roof', b.roof,
          'tiles', (select coalesce(jsonb_agg(bt.x || ',' || bt.y order by bt.y, bt.x), '[]'::jsonb)
                      from building_tile bt
                     where bt.world_id = p_world and bt.building = b.id))
          -- Piers: and its deck and its tiles on piers, if it has any (`piers_json`).
          || piers_json(p_world, b.id, b.deck) order by b.id)
        from building b
        where b.world_id = p_world
          and exists (select 1 from building_tile bt
                       where bt.world_id = p_world and bt.building = b.id
                         and greatest(abs(bt.x + 0.5 - p.x), abs(bt.y + 0.5 - p.y)) <= p_range)),
        '[]'::jsonb),
      'walls', coalesce((select jsonb_agg(jsonb_build_object(
          'building', w.building, 'level', w.level, 'x', w.x, 'y', w.y, 'dir', w.dir,
          -- gates: a hidden door its padlock does not admit is sent as the solid wall it looks like.
          'type', wall_seen_type(p_world, me, w), 'material', w.material, 'needed', w.needed, 'total', w.total,
          -- And the seconds since the ivy on a finished wall of stone or brick began (`greening.ts`).
          'greenAgo', case when bill_done(w.needed) and m.kind = 'stone' then green_ago(gs.since, v_from) end)
          -- gates: a portcullis let down, and a padlock this body may know of.
          || wall_gear(p_world, me, w)
          order by w.level, w.dir, w.x, w.y)
        from wall w
        left join build_material_def m on m.id = w.material
        left join green_since gs on gs.world_id = p_world and gs.thing = 'wall' and gs.x = w.x and gs.y = w.y
                                and gs.k = green_wall_k(w.level, w.dir)
        where w.world_id = p_world
          and greatest(abs(w.x + 0.5 - p.x), abs(w.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
      'floors', coalesce((select jsonb_agg(jsonb_build_object(
          'building', f.building, 'level', f.level, 'x', f.x, 'y', f.y,
          'material', f.material, 'kind', f.kind, 'facing', f.facing, 'hand', f.hand,
          'needed', f.needed, 'total', f.total) order by f.level, f.x, f.y)
        from floor_tile f
        where f.world_id = p_world
          and greatest(abs(f.x + 0.5 - p.x), abs(f.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
      -- Frame: the columns on the corners of its storeys.
      'columns', frame_columns_json(p_world, p.x, p.y, p_range)),
    /*
     * And the slabs, which are not buildings and do not go in with them: a
     * foundation is ground somebody poured, and the browser lays it beside the
     * terrain rather than inside a house.
     */
    'foundations', coalesce((select jsonb_agg(jsonb_build_object(
        'id', fo.id, 'x', fo.x, 'y', fo.y, 'top', fo.top, 'pool', fo.pool,
        'needed', fo.needed, 'total', fo.total,
        -- And the seconds since the moss on a poured one began.
        'greenAgo', case when bill_done(fo.needed) then green_ago(gs.since, v_from) end) order by fo.id)
      from foundation fo
      left join green_since gs on gs.world_id = p_world and gs.thing = 'slab' and gs.x = fo.x and gs.y = fo.y and gs.k = 0
      where fo.world_id = p_world
        and greatest(abs(fo.x + 0.5 - p.x), abs(fo.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
    'nextFoundationId', coalesce((select max(fo.id) + 1 from foundation fo where fo.world_id = p_world), 1),
    /*
     * And the bridges, shaped as the browser's own `Bridge`, spans and all.
     *
     * The island has kept `bridge` and `bridge_span` since bridges were ported
     * and never said a word about one, so on an island a bridge was drawn by
     * nobody and walked by nobody: the browser decides where its feet go, and
     * it had never heard of the deck. One comes whole if either end is in
     * range, and a stone arch with the seconds since the moss on it began.
     */
    'bridges', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'ax', b.ax, 'ay', b.ay, 'bx', b.bx, 'by', b.by,
        'height', b.height, 'level', b.level, 'material', b.material,
        'spans', (select coalesce(jsonb_agg(jsonb_build_object('x', s.x, 'y', s.y, 'needed', s.needed, 'total', s.total)
                    order by s.n), '[]'::jsonb)
                  from bridge_span s where s.world_id = p_world and s.bridge = b.id),
        'greenAgo', case when b.kind in ('stone', 'aqueduct') and not exists (select 1 from bridge_span s
                           where s.world_id = p_world and s.bridge = b.id and not span_done(s.needed))
                         then green_ago(gs.since, v_from) end)
        -- gates: a drawbridge drawn up, and the padlock on its winch.
        || bridge_gear(b) order by b.id)
      from bridge b
      left join green_since gs on gs.world_id = p_world and gs.thing = 'bridge' and gs.x = b.ax and gs.y = b.ay and gs.k = b.id
      where b.world_id = p_world
        and (greatest(abs(b.ax + 0.5 - p.x), abs(b.ay + 0.5 - p.y)) <= p_range
             or greatest(abs(b.bx + 0.5 - p.x), abs(b.by + 0.5 - p.y)) <= p_range)), '[]'::jsonb),
    /*
     * And the paving: the seconds since greening came in, which is when every
     * paved tile without a row of its own began, and the tiles in range paved
     * or scrubbed since, off the key's own box.
     */
    'greenFromAgo', extract(epoch from (now() - v_from))::double precision,
    'paving', coalesce((select jsonb_agg(jsonb_build_object('x', gs.x, 'y', gs.y, 'ago', green_ago(gs.since, v_from)))
      from green_since gs
      where gs.world_id = p_world and gs.thing = 'paving'
        and gs.x between floor(p.x - p_range)::int and floor(p.x + p_range)::int
        and gs.y between floor(p.y - p_range)::int and floor(p.y + p_range)::int), '[]'::jsonb)) end;
end $function$;

-- ---------------------------------------------------------------- the ladder, gone

drop function if exists deed_rank(text);
drop function if exists rank_may(text);

select private.lock_doors();

notify pgrst, 'reload schema';
