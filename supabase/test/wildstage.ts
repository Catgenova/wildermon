/**
 * Evolved wildermon in the wild, rarely.
 *
 * Asked for: "When a wild one of an evolving kind is spawned, one time in
 * WILD_STAGE_ODDS[0] = 20 it comes in at stage 2 (its level set to a random
 * level in [EVOLVE_AT[0], EVOLVE_AT[1]) on its work/level skill), and one time
 * in WILD_STAGE_ODDS[1] = 200 at stage 3 (level in [EVOLVE_AT[1],
 * EVOLVE_AT[1]+10)). It is named by its stage ..., drawn at its stage, has the
 * stage's stat multipliers", and "Taming it is harder: the taming skill it
 * needs is tameLevel + WILD_STAGE_TAME (= 15) per stage above the first, and
 * its tame chance is tameChance × WILD_STAGE_CHANCE (= 0.5) per stage."
 *
 * Asked of both sides:
 *
 *   * the numbers are the ones asked for, and the island's are the browser's;
 *   * one roll decides the stage, the same way on both sides at every roll
 *     (`wildStageRoll`, `wild_stage_roll`), and never for a kind that does
 *     not evolve;
 *   * put out in numbers, about one in twenty comes in at its second stage and
 *     one in two hundred at its third, and each such one is at a level in its
 *     stage's span on the skill its level is, called by its stage's name and
 *     as big as that stage (`standWild`, `wild_stage_put`);
 *   * the island's stocking puts them out through it, and still puts out as
 *     many as before;
 *   * what it takes to tame one is its kind's and so much more for each stage
 *     past its first, on both sides alike, and an offering's chance and a
 *     refusal read it (`tameNeeds`, `tame_needs`, `tameChance`, `tame_chance`);
 *   * and the island tells a browser a wild one's skills, so it is named and
 *     drawn at its stage there.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { tameChance } from '../../src/game/creatureActions';
import {
  EVOLVE_AT, kindName, levelSkill, maxHealth, SPECIES, stageLevels, stageOf, tameNeeds, WILD_STAGE_CHANCE, WILD_STAGE_ODDS,
  WILD_STAGE_SPAN, WILD_STAGE_TAME, wildStageRoll, type Creature, type IslandCreature,
} from '../../src/game/creatures';

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

/** A seeded roll, so a count here is the same count every time. */
const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const KIND = 'sedra';
const def = SPECIES[KIND];
const SKILL = levelSkill(def)!;
const STILL = 'dowse';
const ROLLS = [0, 0.001, 1 / WILD_STAGE_ODDS[1] - 1e-9, 1 / WILD_STAGE_ODDS[1], 0.03, 1 / WILD_STAGE_ODDS[1] + 1 / WILD_STAGE_ODDS[0] - 1e-9,
  1 / WILD_STAGE_ODDS[1] + 1 / WILD_STAGE_ODDS[0], 0.5, 0.999];
const N = 20000;
/** Dice forced on the island, each with the stage and level they make. */
const DICE: Array<[number, number, number]> = [
  [0.004, 2, stageLevels(2)[0] + 0.004 * (stageLevels(2)[1] - stageLevels(2)[0])],
  [0.03, 1, stageLevels(1)[0] + 0.03 * (stageLevels(1)[1] - stageLevels(1)[0])],
  [0.5, 0, 1],
];
const TAMING = 40;

/* ---- the asked-for numbers ------------------------------------------------------------------- */

check(`one time in ${WILD_STAGE_ODDS[0]} at its second stage and one in ${WILD_STAGE_ODDS[1]} at its third, ${WILD_STAGE_TAME} more taming and ×${WILD_STAGE_CHANCE} the chance a stage, as asked`,
  WILD_STAGE_ODDS[0] === 20 && WILD_STAGE_ODDS[1] === 200 && WILD_STAGE_TAME === 15 && WILD_STAGE_CHANCE === 0.5 && WILD_STAGE_SPAN === 10);
check(`a second stage spans [${stageLevels(1).join(', ')}) and a third [${stageLevels(2).join(', ')}), as asked`,
  stageLevels(1)[0] === EVOLVE_AT[0] && stageLevels(1)[1] === EVOLVE_AT[1] && stageLevels(2)[0] === EVOLVE_AT[1] && stageLevels(2)[1] === EVOLVE_AT[1] + 10);

/* ---- on the island --------------------------------------------------------------------------- */

const U = '7e5b0000-0000-4000-8000-0000000000c3';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
begin
  return current_setting('wurm.dice')::double precision;
end $f$;
do $t$
declare w uuid; u uuid := '${U}'; c creature; a int; s int; i int; n int[] := array[0, 0, 0]; v_lv double precision; v_bad int := 0;
        v_stocked int; v_wild int; v_wrong int; v_got jsonb; px double precision; py double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Wildstage', 222, 64, 30, 30, true) returning id into w;
  perform land_blank(w, 64);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 63) x, generate_series(0, 63) y;
  -- Above the water, so the stocking has somewhere to put things.
  perform land_set_height(w, x, y, 10) from generate_series(0, 64) x, generate_series(0, 64) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Tamer');
  select x, y into px, py from player where world_id = w and uid = u;
  insert into said values ('NUMBERS', wild_stage_odds_1() || '|' || wild_stage_odds_2() || '|' || wild_stage_tame() || '|' || wild_stage_chance() || '|' || wild_stage_span());
  insert into said values ('SKILL', level_skill('${KIND}'));
  insert into said select 'ROLL', string_agg(wild_stage_roll('${KIND}', r) || ':' || wild_stage_roll('${STILL}', r), ',' order by o)
    from unnest(array[${ROLLS.join(', ')}]::double precision[]) with ordinality as t(r, o);

  -- The dice forced: each makes the stage and the level it says.
${DICE.map(([d], k) => `
  a := creature_spawn(w, '${KIND}', px + 3, py + 3, 'wild', now() - interval '15 hours', null);
  update creature set traits = '{}', rare = null where world_id = w and id = a returning * into c;
  update creature set health = max_health(c) where world_id = w and id = a;
  perform set_config('wurm.dice', '${d}', true); perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform wild_stage_put(w, a);
  perform set_config('search_path', '"$user", public', true);
  select * into c from creature where world_id = w and id = a;
  insert into said values ('DICE:${k}', stage_of(c) || '|' || (c.skills->>'${SKILL}') || '|' || c.name || '|' || kind_name_at(c) || '|' || (c.health = max_health(c))
    || '|' || (tame_needs(c)).level || '|' || (tame_needs(c)).chance);`).join('')}
  -- Never a kind that does not evolve, nor one that is somebody's.
  a := creature_spawn(w, '${STILL}', px + 3, py + 4, 'wild', now() - interval '15 hours', null);
  perform set_config('wurm.dice', '0.001', true); perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform wild_stage_put(w, a);
  s := creature_spawn(w, '${KIND}', px + 4, py + 4, 'active', now() - interval '15 hours', u);
  perform wild_stage_put(w, s);
  perform set_config('search_path', '"$user", public', true);
  insert into said select 'STILL', string_agg(cr.species || ':' || creature_level(cr.skills) || ':' || cr.name, ',' order by cr.id) from creature cr where cr.world_id = w and cr.id in (a, s);
  delete from creature where world_id = w and id = s;

  -- In numbers, at the island's own dice.
  perform setseed(0.222);
  a := creature_spawn(w, '${KIND}', px + 5, py + 5, 'wild', now() - interval '15 hours', null);
  for i in 1..${N} loop
    update creature set skills = jsonb_build_object('${SKILL}', 1), name = '${def.name}' where world_id = w and id = a;
    perform wild_stage_put(w, a);
    select * into c from creature where world_id = w and id = a;
    n[stage_of(c) + 1] := n[stage_of(c) + 1] + 1;
    v_lv := (c.skills->>'${SKILL}')::double precision;
    if stage_of(c) = 1 and not (v_lv >= ${stageLevels(1)[0]} and v_lv < ${stageLevels(1)[1]} and c.name = '${def.stages![0].name}') then v_bad := v_bad + 1; end if;
    if stage_of(c) = 2 and not (v_lv >= ${stageLevels(2)[0]} and v_lv < ${stageLevels(2)[1]} and c.name = '${def.stages![1].name}') then v_bad := v_bad + 1; end if;
  end loop;
  insert into said values ('RATE', array_to_string(n, '|') || '|' || v_bad);
  delete from creature where world_id = w and id = a;

  -- Taming at each stage: what it asks, the chance at taming ${TAMING}, and the refusal at the kind's own.
  insert into skill (world_id, uid, id, value) values (w, u, 'taming', ${TAMING})
    on conflict (world_id, uid, id) do update set value = excluded.value;
  for i in 0..2 loop
    a := creature_spawn(w, '${KIND}', px + 1, py, 'wild', now() - interval '15 hours', null);
    update creature set traits = '{}', rare = null, hunger = 0.9,
        skills = jsonb_build_object('${SKILL}', case i when 0 then 1 when 1 then ${EVOLVE_AT[0]} else ${EVOLVE_AT[1]} end)
      where world_id = w and id = a returning * into c;
    insert into said values ('NEEDS:' || i, (tame_needs(c)).level || '|' || (tame_needs(c)).chance || '|' || tame_chance(w, u, c));
    update skill set value = ${def.tameLevel} where world_id = w and uid = u and id = 'taming';
    insert into said values ('REFUSE:' || i, coalesce(creature_refusal(w, u, 'tame', jsonb_build_object('kind', 'creature', 'id', a)), '-'));
    update skill set value = ${TAMING} where world_id = w and uid = u and id = 'taming';
    delete from creature where world_id = w and id = a;
  end loop;

  -- The stocking puts them out through it, as many as before, each one named and as big as its stage: a block's, and the whole island's.
  delete from creature where world_id = w;
  delete from world_stocked where world_id = w;
  v_stocked := creature_stock_block(w, 0, 0);
  select count(*) into v_wild from creature where world_id = w and mode = 'wild';
  select count(*) into v_wrong from creature cr join species_def sd on sd.id = cr.species
   where cr.world_id = w and sd.stages is not null and (cr.name <> kind_name_at(cr) or cr.health <> max_health(cr));
  insert into said values ('STOCK:block', v_stocked || '|' || v_wild || '|' || wild_floor() || '|' || v_wrong);
  delete from creature where world_id = w;
  v_stocked := creature_stock(w);
  select count(*) into v_wild from creature where world_id = w and mode = 'wild';
  select count(*) into v_wrong from creature cr join species_def sd on sd.id = cr.species
   where cr.world_id = w and sd.stages is not null and (cr.name <> kind_name_at(cr) or cr.health <> max_health(cr));
  insert into said values ('STOCK:all', v_stocked || '|' || v_wild || '|' || creature_target(w) || '|' || v_wrong);
  insert into said values ('PATCHED', (select count(*) from pg_proc p where p.proname in ('creature_stock', 'creature_stock_block') and p.prosrc like '%wild_stage_put(p_world, creature_spawn(%')::text);

  -- And a browser is told a wild one's skills.
  delete from creature where world_id = w;
  a := creature_spawn(w, '${KIND}', px + 2, py, 'wild', now() - interval '15 hours', null);
  perform set_config('wurm.dice', '0.03', true); perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform wild_stage_put(w, a);
  perform set_config('search_path', '"$user", public', true);
  select e into v_got from jsonb_array_elements(rpc_creatures(w)) e where (e->>'id')::int = a;
  insert into said values ('SENT', coalesce(v_got->>'name', '-') || '|' || coalesce(v_got->'skills'->>'${SKILL}', '-'));
  insert into said values ('ROW', v_got::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('the island has the browser\'s numbers', at('NUMBERS') === `${WILD_STAGE_ODDS[0]}|${WILD_STAGE_ODDS[1]}|${WILD_STAGE_TAME}|${WILD_STAGE_CHANCE}|${WILD_STAGE_SPAN}`, at('NUMBERS'));
check(`the skill a ${def.name}'s level is, the same on both sides`, at('SKILL') === SKILL, `${SKILL} / ${at('SKILL')}`);
const rolled = ROLLS.map((r) => `${wildStageRoll(def, r)}:${wildStageRoll(SPECIES[STILL], r)}`).join(',');
check('one roll makes the same stage on both sides at every roll, and always the first for a kind that does not evolve', at('ROLL') === rolled, `browser ${rolled}, island ${at('ROLL')}`);
for (const [k, [d, stage, level]] of DICE.entries()) {
  const [st, lv, name, kname, full, needLv, needCh] = at(`DICE:${k}`).split('|');
  const want = tameNeeds({ species: KIND, skills: { [SKILL]: level } });
  check(`on the island a roll of ${d} puts it out at stage ${stage + 1}: level ${level.toFixed(2)} on ${SKILL}, called ${stage ? def.stages![stage - 1].name : def.name}, as big as that, and as hard to tame as the browser says`,
    Number(st) === stage && near(Number(lv), level) && name === kname && name === (stage ? def.stages![stage - 1].name : def.name) && full === 'true'
      && near(Number(needLv), want.level) && near(Number(needCh), want.chance), at(`DICE:${k}`));
}
check('never a kind that does not evolve, nor one that is somebody\'s', at('STILL') === `${STILL}:1:${SPECIES[STILL].name},${KIND}:1:${def.name}`, at('STILL'));
{
  const [s0, s1, s2, wrong] = at('RATE').split('|').map(Number);
  check(`on the island, ${N} put out: about one in ${WILD_STAGE_ODDS[0]} at its second stage and one in ${WILD_STAGE_ODDS[1]} at its third, each at a level in its span and called by it`,
    s0 + s1 + s2 === N && Math.abs(s1 - N / WILD_STAGE_ODDS[0]) < 0.15 * N / WILD_STAGE_ODDS[0] && Math.abs(s2 - N / WILD_STAGE_ODDS[1]) < 0.35 * N / WILD_STAGE_ODDS[1] && wrong === 0,
    at('RATE'));
}
for (const k of ['block', 'all']) {
  const [stocked, wild, target, wrong] = at(`STOCK:${k}`).split('|').map(Number);
  // A block throws only so many darts a head (`creature_stock_block`), so on this little island it may fall short of its floor.
  check(`${k === 'block' ? 'a block\'s stocking still puts out what it places, up to what it is owed' : 'the whole island\'s stocking still puts out as much as it is owed'}, every one of a kind that evolves named and as big as its stage`,
    stocked === wild && wild > 0 && (k === 'block' ? wild <= target : wild === target) && wrong === 0, at(`STOCK:${k}`));
}
check('and both stockings put them out through the roll', at('PATCHED') === '2', at('PATCHED'));
check(`a browser is told a wild one's skills, so it names and draws it at its stage`,
  at('SENT').split('|')[0] === def.stages![0].name && stageOf({ species: KIND, skills: { [SKILL]: Number(at('SENT').split('|')[1]) } }) === 1, at('SENT'));

/* ---- the browser ----------------------------------------------------------------------------- */

// What the island said of a wild one, as a browser on it takes it: named, drawn and asking at its stage.
{
  const heard = Game.create(2225);
  for (const c of [...heard.creatures.list.values()]) heard.creatures.remove(c.id);
  heard.creatures.fromIsland = true;
  const row = JSON.parse(at('ROW')) as IslandCreature;
  heard.creatures.sawAll([row], heard.time);
  const c = heard.creatures.get(row.id);
  check('a browser on the island takes a wild one at its stage: its name, its stage and what taming it asks',
    !!c && c.name === def.stages![0].name && kindName(c) === c.name && stageOf(c) === 1 && tameNeeds(c).level === def.tameLevel + WILD_STAGE_TAME,
    c ? `${c.name} ${kindName(c)} ${stageOf(c)} ${tameNeeds(c).level}` : 'not heard');
}

const game = Game.create(2222);
for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
game.rand = seeded(20261020);
const px = game.player.x, py = game.player.y;
const got = [0, 0, 0];
let wrong = 0;
const one: Array<Creature | undefined> = [undefined, undefined, undefined];
for (let i = 0; i < N; i++) {
  const c = game.creatures.standWild(game, KIND, px + 20, py + 20);
  const stage = stageOf(c);
  got[stage]++;
  if (stage) {
    const [lo, hi] = stageLevels(stage);
    const lv = c.skills[SKILL];
    if (!(lv >= lo && lv < hi) || c.name !== def.stages![stage - 1].name || kindName(c) !== c.name || c.health !== maxHealth(c, def)) wrong++;
  }
  one[stage] ??= c;
  game.creatures.list.delete(c.id);
}
check(`in a game of your own, ${N} put out: about one in ${WILD_STAGE_ODDS[0]} at its second stage and one in ${WILD_STAGE_ODDS[1]} at its third, each at a level in its span, called by it and as big as it`,
  Math.abs(got[1] - N / WILD_STAGE_ODDS[0]) < 0.15 * N / WILD_STAGE_ODDS[0] && Math.abs(got[2] - N / WILD_STAGE_ODDS[1]) < 0.35 * N / WILD_STAGE_ODDS[1] && wrong === 0,
  `${got.join('|')}, ${wrong} wrong`);
let still = 0;
for (let i = 0; i < 2000; i++) {
  const c = game.creatures.standWild(game, STILL, px + 20, py + 20);
  if (stageOf(c) || c.skills[levelSkill(SPECIES[STILL]) ?? ''] !== 1) still++;
  game.creatures.list.delete(c.id);
}
check('and a kind that does not evolve never does', still === 0, `${still}`);
check('a second-stage one is bigger and hits harder than one at its first, as one that evolved is',
  !!one[0] && !!one[1] && maxHealth(one[1], def) > maxHealth({ ...one[1], skills: { [SKILL]: 1 } } as Creature, def));

// Taming at each stage, on both sides.
for (let i = 0; i < 3; i++) {
  const level = [1, EVOLVE_AT[0], EVOLVE_AT[1]][i];
  const c = game.creatures.spawn(KIND, px + 1, py, 'wild', game.rand, 0);
  c.traits = [];
  c.rare = 0;
  c.hunger = 0.9;
  c.skills = { [SKILL]: level };
  c.name = kindName(c);
  const needs = tameNeeds(c);
  game.skills.values.set('taming', TAMING);
  const chance = tameChance(game, c);
  game.skills.values.set('taming', def.tameLevel);
  const refusal = ACTION_BY_ID.get('tame')?.check?.({ kind: 'creature', id: c.id } as Target, game) ?? null;
  const [lv, ch, isleChance] = at(`NEEDS:${i}`).split('|').map(Number);
  check(`at stage ${i + 1} taming it asks ${def.tameLevel} + ${WILD_STAGE_TAME * i} = ${needs.level} at a base ${(needs.chance * 100).toFixed(1)}%, the same on both sides`,
    needs.level === def.tameLevel + WILD_STAGE_TAME * i && near(needs.chance, def.tameChance * WILD_STAGE_CHANCE ** i) && near(lv, needs.level) && near(ch, needs.chance),
    at(`NEEDS:${i}`));
  check(`and an offering at taming ${TAMING} is ${(chance * 100).toFixed(2)}% on both sides`, near(chance, isleChance, 1e-5), `browser ${chance}, island ${isleChance}`);
  const want = i ? `Need taming ${needs.level}.` : null;
  const isleRefusal = at(`REFUSE:${i}`);
  check(`at the kind's own taming, ${i ? 'it is refused, saying what it asks' : 'a first-stage one is not refused for its taming'}, on both sides`,
    i ? refusal === want && isleRefusal === want : !String(refusal ?? '').startsWith('Need taming') && !isleRefusal.startsWith('Need taming'),
    `browser ${refusal}, island ${isleRefusal}`);
  game.creatures.remove(c.id);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
if (bad.length) process.exit(1);
