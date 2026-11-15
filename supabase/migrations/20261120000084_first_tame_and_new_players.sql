/*
 * Two things for somebody new to the island.
 *
 * First tame: sure. A player's first tame of a wildermon cannot fail on the roll: an offering (taken at a chance of 1, `random()` being under 1) or
 * taking one out of a trap (the handling check passes). Every refusal before it stands: the taming a kind asks at its
 * stage, the offering, reach, the room for one more, a monster (never). Once per player: `player.tamed_at`, set by the
 * first mark of a kind as tamed in the field guide (`guide_mark`), whichever way it was won (an offering, a trap, the
 * Call of the Wild, a hybrid bred), and null until then. The beat says whether it is still to come (`first_tame`),
 * for the browser's odds (`src/game/firsttame.ts`).
 *
 * New: day N of 7. Nothing here: the browser reads `player.joined_at`, written once at the join and never since, with
 * the roster's columns (`PEOPLE_COLUMNS`, `src/game/badges.ts`).
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

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

-- When the player first tamed anything; null until they have.
alter table player add column if not exists tamed_at timestamptz;
comment on column player.tamed_at is 'When this player first tamed anything (guide_mark ''tamed''); null until then: their first tame is sure (first_tame).';

-- Everybody who has tamed already: a kind marked tamed in their field guide, or a wildermon of theirs.
update player p
   set tamed_at = coalesce((select min(g.seen_at) from guide g where g.world_id = p.world_id and g.uid = p.uid and g.tamed), now())
 where p.tamed_at is null
   and (exists (select 1 from guide g where g.world_id = p.world_id and g.uid = p.uid and g.tamed)
        or exists (select 1 from creature c where c.world_id = p.world_id and c.keeper = p.uid));

/** Whether a tame of `c` by this player is their first: a wildermon, not a monster, and nothing tamed before. */
create or replace function first_tame(p_world uuid, p_uid uuid, c creature) returns boolean
language sql stable as $fn$
  select coalesce((select not d.monster from species_def d where d.id = c.species), false)
     and exists (select 1 from player p where p.world_id = p_world and p.uid = p_uid and p.tamed_at is null)
$fn$;

-- The first mark of anything as tamed is the player's first tame.
select pg_temp.patch_fn('guide_mark(uuid, uuid, text, text)',
  $o$  insert into guide as g (world_id, uid, species, tamed, bred)$o$,
  $n$  with tamed_first as (
    update player set tamed_at = now()
     where p_what = 'tamed' and world_id = p_world and uid = p_uid and tamed_at is null
  )
  insert into guide as g (world_id, uid, species, tamed, bred)$n$);

-- An offering: taken on a first tame (`firstTameSure`); the chance itself, which Examine and the tests read, as it was.
select pg_temp.patch_fn('perform_creature(uuid, uuid, text, jsonb)',
  $o$    chance := tame_chance(p_world, p_uid, c);
$o$,
  $n$    chance := tame_chance(p_world, p_uid, c);
    -- First tame: sure (`firstTameSure`).
    if first_tame(p_world, p_uid, c) then chance := 1; end if;
$n$);

-- Out of a trap: the handling check passed on a first tame, its gates (taming, room) asked before it as ever.
select pg_temp.patch_fn('perform_trap(uuid, uuid, text, jsonb)',
  $o$                           mind_ease(p_world, p_uid));
$o$,
  $n$                           mind_ease(p_world, p_uid));
    -- First tame: sure (`firstTameSure`).
    if not v_clean and first_tame(p_world, p_uid, c) then v_clean := true; end if;
$n$);

-- And the beat says whether it is still to come.
select pg_temp.patch_fn('rpc_settle(bigint, uuid, bigint, boolean, jsonb)',
  $o$    || jsonb_build_object('thepath', p.thepath));$o$,
  $n$    || jsonb_build_object('thepath', p.thepath)
    -- Whether your next tame is your first, and sure (`first_tame`); null with no body here.
    || jsonb_build_object('first_tame', case when p.uid is null then null else p.tamed_at is null end));$n$);

select private.lock_doors();
