/**
 * Climbing in the traces at a Wagonox's rate, and level and evolution off a kind's own level skill.
 *
 * Asked of "My monolithumps are leveling up quickly while driving wagon, while my Wagonox levels up slowly": a Chiptail
 * in a wagon's traces learned climbing at 0.05 a flat tile against the 0.003 a Wagonox learns driving at, and a
 * creature's level was the highest of all its skills, so a Chiptail evolved by hauling alone. Now a tile pulled
 * teaches climbing at the base a tile teaches a kind that learns its own skill by pulling (`HAUL_LEARN`, `PULL_LEARN`),
 * a steeper step proportionally more; and a creature's level, and its stage, are its level skill's (`creatureLevel`,
 * `levelSkill`), the highest of its skills only for a kind with none.
 *
 * Asks, on both sides: that the rule and its numbers are the same; that a Chiptail and a Wagonox driven over the same
 * flat tiles in a wagon's traces learn climbing and driving at the same base a tile, the Wagonox's times its own pace
 * (pinned roll in the browser, its bounds on the island); that a steeper step pays more; that a Chiptail with climbing
 * 60 and mining 5 is level 5 and at its first stage; that the migration's one-off step keeps one that was at its third
 * stage by climbing at its third stage, and leaves be one its level skill already holds there; and that a kind with
 * no level skill is still at its highest skill.
 *
 * Runs against the database the suite leaves behind: Faraway, and Ivar on it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Game } from '../../src/game/game';
import {
  creatureLevel, EVOLVE_AT, HAUL_LEARN, HAUL_LEARN_RISE, HAUL_LEARN_STEEP, HAUL_SKILL, HAUL_STEEP_AT, HAUL_STEEP_TIMES, haulLearn, LEARN_PACE,
  learnPace, levelSkill, PULL_LEARN, SPECIES, stageOf, workSkill, type Creature,
} from '../../src/game/creatures';
import { PLACEABLE_ACTION_BY_ID } from '../../src/game/placeables';
import { skillGain } from '../../src/game/skills';
import { DRIVING } from '../../src/game/travel';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number, eps = 1e-12): boolean => Math.abs(a - b) <= eps;

const MINING = workSkill(SPECIES.quarra)!;

/* ---- the rule, on both sides ---------------------------------------------- */

check('a flat tile in the traces teaches climbing at a Wagonox\'s base a tile pulled', HAUL_LEARN === PULL_LEARN, `${HAUL_LEARN} vs ${PULL_LEARN}`);
check(`a step of ${HAUL_STEEP_AT} or more teaches ${1 + HAUL_STEEP_TIMES} flat tiles' worth, as before (0.55 against 0.05)`,
  near(haulLearn(HAUL_STEEP_AT) / haulLearn(0), 0.55 / 0.05, 1e-9) && near(haulLearn(100), haulLearn(HAUL_STEEP_AT)),
  `${haulLearn(0)} flat, ${haulLearn(HAUL_STEEP_AT)} at ${HAUL_STEEP_AT}`);
const RISES = [0, 1, 5, 12, 30, -5];
const rule = psql(`select haul_learn() || '|' || haul_learn_steep() || '|' || haul_learn_rise() || '|' || learns_gain_pull() || '|'
  || (select string_agg(haul_learn_of(r)::text, ',' order by o) from unnest(array[${RISES.join(',')}]::double precision[]) with ordinality t(r, o))
  || '|' || (select pace from learn_pace_def where id = 'pull')`);
const [hl, hs, hr, pull, of, pace] = rule.split('|');
check('haul_learn, haul_learn_steep, haul_learn_rise and learns_gain_pull are the browser\'s on the island',
  Number(hl) === HAUL_LEARN && Number(hs) === HAUL_LEARN_STEEP && Number(hr) === HAUL_LEARN_RISE && Number(pull) === PULL_LEARN
    && Number(pace) === LEARN_PACE.pull, rule);
check(`haul_learn_of is haulLearn at rises ${RISES.join(', ')}, and a steeper step pays more`,
  of.split(',').every((v, i) => near(Number(v), haulLearn(RISES[i]))) && haulLearn(5) > haulLearn(1) && haulLearn(1) > haulLearn(0),
  `${of} vs ${RISES.map(haulLearn).join(',')}`);

// Every kind's level skill the same on both sides.
const isleSkills = new Map(psql(`select id || '=' || coalesce(level_skill(id), '-') from species_def`).split('\n')
  .map((l) => l.split('=') as [string, string]));
const differ = [...isleSkills].filter(([id, s]) => SPECIES[id] && (levelSkill(SPECIES[id]) ?? '-') !== s);
check('every kind\'s level skill is the same on the island as in the browser', isleSkills.size > 50 && differ.length === 0,
  differ.map(([id, s]) => `${id}: island ${s}, browser ${levelSkill(SPECIES[id])}`).join('; '));

/* ---- level and evolution, in the browser ----------------------------------- */

const chiptail = { species: 'quarra', skills: { [HAUL_SKILL]: 60, [MINING]: 5 } };
check('in the browser a Chiptail with climbing 60 and mining 5 is level 5 and at its first stage',
  creatureLevel(chiptail) === 5 && stageOf(chiptail) === 0, `level ${creatureLevel(chiptail)}, stage ${stageOf(chiptail)}`);
check(`in the browser its mining at ${EVOLVE_AT[1]} is its third stage`,
  stageOf({ species: 'quarra', skills: { [HAUL_SKILL]: 1, [MINING]: EVOLVE_AT[1] } }) === 2);
check('in the browser a Thistlekit\'s climbing is its level, and a Wagonox\'s driving',
  creatureLevel({ species: 'orse', skills: { [HAUL_SKILL]: 30.5, fighting: 40 } }) === 30
    && creatureLevel({ species: 'roxxen', skills: { [DRIVING]: 26, [HAUL_SKILL]: 70 } }) === 26);
check('in the browser a kind with no level skill (an ogre) is at its highest skill',
  levelSkill(SPECIES.ogre) === null && creatureLevel({ species: 'ogre', skills: { fighting: 30, [HAUL_SKILL]: 12 } }) === 30);
check('in the browser a kind with its level skill not yet learned is level 1',
  creatureLevel({ species: 'quarra', skills: { fighting: 40 } }) === 1);

/* ---- a wagon driven over flat ground, in the browser ------------------------ */

{
  const game = Game.create(4646);
  // Open, dry ground with room for a wagon and a dozen tiles east of it, made flat.
  let spot: [number, number] | null = null;
  const clear = (x0: number, y0: number): boolean => {
    for (let y = y0 - 4; y <= y0 + 4; y++) {
      for (let x = x0 - 4; x <= x0 + 16; x++) {
        if (!game.world.isPassable(x, y) || game.world.hasWater(x, y) || game.world.slope(x, y) >= 12) return false;
      }
    }
    return true;
  };
  for (let r = 0; r < 200 && !spot; r++) {
    for (let dx = -r; dx <= r && !spot; dx++) {
      for (const dy of [-r, r]) {
        if (clear(96 + dx, 96 + dy)) {
          spot = [96 + dx, 96 + dy];
          break;
        }
      }
    }
  }
  check('in the browser a stretch of open ground to drive on', spot !== null, spot ? `${spot[0]}, ${spot[1]}` : 'none found');
  const [px, py] = spot ?? [96, 96];
  const flatAt = game.world.heightAt(px, py);
  game.world.heightAt = () => flatAt;
  for (const f of [...game.furniture.values()]) game.removeFurniture(f.id);
  game.player.x = px + 0.5;
  game.player.y = py + 0.5;
  const grown = game.time - 3600 * 24;
  const wagon = game.addFurniture('wagon', px + 1, py, 0, 0, 40, [], 'Pine');
  const beast = (species: string, x: number, y: number): Creature => {
    const c = game.creatures.spawn(species, x, y, 'active', game.rand, grown);
    c.hunger = 1;
    c.traits = [];
    c.rare = 0;
    c.care = 0.5;
    c.skills = { ...c.skills, [HAUL_SKILL]: 1, [DRIVING]: 1 };
    if (species === 'roxxen') delete c.skills[HAUL_SKILL];
    return c;
  };
  // A Chiptail and a Wagonox, and one more of each, in the wagon's four yokes.
  const team = [beast('quarra', px + 2.5, py + 0.5), beast('roxxen', px + 2.5, py + 1.5), beast('quarra', px + 2.5, py + 2.5), beast('roxxen', px + 2.5, py - 0.5)];
  for (const c of team) c.hitchedTo = wagon.id;
  wagon.team = team.map((c) => c.id);
  const [quarra, roxxen] = team;
  const board = PLACEABLE_ACTION_BY_ID.get('board_vehicle')!;
  board.perform({ kind: 'furniture', id: wagon.id }, game);
  // Every gain asked for, with its base and pace, at a roll of one (`0.6 + 0.8 × 0.5`).
  game.rand = () => 0.5;
  const asked: { id: number; skill: string; base: number; pace: number }[] = [];
  const gainSkill = game.creatures.gainSkill.bind(game.creatures);
  game.creatures.gainSkill = (g, c, id, base, pace = learnPace(c, id)) => {
    asked.push({ id: c.id, skill: id, base, pace });
    return gainSkill(g, c, id, base, pace);
  };
  const mul = game.creatures.learnMul(quarra, game.time);
  const same = near(mul, game.creatures.learnMul(roxxen, game.time));
  check('and they take us somewhere', game.moveTo(px + 12, py));
  for (let t = 0; t < 400 && game.player.path; t++) game.update(0.1);
  const got = (c: Creature, skill: string): { base: number; n: number } => {
    const mine = asked.filter((a) => a.id === c.id && a.skill === skill);
    return { base: mine.reduce((s, a) => s + a.base * a.pace, 0), n: mine.length };
  };
  const q = got(quarra, HAUL_SKILL);
  const r = got(roxxen, DRIVING);
  // A Wagonox is paid a go a tile gone into; the rest climbing as far as they went.
  const qPerTile = q.base;
  const rPerTile = r.base / LEARN_PACE.pull;
  check(`in the browser a Chiptail in the traces learns climbing a tile at a Wagonox's driving base a tile over its pace (×${LEARN_PACE.pull})`,
    r.n > 4 && q.n > 0 && Math.abs(qPerTile / rPerTile - 1) < 0.1 && same,
    `climbing base ${q.base.toFixed(5)} over ${q.n} steps; driving ${r.base.toFixed(5)} over ${r.n} tiles, ${rPerTile.toFixed(5)} over its pace`);
  const qGain = quarra.skills[HAUL_SKILL] - 1;
  const rGain = roxxen.skills[DRIVING] - 1;
  check('in the browser, at a pinned roll, what each learned a tile is the same over the Wagonox\'s pace',
    Math.abs(qGain / (rGain / LEARN_PACE.pull) - 1) < 0.1 && near(rGain, r.n * skillGain(1, PULL_LEARN * mul * LEARN_PACE.pull, 1), rGain * 0.01),
    `climbing +${qGain.toFixed(6)}, driving +${rGain.toFixed(6)} (÷${LEARN_PACE.pull} = ${(rGain / LEARN_PACE.pull).toFixed(6)})`);
  check('in the browser neither learns the other\'s skill, and the Chiptail\'s mining and level are as they were',
    roxxen.skills[HAUL_SKILL] === undefined && quarra.skills[DRIVING] === 1 && creatureLevel(quarra) === Math.floor(quarra.skills[MINING] ?? 1),
    `${JSON.stringify(quarra.skills)} / ${JSON.stringify(roxxen.skills)}`);
  // And a step up: the same gain asked off a rise of 5, more than off the flat.
  game.world.heightAt = (x: number) => flatAt + (x - px) * 5;
  game.player.dirX = 1;
  game.player.dirY = 0;
  const before = asked.length;
  game.workClimb(quarra, 1);
  const up = asked.slice(before).find((a) => a.id === quarra.id);
  check('in the browser a tile up a rise of 5 teaches more climbing than a flat one', !!up && near(up.base, haulLearn(5)) && up.base > haulLearn(0),
    `${up?.base} vs ${haulLearn(0)}`);
}

/* ---- the island ----------------------------------------------------------- */

// The migration's one-off step, run again over these.
const migration = readFileSync('supabase/migrations/20261102180001_haul_climbing_level_skill.sql', 'utf8');
const keep = migration.match(/do \$do\$[\s\S]*?end \$do\$;/)?.[0];
check('the migration has its one-off step', !!keep);

const IVAR = `(select uid from player where world_id = (select id from world where name = 'Faraway') and name = 'Ivar')`;
const out = psql(`
begin;
set local client_min_messages = warning;
create temp table said (k text, v text);
create temp table kept (id int);
select set_config('request.jwt.claims', json_build_object('sub', ${IVAR})::text, true) \\g /dev/null
do $t$
declare w uuid; u uuid; gx int; gy int; v_wagon bigint; q1 int; q2 int; r1 int; r2 int; i int;
        v_three int; v_two int; v_held int; v_wild int; v_ogre int;
begin
  select id into w from world where name = 'Faraway';
  select uid into u from player where world_id = w and name = 'Ivar';
  -- Flat grass going east, and to the south a rise of 5 a tile going east.
  for gx in 12..40 loop for gy in 15..29 loop
    perform land_set_height(w, gx, gy, case when gy >= 26 then 4 + 5 * greatest(0, gx - 20) else 4 end);
    perform land_set_tile(w, gx, gy, tile_id('Grass'));
  end loop; end loop;
  update creature set rider = null where world_id = w and rider = u;
  delete from placed where world_id = w and driver = u;
  update player set x = 20.5, y = 21.5, level = 0, aboard = null, away = false,
         moved_at = now() - interval '10 seconds', body_at = now() where world_id = w and uid = u;

  -- On the box of a wagon with a Chiptail and a Wagonox, and one more of each, in its yokes.
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, driver)
    values (w, 'furniture', 'wagon', 20, 21, 20.5, 21.5, 50, u) returning id into v_wagon;
  q1 := creature_spawn(w, 'quarra', 22.5, 21.5, 'active', now() - interval '2 years', u);
  r1 := creature_spawn(w, 'roxxen', 22.5, 22.5, 'active', now() - interval '2 years', u);
  q2 := creature_spawn(w, 'quarra', 22.5, 20.5, 'active', now() - interval '2 years', u);
  r2 := creature_spawn(w, 'roxxen', 22.5, 23.5, 'active', now() - interval '2 years', u);
  update creature set hitched_to = v_wagon, hunger = 1, traits = '{}', skills = '{}' where world_id = w and id in (q1, q2, r1, r2);
  insert into said select 'BASES', haul_learn_of(0) * learn_pace(q, 'climbing') || '|' || learns_gain_pull() * learn_pace(r, 'driving')
    from creature q, creature r where q.world_id = w and q.id = q1 and r.world_id = w and r.id = r1;
  insert into said select 'QBOUNDS', skill_gain_of(1, haul_learn_of(0) * beast_mul(c, 'learn') * learn_pace(c, 'climbing'), 0.6)
    || '|' || skill_gain_of(1, haul_learn_of(0) * beast_mul(c, 'learn') * learn_pace(c, 'climbing'), 1.4) from creature c where c.world_id = w and c.id = q1;
  insert into said select 'RBOUNDS', skill_gain_of(1, learns_gain_pull() * beast_mul(c, 'learn') * learn_pace(c, 'driving'), 0.6)
    || '|' || skill_gain_of(1, learns_gain_pull() * beast_mul(c, 'learn') * learn_pace(c, 'driving'), 1.4) from creature c where c.world_id = w and c.id = r1;
  insert into said select 'MULS', (select beast_mul(c, 'learn') from creature c where c.world_id = w and c.id = q1)
    || '|' || (select beast_mul(c, 'learn') from creature c where c.world_id = w and c.id = r1);

  -- Twelve tiles east on the flat, four at a time.
  for i in 1..3 loop
    update player set moved_at = now() - interval '10 seconds', body_at = now() where world_id = w and uid = u;
    perform rpc_move(w, 20.5 + 4 * i, 21.5, 0);
  end loop;
  insert into said select 'MOVED', x::text from player where world_id = w and uid = u;
  insert into said select 'FLAT', coalesce(q.skills->>'climbing', '-') || '|' || coalesce(r.skills->>'driving', '-')
    || '|' || coalesce(q.skills->>'driving', '-') || '|' || coalesce(r.skills->>'climbing', '-')
    from creature q, creature r where q.world_id = w and q.id = q1 and r.world_id = w and r.id = r1;

  -- And four tiles east up the rise, from no climbing again.
  update creature set skills = '{}' where world_id = w and id in (q1, q2, r1, r2);
  update placed set x = 20, y = 26, cx = 20.5, cy = 26.5 where world_id = w and id = v_wagon;
  update player set x = 20.5, y = 26.5, moved_at = now() - interval '10 seconds', body_at = now() where world_id = w and uid = u;
  insert into said values ('CLIMBS', array_to_string(walk_climbs(w, 20.5, 26.5, 24.5, 26.5), ','));
  perform rpc_move(w, 24.5, 26.5, 0);
  insert into said select 'UPX', x::text from player where world_id = w and uid = u;
  insert into said select 'UP', coalesce(skills->>'climbing', '-') from creature where world_id = w and id = q1;

  -- Level and stage off its level skill.
  insert into said select 'LEVEL', creature_level(c.skills, c.species) || '|' || stage_of(c) from creature c where c.world_id = w and c.id = q1;
  update creature set skills = '{"climbing": 60, "mining": 5}' where world_id = w and id = q2;
  insert into said select 'CHIPTAIL', creature_level(c.skills, c.species) || '|' || stage_of(c) from creature c where c.world_id = w and c.id = q2;
  v_ogre := creature_spawn(w, 'ogre', 36.5, 17.5, 'wild', now() - interval '2 years', null);
  update creature set skills = '{"fighting": 30, "climbing": 12}' where world_id = w and id = v_ogre;
  insert into said select 'OGRE', creature_level(c.skills, c.species) || '|' || stage_of(c) from creature c where c.world_id = w and c.id = v_ogre;

  -- The one-off step: one at its third stage by its climbing, one at its second by its fighting, a wild one at its
  -- third by its climbing, and one its mining already holds at its third.
  v_three := creature_spawn(w, 'quarra', 30.5, 17.5, 'active', now() - interval '2 years', u);
  v_two := creature_spawn(w, 'quarra', 31.5, 17.5, 'active', now() - interval '2 years', u);
  v_wild := creature_spawn(w, 'quarra', 32.5, 17.5, 'wild', now() - interval '2 years', null);
  v_held := creature_spawn(w, 'quarra', 33.5, 17.5, 'active', now() - interval '2 years', u);
  update creature set skills = '{"climbing": 60, "mining": 5}' where world_id = w and id in (v_three, v_wild);
  update creature set skills = '{"fighting": 30.5, "mining": 3}' where world_id = w and id = v_two;
  update creature set skills = '{"climbing": 70, "mining": 55}' where world_id = w and id = v_held;
  insert into kept values (v_three), (v_two), (v_wild), (v_held);
  insert into said select 'BEFORE', string_agg(stage_of(c)::text, ',' order by c.id) from creature c where c.world_id = w and c.id in (v_three, v_two, v_wild, v_held);
end $t$;
${keep ?? ''}
do $t$
declare w uuid;
begin
  select id into w from world where name = 'Faraway';
  insert into said select 'KEPT', string_agg(c.skills->>'mining' || '@' || creature_level(c.skills, c.species) || '/' || stage_of(c), ' ' order by c.id)
    from creature c join kept k on k.id = c.id where c.world_id = w;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const say = (k: string): string => isle.get(k) ?? 'unsaid';

const [qb, rb] = say('BASES').split('|').map(Number);
check(`on the island a Chiptail's climbing base a tile is a Wagonox's driving base over its pace (×${LEARN_PACE.pull})`,
  near(qb, rb / LEARN_PACE.pull) && near(qb, HAUL_LEARN), say('BASES'));
check('on the island the wagon goes the twelve tiles', Number(say('MOVED')) === 32.5, say('MOVED'));
const [qc, rd, qd, rc] = say('FLAT').split('|');
const [qlo, qhi] = say('QBOUNDS').split('|').map(Number);
const [rlo, rhi] = say('RBOUNDS').split('|').map(Number);
const [qmul, rmul] = say('MULS').split('|').map(Number);
const qGain = Number(qc) - 1;
const rGain = Number(rd) - 1;
check('on the island the Chiptail learns twelve flat tiles of climbing, the Wagonox twelve of driving, neither the other\'s skill',
  qGain >= 12 * qlo * 0.999 && qGain <= 12 * qhi * 1.001 && rGain >= 12 * rlo * 0.999 && rGain <= 12 * rhi * 1.001 && qd === '-' && rc === '-',
  `climbing +${qGain.toFixed(6)} (${(12 * qlo).toFixed(6)} to ${(12 * qhi).toFixed(6)}), driving +${rGain.toFixed(6)} (${(12 * rlo).toFixed(6)} to ${(12 * rhi).toFixed(6)})`);
// Twelve rolls each: the two shares of the mean roll are within a few tenths of each other (was ×16.7 apart).
const ratio = (qGain / qmul) / (rGain / rmul / LEARN_PACE.pull);
check('on the island, within the roll, what each learned a tile is the same over the Wagonox\'s pace', ratio > 0.6 && ratio < 1.67,
  `climbing ÷ (driving ÷ ${LEARN_PACE.pull}), each over its own learning: ${ratio.toFixed(3)}`);
const climbs = say('CLIMBS').split(',').map(Number);
const steep = climbs.reduce((a, c) => a + haulLearn(c), 0) / (4 * haulLearn(0));
check(`on the island four tiles up a rise of 5 teach about ×${steep.toFixed(2)} four flat ones`,
  climbs.length === 4 && Number(say('UPX')) === 24.5 && Number(say('UP')) - 1 >= steep * 4 * qlo * 0.97 && Number(say('UP')) - 1 <= steep * 4 * qhi * 1.03,
  `${say('CLIMBS')}: climbing ${say('UP')}`);
check('on the island its climbing is no level: the Chiptail after the wagon is level 1, first stage', say('LEVEL') === '1|0', say('LEVEL'));
check('on the island a Chiptail with climbing 60 and mining 5 is level 5, first stage', say('CHIPTAIL') === '5|0', say('CHIPTAIL'));
check('on the island a kind with no level skill (an ogre) is at its highest skill', say('OGRE') === '30|0', say('OGRE'));
check('before the one-off step the four are at stages 0, 0, 0 and 2 by their level skill', say('BEFORE') === '0,0,0,2', say('BEFORE'));
check(`the one-off step keeps each at its stage: mining to ${EVOLVE_AT[1]}, ${EVOLVE_AT[0]} and ${EVOLVE_AT[1]} (a wild one too), and 55 left be`,
  say('KEPT') === `${EVOLVE_AT[1]}@${EVOLVE_AT[1]}/2 ${EVOLVE_AT[0]}@${EVOLVE_AT[0]}/1 ${EVOLVE_AT[1]}@${EVOLVE_AT[1]}/2 55@55/2`, say('KEPT'));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`climbing in the traces and level off the level skill — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
