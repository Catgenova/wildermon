/**
 * A skill of each line's own at its third stage, and a trait slot more at each stage.
 *
 * Asked for: "every evolving line gains one perk of its own at its third stage ... concrete and modest, with a
 * number", and "reaching stage 2 opens one more trait slot, and stage 3 one more". This asks, of both sides:
 *
 *   * that every line has its skill, one table on both sides (`STAGE_PERKS`, `species_def.perk`), and that what each
 *     comes to is the same on both sides for every line, just below its third stage (nothing) and at it;
 *   * that each kind of skill is applied where its trade is worked, on both sides, at the third stage and not below:
 *     a reed cutter's cut (`more`), a water carrier's buckets (`loads`), a Zephlet's Stoneskin rest (`rest`), a
 *     Pebbletooth's stun (`stun`), a Cloudlet's fleece (`wool`), a Snarepup's blow (`blood`);
 *   * that the words say what the rule does, with its numbers: each line's third-stage words, the Field guide's stage
 *     page, the help, and the island's own numbers in them;
 *   * that the slots are 3, 4 and 5 by stage on both sides; that one gains a trait as it evolves into each stage, drawn
 *     by the rule (a name it does not carry; a mutation one rarity above its best, about one time in `MUTATION_ODDS`;
 *     the rest off the wild table, better with husbandry); that one put out in the wild at a later stage has its
 *     stage's slots, a young one still its first stage's; and the one-off backfill of evolved ones on the island.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { Game } from '../../src/game/game';
import {
  abilityRest, attackOf, EVOLVE_AT, evoMul, STAGE_MUL, levelSkill, maxHealth, PERK_STAGE, perkBlood, perkLine, perkN, perkSays, REED_LEVELS, SPECIES,
  STAGE_LOADS, STAGE_PERKS, stageLoads, stageOf, type Creature, type PerkKind,
} from '../../src/game/creatures';
import { ACTION_BY_ID } from '../../src/game/actions';
import { STUN_SECS, HEAVY_EVERY } from '../../src/game/fight';
import { SHEAR_WOOL } from '../../src/game/limits';
import { guidePage } from '../../src/game/guide';
import { helpText } from '../../src/ui/panels/help';
import {
  breedTraits, MUTATION_ODDS, nextTier, seededRand, slotDraw, SLOTS_PER_STAGE, stageSlots, TIERS, TRAIT_SLOTS, traitOf, traitTier,
  type TraitTier,
} from '../../src/game/traits';
import { percent } from '../../src/game/words';
import { TileType } from '../../src/world/tiles';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number, by = 1e-6): boolean => Math.abs(a - b) <= by * Math.max(1, Math.abs(b));
const [AT1, AT2] = EVOLVE_AT;
const LINES = Object.values(SPECIES).filter((d) => d.stages).map((d) => d.id);
const KINDS: Array<Exclude<PerkKind, 'blood'>> = ['more', 'loads', 'rest', 'stun', 'wool'];
const CHANNELS = ['speed', 'haul', 'tough', 'sight', 'range', 'hardy', 'work'] as const;
// Just below its third stage, and at it.
const LEVELS = [AT2 - 1, AT2];
const DRAWS = 4000;
const COMMONS = ['light_footed', 'willing', 'curious'];
const T = 16;
const U = '7e5b0000-0000-4000-8000-0000000000f3';

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
  p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
do $t$
declare w uuid; u uuid := '${U}'; a int; t int; c creature; i int; j int; d jsonb; v_well bigint; v_n int;
        v_mut int := 0; v_bad int := 0; v_common int := 0; v_common100 int := 0; v_lv double precision;
        v_ids int[];
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stagethree', 183, 40, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Stagethree', ${T}, ${T}, 10, 1, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 1, 'plank', ${T + 1}, ${T}, 0, 0, true, u);

  -- The table, and the rule's numbers.
  insert into said select 'PERK:' || s.id, coalesce(s.perk, '-') || '|' || coalesce(s.perk_n::text, '-') || '|' || coalesce(s.perk_channel, '-')
    from species_def s where s.perk is not null or s.stages is not null;
  insert into said values ('PERKSTAGE', perk_stage()::text);
  insert into said values ('SLOTS', stage_slots(0) || ',' || stage_slots(1) || ',' || stage_slots(2) || ',' || slots_per_stage());

  -- Every line, just below its third stage and at it: what each kind of skill comes to, its blood by stage, its loads.
  ${LINES.flatMap((id) => LEVELS.map((lv, n) => `
  a := creature_spawn(w, '${id}', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, skills = jsonb_build_object(level_skill('${id}'), ${lv}) where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('N:${id}:${n}', ${KINDS.map((k) => `perk_n(c, '${k}')`).join(" || ',' || ")}
    || '|' || ${CHANNELS.map((ch) => `round(evo_mul(c, '${ch}')::numeric, 6)`).join(" || ',' || ")} || '|' || stage_loads(c) || '|' || stage_of(c));
  delete from creature where world_id = w and id = a;`)).join('')}

  -- A reed cutter, just below its third stage and at it: its first cut.
  perform land_set_tile(w, x, ${T + 4}, tile_id('Reed')) from generate_series(${T - 2}, ${T + 2}) x;
  for i in 0..1 loop
    a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T + 3} + 0.5, 'deed', now() - interval '30 days', u);
    update creature set traits = '{}', rare = null, care = 0, carrying = null, hunger = 1, stance = 'passive',
           skills = jsonb_build_object('foraging', case i when 0 then ${LEVELS[0]} else ${LEVELS[1]} end),
           phase = 'work', work_x = ${T}, work_y = ${T + 4}, from_x = ${T} + 0.5, from_y = ${T + 3} + 0.5,
           to_x = ${T} + 0.5, to_y = ${T + 3} + 0.5, until = now() - interval '0.3 seconds', leg_at = now(), leg_ends = now()
     where world_id = w and id = a;
    perform worker_settle(w, a);
    insert into said select 'REED' || i, coalesce(carrying->>'def', '-') || ',' || coalesce(carrying->>'count', '-') from creature where world_id = w and id = a;
    delete from creature where world_id = w and id = a;
  end loop;

  -- A water carrier, just below its third stage and at it: what it fills at the well.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, litres, since)
    values (w, 'furniture', 'well', ${T + 3}, ${T + 3}, 0, 0, ${T + 4}, ${T + 4}, 40, u, 100, now()) returning id into v_well;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, litres)
    values (w, 'furniture', 'barrel', ${T - 3}, ${T}, 0, 0, ${T - 3} + 0.5, ${T} + 0.5, 40, u, 0);
  for i in 0..1 loop
    a := creature_spawn(w, 'holla', ${T + 3} + 0.5, ${T + 3} + 0.5, 'deed', now() - interval '30 days', u);
    update creature set traits = '{}', rare = null, care = 0, carrying = null, work_x = ${T + 3}, work_y = ${T + 3},
           skills = jsonb_build_object('carrying', case i when 0 then ${LEVELS[0]} else ${LEVELS[1]} end)
     where world_id = w and id = a;
    perform errand_do(w, a);
    insert into said select 'FILL' || i, coalesce(carrying->>'def', '-') || ',' || coalesce(carrying->>'count', '-') from creature where world_id = w and id = a;
    update placed set litres = 100, since = now() where id = v_well;
    delete from creature where world_id = w and id = a;
  end loop;

  -- A Zephlet's Stoneskin, and a Pebbletooth's stun, a Snarepup's blow, just below the third stage and at it.
  for i in 0..1 loop
    a := creature_spawn(w, 'stona', 16.5, 16.5, 'active', now() - interval '30 days', u);
    update creature set traits = '{}', rare = null, skills = jsonb_build_object(level_skill('stona'), case i when 0 then ${LEVELS[0]} else ${LEVELS[1]} end) where world_id = w and id = a;
    t := creature_spawn(w, 'ulva', 17.5, 16.5, 'wild', now() - interval '30 days', null);
    update creature set health = 5000 where world_id = w and id = t;
    perform creature_attack(w, a, t);
    insert into said select 'REST' || i, coalesce(round(extract(epoch from until - now())::numeric, 1)::text, '-') from class_mark where world_id = w and creature_id = a and kind = 'ability';
    delete from creature where world_id = w; delete from class_mark where world_id = w;

    a := creature_spawn(w, 'thumpa', 16.5, 16.5, 'active', now() - interval '30 days', u);
    update creature set traits = '{}', rare = null, skills = jsonb_build_object(level_skill('thumpa'), case i when 0 then ${LEVELS[0]} else ${LEVELS[1]} end) where world_id = w and id = a;
    t := creature_spawn(w, 'ulva', 17, 16.5, 'wild', now() - interval '30 days', null);
    update creature set health = 5000 where world_id = w and id = t;
    for j in 1..${HEAVY_EVERY} loop perform creature_attack(w, a, t); end loop;
    insert into said select 'STUN' || i, coalesce(round(extract(epoch from max(until) - now())::numeric, 1)::text, '-') from class_mark where world_id = w and creature_id = t and kind = 'stun' and until > now();
    delete from creature where world_id = w; delete from class_mark where world_id = w;

    a := creature_spawn(w, 'rowl', 16.5, 16.5, 'active', now() - interval '30 days', u);
    update creature set traits = '{}', rare = null, skills = jsonb_build_object(level_skill('rowl'), case i when 0 then ${LEVELS[0]} else ${LEVELS[1]} end) where world_id = w and id = a;
    select * into c from creature where world_id = w and id = a;
    insert into said values ('BLOW' || i, round(attack_of(c)::numeric, 6)::text);
    delete from creature where world_id = w;
  end loop;

  -- A Cloudlet, just below its third stage and at it, sheared full.
  perform give(w, u, 'carving_knife', 1, 40);
  for i in 0..1 loop
    a := creature_spawn(w, 'woola', ${T} + 0.5, ${T - 1} + 0.5, 'active', now() - interval '3 hours', u);
    update creature set mode = 'active', keeper = u, traits = '{}', rare = null, fleece = 1, leg_at = now(), leg_ends = now(),
           from_x = ${T} + 0.5, from_y = ${T - 1} + 0.5, to_x = ${T} + 0.5, to_y = ${T - 1} + 0.5, until = now() + interval '1 hour', settled_at = now(),
           skills = jsonb_build_object('animal_husbandry', case i when 0 then ${LEVELS[0]} else ${LEVELS[1]} end)
     where world_id = w and id = a;
    delete from item where world_id = w and holder_uid = u and def = 'wool';
    perform act_perform(w, u, 'shear', jsonb_build_object('kind', 'creature', 'id', a));
    insert into said values ('WOOL' || i, coalesce((select sum(count) from item where world_id = w and holder_uid = u and def = 'wool'), 0)::text);
    delete from creature where world_id = w and id = a;
  end loop;

  /* ---- slots ---- */

  -- Evolving into each stage: a trait more each time, by its keeper's husbandry, its pedigree saying where it came from.
  a := creature_spawn(w, 'rabba', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = array[${COMMONS.map((id) => `'${id}'`).join(', ')}], rare = null, pedigree = '{"from": {}}'::jsonb,
         skills = jsonb_build_object('foraging', ${AT1} - 0.0001) where world_id = w and id = a;
  insert into said select 'BEFORE', array_length(traits, 1)::text from creature where world_id = w and id = a;
  for i in 1..50 loop
    perform worker_learn(w, a, 'foraging', 5);
    exit when (select stage_of(cr) from creature cr where cr.world_id = w and cr.id = a) = 1;
  end loop;
  insert into said select 'EVOLVED1', stage_of(cr) || '|' || array_to_string(cr.traits, ',') || '|' || coalesce(cr.pedigree->>'from', '-') from creature cr where cr.world_id = w and cr.id = a;
  -- More learning inside the stage opens nothing.
  perform worker_learn(w, a, 'foraging', 5);
  insert into said select 'INSIDE', array_length(traits, 1)::text from creature where world_id = w and id = a;
  update creature set skills = jsonb_build_object('foraging', ${AT2} - 0.0001) where world_id = w and id = a;
  for i in 1..50 loop
    perform worker_learn(w, a, 'foraging', 5);
    exit when (select stage_of(cr) from creature cr where cr.world_id = w and cr.id = a) = 2;
  end loop;
  insert into said select 'EVOLVED2', stage_of(cr) || '|' || array_to_string(cr.traits, ',') || '|' || coalesce(cr.pedigree->>'from', '-') from creature cr where cr.world_id = w and cr.id = a;
  delete from creature where world_id = w and id = a;

  -- The draw, many times over: a name it does not carry; a mutation a rarity above its best; and the wild table, better
  -- by husbandry.
  perform setseed(0.183);
  for i in 1..${DRAWS} loop
    d := slot_draw(array[${COMMONS.map((id) => `'${id}'`).join(', ')}], 0);
    if d->>'from' = 'mutation' then
      v_mut := v_mut + 1;
      if (select tier from trait_def where id = d->>'id') <> '${nextTier('common')}' then v_bad := v_bad + 1; end if;
    elsif (select tier from trait_def where id = d->>'id') = 'common' then v_common := v_common + 1;
    end if;
    if trait_family(d->>'id') = any(trait_families(array[${COMMONS.map((id) => `'${id}'`).join(', ')}])) then v_bad := v_bad + 1; end if;
    d := slot_draw(array[${COMMONS.map((id) => `'${id}'`).join(', ')}], 100);
    if d->>'from' = 'roll' and (select tier from trait_def where id = d->>'id') = 'common' then v_common100 := v_common100 + 1; end if;
  end loop;
  insert into said values ('DRAWS', v_mut || '|' || v_bad || '|' || v_common || '|' || v_common100);

  -- One put out in the wild at a later stage, and a young one.
  a := creature_spawn(w, 'rabba', ${T + 5} + 0.5, ${T + 5} + 0.5, 'wild', now() - interval '5 hours', null);
  v_n := 0;
  for i in 1..3000 loop
    update creature set skills = jsonb_build_object('foraging', 1), traits = array[${COMMONS.map((id) => `'${id}'`).join(', ')}] where world_id = w and id = a;
    perform wild_stage_put(w, a);
    select * into c from creature where world_id = w and id = a;
    if stage_of(c) > 0 then
      if coalesce(array_length(c.traits, 1), 0) <> stage_slots(stage_of(c)) or c.health <> max_health(c) then v_n := v_n + 1; end if;
      if not exists (select 1 from said where k = 'WILD' || stage_of(c)) then
        insert into said values ('WILD' || stage_of(c), coalesce(array_length(c.traits, 1), 0)::text);
      end if;
    end if;
  end loop;
  insert into said values ('WILDBAD', v_n::text);
  delete from creature where world_id = w and id = a;
  insert into said values ('YOUNG', jsonb_array_length(breed_traits(array['willing'], array['curious'], 50, 1)->'traits')::text);

  -- The once-over: evolved ones short of their slots given them, by the same draw; the rest left as they are.
  v_ids := '{}';
  foreach v_lv in array array[10, ${AT1}, ${AT2}, ${AT2}]::double precision[] loop
    a := creature_spawn(w, 'rabba', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
    update creature set traits = array[${COMMONS.map((id) => `'${id}'`).join(', ')}], rare = null, skills = jsonb_build_object('foraging', v_lv)
     where world_id = w and id = a;
    v_ids := v_ids || a;
  end loop;
  update creature set traits = array[${COMMONS.map((id) => `'${id}'`).join(', ')}, 'thrifty', 'careful'] where world_id = w and id = v_ids[4];
  insert into said values ('OWED', open_missing_slots()::text);
  insert into said select 'GIVEN', string_agg(coalesce(array_length(cr.traits, 1), 0)::text || ':' || array_to_string(cr.traits, '/'), ',' order by cr.id)
    from creature cr where cr.world_id = w and cr.id = any(v_ids);
  insert into said values ('AGAIN', (select count(*) from creature cr join species_def sd on sd.id = cr.species
    where cr.world_id = w and sd.stages is not null and stage_of(cr) > 0 and coalesce(array_length(cr.traits, 1), 0) < stage_slots(stage_of(cr)))::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the table, on both sides ------------------------------------------------------------------------------------ */

// The island's `evo_mul` reads no line's skill on health, growth or work, so that it folds into `max_health` (`folded`).
const UNREAD = ['hardy', 'grow', 'work'];
check('no line\'s skill is on health, growth or work, which the island\'s evo_mul does not look up',
  Object.values(STAGE_PERKS).every((p) => p.kind !== 'blood' || !UNREAD.includes(p.channel as string)),
  Object.entries(STAGE_PERKS).filter(([, p]) => p.kind === 'blood' && UNREAD.includes(p.channel as string)).map(([id]) => id).join(', '));

check('every line that evolves has a third-stage skill of its own, and no other kind has one',
  LINES.every((id) => STAGE_PERKS[id]) && Object.keys(STAGE_PERKS).every((id) => SPECIES[id]?.stages),
  LINES.filter((id) => !STAGE_PERKS[id]).join(', ') || Object.keys(STAGE_PERKS).filter((id) => !SPECIES[id]?.stages).join(', '));
check('each is modest: one more of a thing, a fifth off a rest, a second of stun, or a channel by at most a fifth',
  Object.values(STAGE_PERKS).every((p) => (p.kind === 'blood' ? p.n > 1 && p.n <= 1.2 && !!p.channel : p.kind === 'rest' ? p.n > 0 && p.n <= 0.2 : p.n === 1)));
check(`the island keeps the same table, at stage ${PERK_STAGE + 1}`,
  at('PERKSTAGE') === String(PERK_STAGE) && LINES.every((id) => {
    const p = STAGE_PERKS[id];
    return at(`PERK:${id}`) === `${p.kind}|${p.n}|${p.channel ?? '-'}`;
  }), LINES.filter((id) => at(`PERK:${id}`) !== `${STAGE_PERKS[id].kind}|${STAGE_PERKS[id].n}|${STAGE_PERKS[id].channel ?? '-'}`).map((id) => `${id} ${at(`PERK:${id}`)}`).join('; '));
const wrongAt: string[] = [];
for (const id of LINES) {
  LEVELS.forEach((lv, n) => {
    const c = { species: id, skills: { [levelSkill(SPECIES[id])!]: lv } };
    const mine = `${KINDS.map((k) => perkN(c, k)).join(',')}|${CHANNELS.map((ch) => evoMul(c, ch)).join(',')}|${stageLoads(c)}|${stageOf(c)}`;
    const [ns, muls, loads, stage] = at(`N:${id}:${n}`).split('|');
    const [mns, mmuls, mloads, mstage] = mine.split('|');
    const same = ns.split(',').map(Number).join(',') === mns && muls.split(',').every((v, i) => near(Number(v), Number(mmuls.split(',')[i]))) && loads === mloads && stage === mstage;
    // And below its third stage, nothing of it at all.
    const none = n === 1 || (KINDS.every((k) => perkN(c, k) === 0) && CHANNELS.every((ch) => perkBlood(c, ch) === 1) && stageLoads(c) === STAGE_LOADS[stageOf(c)]);
    if (!same || !none) wrongAt.push(`${id} at ${lv}: island ${at(`N:${id}:${n}`)}, browser ${mine}`);
  });
}
check(`for every line, below its third stage nothing and at it its skill, on both sides alike (${LINES.length} lines)`, !wrongAt.length, wrongAt.slice(0, 4).join('; '));

/* ---- each kind of skill, where it is worked: on the island ------------------------------------------------------ */

const sedra = (lv: number): number => 1 + Math.floor(lv / REED_LEVELS) + perkN({ species: 'sedra', skills: { foraging: lv } }, 'more');
check(`on the island, a reed cutter cuts ${sedra(LEVELS[0])} reeds just below its third stage and ${sedra(LEVELS[1])} at it`,
  at('REED0') === `reed,${sedra(LEVELS[0])}` && at('REED1') === `reed,${sedra(LEVELS[1])}` && sedra(LEVELS[1]) === sedra(LEVELS[0]) + STAGE_PERKS.sedra.n,
  `${at('REED0')} / ${at('REED1')}`);
check(`on the island, a water carrier fills ${STAGE_LOADS[1]} buckets just below its third stage and ${STAGE_LOADS[2] + STAGE_PERKS.holla.n} at it`,
  at('FILL0') === `water_bucket,${STAGE_LOADS[1]}` && at('FILL1') === `water_bucket,${STAGE_LOADS[2] + STAGE_PERKS.holla.n}`, `${at('FILL0')} / ${at('FILL1')}`);
const stoneRest = abilityRest('warder_stoneskin');
check(`on the island, a Zephlet's Stoneskin rests ${stoneRest} seconds below its third stage and ${stoneRest * (1 - STAGE_PERKS.stona.n)} at it`,
  near(Number(at('REST0')), stoneRest, 0.01) && near(Number(at('REST1')), stoneRest * (1 - STAGE_PERKS.stona.n), 0.01), `${at('REST0')} / ${at('REST1')}`);
check(`on the island, a Pebbletooth stuns ${STUN_SECS} seconds below its third stage and ${STUN_SECS + STAGE_PERKS.thumpa.n} at it`,
  near(Number(at('STUN0')), STUN_SECS, 0.05) && near(Number(at('STUN1')), STUN_SECS + STAGE_PERKS.thumpa.n, 0.05), `${at('STUN0')} / ${at('STUN1')}`);
check(`on the island, a full Cloudlet gives ${SHEAR_WOOL} wool below its third stage and ${SHEAR_WOOL + STAGE_PERKS.woola.n} at it`,
  at('WOOL0') === String(SHEAR_WOOL) && at('WOOL1') === String(SHEAR_WOOL + STAGE_PERKS.woola.n), `${at('WOOL0')} / ${at('WOOL1')}`);

/* ---- and in the browser ------------------------------------------------------------------------------------------ */

const g = Game.create(4256);
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
for (let y = T - 8; y <= T + 8; y++) for (let x = T - 8; x <= T + 8; x++) { g.world.setHeight(x, y, 4); g.world.setDirt(x, y, 5); g.world.setTile(x, y, TileType.Grass, 0); }
g.player.x = T + 0.5;
g.player.y = T + 0.5;
g.deed = { name: 'Stagethree', x: T, y: T, radius: 10, level: 1, mine: true };
g.crates.clear();
g.addCrate('plank', T + 1, T, 0, 0, [], true);
g.rand = () => 0.5;
const cr = g.creatures as unknown as Record<string, (...a: unknown[]) => unknown>;
const call = (name: string, ...a: unknown[]): unknown => cr[name].call(g.creatures, ...a);
const yes = (): boolean => true;
const spawn = (sp: string, lv: number, mode: 'deed' | 'active' | 'wild', x = T + 0.5, y = T + 0.5): Creature => {
  const c = g.creatures.spawn(sp, x, y, mode, g.rand, g.time - 3600 * 24 * 30);
  c.traits = [];
  c.rare = 0;
  c.care = 0;
  c.hunger = 1;
  c.stance = 'passive';
  c.skills = { [levelSkill(SPECIES[sp])!]: lv };
  return c;
};
const clear = (): void => { for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id); };

for (let x = T - 2; x <= T + 2; x++) g.world.setTile(x, T + 4, TileType.Reed, 0);
const reeds = LEVELS.map((lv) => {
  const c = spawn('sedra', lv, 'deed', T + 0.5, T + 3.5);
  c.state = 'forage';
  c.until = g.time - 0.1;
  c.workX = T;
  c.workY = T + 4;
  call('updateWorker', c, 0.05, g);
  const got = `${c.carrying?.id},${c.carrying?.count}`;
  clear();
  return got;
});
check(`in the browser, a reed cutter cuts ${sedra(LEVELS[0])} reeds just below its third stage and ${sedra(LEVELS[1])} at it`,
  reeds[0] === `reed,${sedra(LEVELS[0])}` && reeds[1] === `reed,${sedra(LEVELS[1])}`, reeds.join(' / '));

const well = g.addFurniture('well', T + 3, T + 3, 0, 0, 40);
const barrel = g.addFurniture('barrel', T - 3, T, 0, 0, 40);
barrel.litres = 0;
const fills = LEVELS.map((lv) => {
  well.litres = 100;
  const c = spawn('holla', lv, 'deed', T + 3.5, T + 3.5);
  call('waterStep', g, c, 0.05, 20, yes, yes);
  const got = `${c.carrying?.id},${c.carrying?.count}`;
  clear();
  return got;
});
check(`in the browser, a water carrier fills ${STAGE_LOADS[1]} buckets just below its third stage and ${STAGE_LOADS[2] + STAGE_PERKS.holla.n} at it`,
  fills[0] === `water_bucket,${STAGE_LOADS[1]}` && fills[1] === `water_bucket,${STAGE_LOADS[2] + STAGE_PERKS.holla.n}`, fills.join(' / '));

const wild = (id: string, dx: number): Creature => {
  const c = g.creatures.spawn(id, g.player.x + dx, g.player.y, 'wild', g.rand, g.time - 3600 * 24 * 30);
  c.health = 5000;
  return c;
};
const rests = LEVELS.map((lv) => {
  const a = spawn('stona', lv, 'active', g.player.x + 1, g.player.y);
  g.creatures.attack(g, a, wild('ulva', 2));
  const left = (a.marks?.ability?.until ?? g.time) - g.time;
  clear();
  return left;
});
check(`in the browser, a Zephlet's Stoneskin rests ${stoneRest} seconds below its third stage and ${stoneRest * (1 - STAGE_PERKS.stona.n)} at it`,
  near(rests[0], stoneRest) && near(rests[1], stoneRest * (1 - STAGE_PERKS.stona.n)), rests.join(' / '));
const stuns = LEVELS.map((lv) => {
  const a = spawn('thumpa', lv, 'active', g.player.x + 1, g.player.y);
  const t = wild('ulva', 1.5);
  for (let n = 0; n < HEAVY_EVERY; n++) g.creatures.attack(g, a, t);
  const left = (t.stunUntil ?? g.time) - g.time;
  clear();
  return left;
});
check(`in the browser, a Pebbletooth stuns ${STUN_SECS} seconds below its third stage and ${STUN_SECS + STAGE_PERKS.thumpa.n} at it`,
  near(stuns[0], STUN_SECS) && near(stuns[1], STUN_SECS + STAGE_PERKS.thumpa.n), stuns.join(' / '));
const shear = ACTION_BY_ID.get('shear')!;
g.inventory.add('carving_knife', { ql: 40 });
const wool = LEVELS.map((lv) => {
  for (const it of g.inventory.items.filter((i) => i.id === 'wool')) g.inventory.remove(it.uid, it.count);
  const c = spawn('woola', lv, 'active', g.player.x, g.player.y - 1);
  c.fleece = 1;
  shear.perform!({ kind: 'creature', id: c.id }, g);
  clear();
  return g.inventory.items.filter((i) => i.id === 'wool').reduce((n, i) => n + i.count, 0);
});
check(`in the browser, a full Cloudlet gives ${SHEAR_WOOL} wool below its third stage and ${SHEAR_WOOL + STAGE_PERKS.woola.n} at it`,
  wool[0] === SHEAR_WOOL && wool[1] === SHEAR_WOOL + STAGE_PERKS.woola.n, wool.join(' / '));
const blows = LEVELS.map((lv) => {
  const a = spawn('rowl', lv, 'active');
  const b = attackOf(a, SPECIES.rowl);
  clear();
  return b;
});
check(`a Snarepup's blow at its third stage is ${percent(STAGE_PERKS.rowl.n - 1)} over its stage's alone, the same on both sides`,
  near(blows[1], SPECIES.rowl.attack * STAGE_MUL.tough! ** 2 * STAGE_PERKS.rowl.n) && near(blows[0], SPECIES.rowl.attack * STAGE_MUL.tough!)
    && near(Number(at('BLOW0')), blows[0]) && near(Number(at('BLOW1')), blows[1]), `${blows.join(' / ')} island ${at('BLOW0')} / ${at('BLOW1')}`);

/* ---- the words ---------------------------------------------------------------------------------------------------- */

const said = LINES.filter((id) => {
  const d = SPECIES[id];
  return !d.stages![1].description.includes(`${perkLine(id)}.`) || d.stages![0].description.includes(' skill: ') || d.description.includes(' skill: ');
});
check('each line\'s third-stage words say its skill, and its first and second stages\' do not', !said.length, said.join(', '));
const numbers = LINES.filter((id) => {
  const p = STAGE_PERKS[id];
  const isl = Number(at(`PERK:${id}`).split('|')[1]);
  const s = perkSays(id);
  if (p.kind === 'blood') return !s.endsWith(`+${percent(isl - 1)}`);
  if (p.kind === 'rest') return !s.includes(`−${percent(isl)}`) || !s.includes(`${abilityRest(SPECIES[id].ability!)} to ${+(abilityRest(SPECIES[id].ability!) * (1 - isl)).toFixed(1)} seconds`);
  if (p.kind === 'stun') return !s.includes(`+${isl} `) || !s.includes(`${STUN_SECS} to ${STUN_SECS + isl}`);
  return !s.endsWith(`+${isl}`);
});
check('and its number in them is the island\'s', !numbers.length, numbers.map((id) => `${id}: ${perkSays(id)}`).join('; '));
const loadWords = LINES.filter((id) => STAGE_PERKS[id].kind === 'loads')
  .filter((id) => !SPECIES[id].stages![1].description.includes(String(stageLoads({ species: id, skills: { [levelSkill(SPECIES[id])!]: AT2 } }))));
check('a line that carries more at once says how many it carries at its third stage, its own skill counted', !loadWords.length, loadWords.join(', '));
const pages = LINES.filter((id) => {
  const page = (stage: number): string => guidePage(SPECIES[id], true, stage).flatMap((s) => s.lines).join('\n');
  return !page(PERK_STAGE).includes(perkLine(id)) || page(PERK_STAGE - 1).includes(perkLine(id))
    || !page(1).includes(`Trait slots: ${stageSlots(1)}`) || !page(2).includes(`Trait slots: ${stageSlots(2)}`);
});
check('the Field guide\'s third-stage page says the skill and the second\'s does not; each says its trait slots', !pages.length, pages.join(', '));
const help = helpText();
check('the help names every line\'s skill, and the slots by stage', LINES.every((id) => help.includes(perkSays(id))) && help.includes(`${stageSlots(1)} from level ${AT1}`)
  && help.includes(`${stageSlots(2)} from level ${AT2}`));
const card = readFileSync('src/ui/panels/wildermon.ts', 'utf8');
check('the wildermon card says the skill once it has it', card.includes('if (stagePerk(c)) parts.push(perkLine(c.species));'));

/* ---- slots ------------------------------------------------------------------------------------------------------- */

check(`trait slots by stage: ${[0, 1, 2].map(stageSlots).join(', ')}, the same on both sides`,
  at('SLOTS') === `${stageSlots(0)},${stageSlots(1)},${stageSlots(2)},${SLOTS_PER_STAGE}` && stageSlots(0) === TRAIT_SLOTS && stageSlots(1) === TRAIT_SLOTS + 1 && stageSlots(2) === TRAIT_SLOTS + 2,
  at('SLOTS'));
const evolved = (k: string, stage: number): boolean => {
  const [st = '', traits = '', from = '{}'] = at(k).split('|');
  if (!from.startsWith('{')) return false;
  const ids = traits.split(',');
  const fams = new Set(ids.map((id) => traitOf(id)?.family ?? id));
  const was = JSON.parse(from) as Record<string, string>;
  const added = ids.slice(COMMONS.length);
  return st === String(stage) && ids.length === stageSlots(stage) && fams.size === ids.length && ids.every((id) => traitOf(id))
    && ids.slice(0, COMMONS.length).join(',') === COMMONS.join(',') && added.every((id) => was[id] === 'roll' || was[id] === 'mutation');
};
check(`on the island, one evolving into its second stage gains a trait (${COMMONS.length} to ${stageSlots(1)}), a name it does not carry, its pedigree saying where it came from`,
  at('BEFORE') === String(COMMONS.length) && evolved('EVOLVED1', 1), at('EVOLVED1'));
check('and learning inside the stage opens nothing', at('INSIDE') === String(stageSlots(1)), at('INSIDE'));
check(`and into its third, another (${stageSlots(2)})`, evolved('EVOLVED2', 2), at('EVOLVED2'));
const [mut, wrongDraws, common0, common100] = at('DRAWS').split('|').map(Number);
check(`on the island, a slot's draw is never a name it carries, a mutation is a rarity above its best, about 1 in ${MUTATION_ODDS}`,
  wrongDraws === 0 && mut > DRAWS / MUTATION_ODDS / 3 && mut < (DRAWS / MUTATION_ODDS) * 2.5, `${mut} mutations in ${DRAWS}, ${wrongDraws} wrong`);
check('and the rest off the wild table, less of it common with husbandry', common100 < common0 && common0 > DRAWS * 0.7, `${common0} common at nought, ${common100} at a hundred`);
check('on the island, one put out in the wild at its second or third stage has its stage\'s slots, and is as big as it',
  at('WILDBAD') === '0' && at('WILD1') === String(stageSlots(1)) && [String(stageSlots(2)), '(not said)'].includes(at('WILD2')), `${at('WILD1')} / ${at('WILD2')}, ${at('WILDBAD')} wrong`);
check(`and a young one is still born with ${TRAIT_SLOTS}`, at('YOUNG') === String(TRAIT_SLOTS), at('YOUNG'));
{
  const given = at('GIVEN').split(',').map((s) => s.split(':')).map(([n = '', ids = '']) => [n, ids]);
  const counts = given.map(([n]) => Number(n));
  check(`the once-over gives an evolved one short of its slots what it is missing, and leaves the rest (${[0, 1, 2, 2].map(stageSlots).join(', ')})`,
    counts.join(',') === [stageSlots(0), stageSlots(1), stageSlots(2), stageSlots(2)].join(',') && given[3][1] === [...COMMONS, 'thrifty', 'careful'].join('/')
      && given.every(([, ids]) => new Set(ids.split('/').map((id) => traitOf(id)?.family ?? id)).size === ids.split('/').length)
      && at('AGAIN') === '0' && Number(at('OWED')) >= 3,
    `${at('GIVEN')}; ${at('OWED')} given, ${at('AGAIN')} still short`);
}
const migration = readdirSync('supabase/migrations').filter((f) => f.endsWith('_stage_three_skills_and_trait_slots.sql'))
  .map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('');
check('and the migration runs it once over the island', /^select open_missing_slots\(\);$/m.test(migration));

// In the browser.
{
  const c = spawn('rabba', AT1 - 0.0001, 'deed');
  c.traits = [...COMMONS];
  c.pedigree = { dam: { id: 0, name: '' }, sire: { id: 0, name: '' }, from: {} } as unknown as Creature['pedigree'];
  for (let n = 0; n < 50 && stageOf(c) === 0; n++) g.creatures.gainSkill(g, c, 'foraging', 5);
  const one = [...c.traits];
  g.creatures.gainSkill(g, c, 'foraging', 5);
  const inside = c.traits.length;
  c.skills.foraging = AT2 - 0.0001;
  for (let n = 0; n < 50 && stageOf(c) < 2; n++) g.creatures.gainSkill(g, c, 'foraging', 5);
  const fams = new Set(c.traits.map((id) => traitOf(id)?.family ?? id));
  check(`in the browser, one gains a trait evolving into each stage (${COMMONS.length}, ${stageSlots(1)}, ${stageSlots(2)}), none inside one, names it does not carry`,
    one.length === stageSlots(1) && inside === stageSlots(1) && c.traits.length === stageSlots(2) && fams.size === c.traits.length
      && c.traits.slice(COMMONS.length).every((id) => ['roll', 'mutation'].includes(c.pedigree?.from[id] ?? '')),
    `${one.join(',')} / ${c.traits.join(',')}`);
  clear();
}
{
  g.rand = seededRand(20261022);
  let wrong = 0;
  const seen = [0, 0, 0];
  for (let i = 0; i < 3000; i++) {
    const c = g.creatures.standWild(g, 'rabba', g.player.x + 20, g.player.y + 20);
    seen[stageOf(c)]++;
    if (c.traits.length !== stageSlots(stageOf(c)) || c.health !== maxHealth(c, SPECIES.rabba)) wrong++;
    g.creatures.list.delete(c.id);
  }
  check('in the browser, one put out in the wild has its stage\'s slots, at every stage', wrong === 0 && seen[1] > 0, `${seen.join('|')}, ${wrong} wrong`);
  const rand = seededRand(183);
  let m = 0;
  let wrongs = 0;
  const tiers: Record<TraitTier, number> = { common: 0, rare: 0, supreme: 0, fantastic: 0 };
  let common100 = 0;
  for (let i = 0; i < DRAWS; i++) {
    const d = slotDraw([...COMMONS], 0, rand)!;
    if (d.from === 'mutation') {
      m++;
      if (traitTier(d.id) !== nextTier('common')) wrongs++;
    } else tiers[traitTier(d.id)]++;
    if (COMMONS.some((id) => (traitOf(id)?.family ?? id) === (traitOf(d.id)?.family ?? d.id))) wrongs++;
    const h = slotDraw([...COMMONS], 100, rand)!;
    if (h.from === 'roll' && traitTier(h.id) === 'common') common100++;
  }
  check(`in the browser, the same draw: no name it carries, a mutation a rarity above its best about 1 in ${MUTATION_ODDS}, less common with husbandry`,
    wrongs === 0 && m > DRAWS / MUTATION_ODDS / 3 && m < (DRAWS / MUTATION_ODDS) * 2.5 && common100 < tiers.common && tiers.common > DRAWS * 0.7,
    `${m} mutations, ${TIERS.map((t) => `${t} ${tiers[t]}`).join(' ')}, ${common100} common at a hundred, ${wrongs} wrong`);
  check(`and a young one is still born with ${TRAIT_SLOTS}`, breedTraits(['willing'], ['curious'], 50, 1, rand).traits.length === TRAIT_SLOTS);
  g.rand = () => 0.5;
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na skill at the third stage, a slot at each — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
