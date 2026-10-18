/**
 * Wildermon evolve.
 *
 * Asked for: "add 2 evolution stages for each with 2 new names for each
 * evolution. Each evolution add movement speed and task speed and base stats.
 * Evolutions happen at level 25 and 50." This asks, of both sides, that a kind
 * that evolves is at its second stage from the first of `EVOLVE_AT` and its
 * third from the second, its level being its skill; that each stage
 * multiplies its health, its blow, its pace and its task by `STAGE_MUL` over
 * the one before; that it is called by its stage's name; that reaching a
 * stage says so and fills its health out to the new size; and that a kind
 * that does not evolve is untouched at any level. The Snufflet, which was the
 * Rabba, is the first.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { attackOf, EVOLVE_AT, kindName, maxHealth, SPECIES, STAGE_MUL, stageOf, type Creature } from '../../src/game/creatures';

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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
const [AT1, AT2] = EVOLVE_AT;
const H = STAGE_MUL.hardy!, T = STAGE_MUL.tough!, S = STAGE_MUL.speed!, W = STAGE_MUL.work!;

/* ---- on the island ----------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000f7';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; a int; v int; c creature; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Evolve', 177, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  insert into said select 'NAMES', name || '|' || array_to_string(stages, ',') from species_def where id = 'rabba';
  insert into said select 'IRONEMOLE', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Mola')).id from species_def where id = 'mola';
  insert into said select 'SPORELING', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Vola')).id from species_def where id = 'vola';
  insert into said select 'CLOUDLET', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Woola')).id from species_def where id = 'woola';
  insert into said select 'PIGROOT', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Seavic')).id from species_def where id = 'seavic';
  insert into said select 'SKYLOOK', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Warda')).id from species_def where id = 'warda';
  insert into said select 'CHIPTAIL', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Quarra')).id from species_def where id = 'quarra';
  insert into said values ('NUMBERS', evolve_at_1() || '|' || evolve_at_2() || '|' || stage_mul_hardy() || '|' || stage_mul_tough() || '|' || stage_mul_speed() || '|' || stage_mul_work());
  a := creature_spawn(w, 'rabba', 17, 16.5, 'deed', now() - interval '30 days', u);
  v := creature_spawn(w, 'dowse', 18, 16.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null where world_id = w and id in (a, v);
  for i in 0..2 loop
    update creature set skills = jsonb_build_object('foraging', case i when 0 then ${AT1} - 0.01 when 1 then ${AT1} else ${AT2} end) where world_id = w and id = a;
    select * into c from creature where world_id = w and id = a;
    insert into said values ('STAGE:' || i, stage_of(c) || '|' || max_health(c) || '|' || round(attack_of(c)::numeric, 4)
      || '|' || round(beast_mul(c, 'speed')::numeric, 4) || '|' || round(beast_mul(c, 'work')::numeric, 4));
  end loop;
  update creature set skills = jsonb_build_object('prospecting', 80) where world_id = w and id = v;
  select * into c from creature where world_id = w and id = v;
  insert into said values ('STILL', stage_of(c) || '|' || round(beast_mul(c, 'speed')::numeric, 4));
  -- Learning across the line: it says so, and is as full of health as it was.
  update creature set mode = 'active', skills = jsonb_build_object('foraging', ${AT1} - 0.0001), health = 10 where world_id = w and id = a;
  for i in 1..50 loop
    perform worker_learn(w, a, 'foraging', 5);
    exit when (select stage_of(cr) from creature cr where cr.world_id = w and cr.id = a) = 1;
  end loop;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('CROSSED', stage_of(c) || '|' || round(c.health::numeric, 4));
  insert into said select 'TOLD', coalesce(string_agg(text, ' / '), '-') from event where world_id = w and uid = u and text like '%evolves into%';
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

const def = SPECIES.rabba;
check('the Rabba is the Snufflet now, a Snuffroot and a Snuffthorn after, on both sides',
  def.name === 'Snufflet' && def.stages?.map((x) => x.name).join(',') === 'Snuffroot,Snuffthorn' && at('NAMES') === 'Snufflet|Snuffroot,Snuffthorn', at('NAMES'));
const iron = SPECIES.mola;
check('the Mola is the Ironemole now, a Ferrodrill and an Oremander after, and an old Mola carcass is still one, on both sides',
  iron.name === 'Ironemole' && iron.stages?.map((x) => x.name).join(',') === 'Ferrodrill,Oremander'
    && at('IRONEMOLE') === 'Ironemole|Ferrodrill,Oremander|Mola|mola' && iron.stages[1].description.startsWith('An Ironemole at level'), at('IRONEMOLE'));
const spore = SPECIES.vola;
check('the Vola is the Sporeling now, a Sporekin and a Sporelord after, and an old Vola carcass is still one, on both sides',
  spore.name === 'Sporeling' && spore.stages?.map((x) => x.name).join(',') === 'Sporekin,Sporelord'
    && at('SPORELING') === 'Sporeling|Sporekin,Sporelord|Vola|vola', at('SPORELING'));
const cloud = SPECIES.woola;
check('the Woola is the Cloudlet now, a Cloudram and a Cloudborne after, and an old Woola carcass is still one, on both sides',
  cloud.name === 'Cloudlet' && cloud.stages?.map((x) => x.name).join(',') === 'Cloudram,Cloudborne'
    && at('CLOUDLET') === 'Cloudlet|Cloudram,Cloudborne|Woola|woola', at('CLOUDLET'));
const pig = SPECIES.seavic;
check('the Seavic is the Pigroot now, a Plowhog and a Harvestusk after, and an old Seavic carcass is still one, on both sides',
  pig.name === 'Pigroot' && pig.stages?.map((x) => x.name).join(',') === 'Plowhog,Harvestusk'
    && at('PIGROOT') === 'Pigroot|Plowhog,Harvestusk|Seavic|seavic', at('PIGROOT'));
const sky = SPECIES.warda;
check('the Warda is the Skylooklet now, a Skywarden and a Skyrange after, an old Warda carcass is still one, and its stages are not said to work faster, on both sides',
  sky.name === 'Skylooklet' && sky.stages?.map((x) => x.name).join(',') === 'Skywarden,Skyrange' && !sky.stages[1].description.includes('task')
    && at('SKYLOOK') === 'Skylooklet|Skywarden,Skyrange|Warda|warda', at('SKYLOOK'));
const chip = SPECIES.quarra;
check('the Quarra is the Chiptail now, a Quarrybash and a Monolithump after, and an old Quarra carcass is still one, on both sides',
  chip.name === 'Chiptail' && chip.stages?.map((x) => x.name).join(',') === 'Quarrybash,Monolithump'
    && at('CHIPTAIL') === 'Chiptail|Quarrybash,Monolithump|Quarra|quarra', at('CHIPTAIL'));
check(`it evolves at ${AT1} and ${AT2}, and each stage is ${H}, ${T}, ${S} and ${W} over the last, on both sides`,
  at('NUMBERS') === `${AT1}|${AT2}|${H}|${T}|${S}|${W}`, at('NUMBERS'));
for (let i = 0; i < 3; i++) {
  const [stage, health, attack, speed, work] = at(`STAGE:${i}`).split('|').map(Number);
  const k = i;
  check(`on the island, at ${['just under the first', 'the first', 'the second'][i]} it is stage ${k}: health, blow, pace and task at their stage`,
    stage === k && health === Math.round(def.health * H ** k) && near(attack, Number((def.attack * T ** k).toFixed(4)))
      && near(speed, Number((S ** k).toFixed(4))) && near(work, Number((W ** k).toFixed(4))), at(`STAGE:${i}`));
}
check('a dowse, which does not evolve, is not touched at any level', at('STILL') === '0|1.0000' || at('STILL') === '0|1', at('STILL'));
const [crossed, healthAfter] = at('CROSSED').split('|');
check(`learning across ${AT1}, it evolves, says so, and its health grows with it`,
  crossed === '1' && near(Number(healthAfter), 10 * H) && at('TOLD').includes('evolves into a Snuffroot'), `${at('CROSSED')} ${at('TOLD')}`);

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(4254);
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
const mine = (id: string): Creature => {
  const c = g.creatures.spawn(id, g.player.x + 1, g.player.y, 'deed', g.rand, g.time - 3600 * 24 * 30);
  c.traits = [];
  c.rare = 0;
  return c;
};
const r = mine('rabba');
for (const [skill, stage, name] of [[AT1 - 0.01, 0, 'Snufflet'], [AT1, 1, 'Snuffroot'], [AT2, 2, 'Snuffthorn']] as const) {
  r.skills = { foraging: skill };
  check(`in the browser, at ${skill} it is a ${name}, stage ${stage}, at its stage's health, blow, pace and task`,
    stageOf(r) === stage && kindName(r) === name && maxHealth(r, def) === Math.round(def.health * H ** stage) && near(attackOf(r, def), def.attack * T ** stage)
      && near(g.creatures.speedMul(r), S ** stage) && near(g.creatures.workMul(r), W ** stage),
    `${stageOf(r)} ${kindName(r)} ${maxHealth(r, def)} ${attackOf(r, def)} ${g.creatures.speedMul(r)} ${g.creatures.workMul(r)}`);
}
const still = mine('dowse');
still.skills = { prospecting: 80 };
check('a dowse is not touched at any level', stageOf(still) === 0 && kindName(still) === SPECIES.dowse.name && near(g.creatures.speedMul(still), 1));
{
  r.skills = { foraging: AT1 - 0.0001 };
  r.health = 10;
  r.mode = 'active';
  let evolved = 0;
  g.events.on('evolve', () => { evolved += 1; });
  const acts: string[] = [];
  g.events.on('beast', (_id, act) => acts.push(act));
  for (let n = 0; n < 50 && stageOf(r) === 0; n++) g.creatures.gainSkill(g, r, 'foraging', 5);
  check(`learning across ${AT1}, it evolves, says so, and its health grows with it`,
    stageOf(r) === 1 && near(r.health, 10 * H) && evolved === 1 && acts.includes('evolve')
      && g.log.some((e) => e.text.includes('evolves into a Snuffroot')), `${stageOf(r)} ${r.health} ${evolved} ${acts}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nwildermon evolve — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
