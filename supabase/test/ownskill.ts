/**
 * A skill for every wildermon, and its level is that skill.
 *
 * Asked for: "Level should be equal to that skill, since there's only 1 skill
 * per wildermon", and "Give skill-less wildermon a skill that levels as they
 * complete tasks". This asks, of both sides, that every kind that can be kept
 * has one skill to learn; that a kind with no trade and no traces is born
 * knowing a little of its own and learns it by what it does -- sheared,
 * plucked or milked, sparred with, out with you, out after dark -- and a wild
 * one does not; and that its level is that skill.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { creatureLevel, OUT_EVERY, SPECIES, workSkill, type Creature } from '../../src/game/creatures';
import { ACTION_BY_ID } from '../../src/game/actions';

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

/* ---- every kind has one ------------------------------------------------------------ */

const kept = Object.values(SPECIES).filter((d) => !d.monster);
const none = kept.filter((d) => !workSkill(d) && !d.draught && !d.learns);
check(`every one of the ${kept.length} kinds that can be kept has a skill to learn`, none.length === 0, none.map((d) => d.id).join(', '));
const own = kept.filter((d) => d.learns);
check('and a kind with no trade and no traces has one of its own, and only those', own.every((d) => !workSkill(d) && !d.draught), own.map((d) => d.id).join(', '));

/* ---- on the island ----------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000f1';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; a int; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Ownskill', 176, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into said select 'LEARNS:' || id, learns || '|' || learns_by from species_def where learns is not null;
  insert into said values ('LEVELS', creature_level('{"foraging": 24.99}') || '|' || creature_level('{"foraging": 25}') || '|' || creature_level('{}'));

  -- A woola, born knowing a little, sheared.
  a := creature_spawn(w, 'woola', 17, 16.5, 'active', now() - interval '30 days', u);
  insert into said select 'BORN', skills::text from creature where world_id = w and id = a;
  update creature set fleece = 1 where world_id = w and id = a;
  perform perform_creature(w, u, 'shear', jsonb_build_object('kind', 'creature', 'id', a));
  insert into said select 'SHORN', ((skills->>'animal_husbandry')::double precision > 1)::text from creature where world_id = w and id = a;
  -- A cudda milked, with a bucket in the pack.
  a := creature_spawn(w, 'cudda', 17, 17, 'active', now() - interval '30 days', u);
  update creature set fleece = 1, sex = 'female' where world_id = w and id = a;
  perform gather(w, u, 'bucket', 1, 30);
  perform perform_creature(w, u, 'milk_creature', jsonb_build_object('kind', 'creature', 'id', a));
  insert into said select 'MILKED', ((skills->>'animal_husbandry')::double precision > 1)::text from creature where world_id = w and id = a;

  -- A warda out at your heel for ten minutes, and a wild one.
  a := creature_spawn(w, 'warda', 17, 16, 'active', now() - interval '30 days', u);
  update creature set settled_at = now() - interval '10 minutes' where world_id = w and id = a;
  perform creature_settle(w, a);
  insert into said select 'WATCHED', ((skills->>'awareness')::double precision > 1)::text from creature where world_id = w and id = a;
  a := creature_spawn(w, 'warda', 20, 16, 'wild', now() - interval '30 days', null);
  update creature set settled_at = now() - interval '10 minutes' where world_id = w and id = a;
  perform creature_settle(w, a);
  insert into said select 'WILDWATCH', coalesce(skills->>'awareness', '-') from creature where world_id = w and id = a;

  -- A lume out for ten minutes: it learns only if it is dark.
  a := creature_spawn(w, 'lume', 17, 15, 'active', now() - interval '30 days', u);
  update creature set settled_at = now() - interval '10 minutes' where world_id = w and id = a;
  perform creature_settle(w, a);
  insert into said select 'LUME', is_night(w)::text || '|' || ((skills->>'awareness')::double precision > 1) from creature where world_id = w and id = a;

  -- A sparra sparred with.
  a := creature_spawn(w, 'sparra', 16.9, 16.5, 'active', now() - interval '30 days', u);
  for i in 1..60 loop perform perform_fight(w, u, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', a)); end loop;
  insert into said select 'SPARRED', ((skills->>'fighting')::double precision > 1)::text from creature where world_id = w and id = a;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

for (const d of own) check(`a ${d.id} learns ${d.learns!.skill} by ${d.learns!.by} on both sides`, at(`LEARNS:${d.id}`) === `${d.learns!.skill}|${d.learns!.by}`, at(`LEARNS:${d.id}`));
check('on the island, the level is the skill to the whole number below, and one with none', at('LEVELS') === '24|25|1', at('LEVELS'));
check('a woola is born knowing a little animal husbandry', at('BORN') === '{"animal_husbandry": 1}', at('BORN'));
check('and learns more by being sheared', at('SHORN') === 'true', at('SHORN'));
check('a cudda learns it by being milked', at('MILKED') === 'true', at('MILKED'));
check(`a warda learns awareness out at your heel, a go for every ${OUT_EVERY} seconds, and a wild one none`, at('WATCHED') === 'true' && at('WILDWATCH') === '1', `${at('WATCHED')} ${at('WILDWATCH')}`);
const [night, lumeLearnt] = at('LUME').split('|');
check(`a lume learns awareness out after dark, and not by day (it is ${night === 'true' ? 'night' : 'day'})`, lumeLearnt === night, at('LUME'));
check('a sparra learns fighting by being sparred with', at('SPARRED') === 'true', at('SPARRED'));

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(4253);
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
const mine = (id: string, dx = 0.6): Creature => {
  const c = g.creatures.spawn(id, g.player.x + dx, g.player.y, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.stance = 'passive';
  return c;
};
const target = (c: Creature) => ({ kind: 'creature' as const, id: c.id });
{
  const c = mine('woola');
  const born = JSON.stringify(c.skills);
  c.fleece = 1;
  g.inventory.add('carving_knife', { ql: 30 });
  ACTION_BY_ID.get('shear')!.perform(target(c), g);
  check('in the browser, a woola is born knowing a little animal husbandry and learns it by being sheared',
    born === '{"animal_husbandry":1}' && (c.skills.animal_husbandry ?? 0) > 1, `${born} ${c.skills.animal_husbandry}`);
  check('and its level is that skill', creatureLevel(c) === Math.max(1, Math.floor(c.skills.animal_husbandry)));
  c.skills.animal_husbandry = 25.4;
  check('a skill of 25.4 is level 25', creatureLevel(c) === 25);
}
{
  const c = mine('cudda');
  c.fleece = 1;
  c.sex = 'female';
  g.inventory.add('bucket', { ql: 30 });
  ACTION_BY_ID.get('milk_creature')!.perform(target(c), g);
  check('a cudda learns it by being milked', (c.skills.animal_husbandry ?? 0) > 1, `${c.skills.animal_husbandry}`);
}
const run = (secs: number): void => { for (let i = 0; i < secs * 10; i++) { g.time += 0.1; g.creatures.update(0.1, g); } };
{
  const w = mine('warda', 1);
  const wild = g.creatures.spawn('warda', g.player.x + 6, g.player.y, 'wild', g.rand, g.time - 3600 * 24 * 30);
  run(OUT_EVERY * 12);
  check(`a warda learns awareness out at your heel, and a wild one none`, (w.skills.awareness ?? 0) > 1 && (wild.skills.awareness ?? 1) === 1,
    `${w.skills.awareness} ${wild.skills.awareness}`);
}
{
  const l = mine('lume', 1.2);
  const real = g.isNight.bind(g);
  g.isNight = () => false;
  run(OUT_EVERY * 12);
  const byDay = l.skills.awareness;
  g.isNight = () => true;
  run(OUT_EVERY * 12);
  g.isNight = real;
  check('a lume learns awareness out after dark, and not by day', byDay === 1 && (l.skills.awareness ?? 0) > 1, `${byDay} ${l.skills.awareness}`);
}
{
  const s = mine('sparra');
  const ATTACK = ACTION_BY_ID.get('attack_creature')!;
  for (let n = 0; n < 60 && ATTACK.check?.(target(s), g) === null; n++) ATTACK.perform(target(s), g);
  check('a sparra learns fighting by being sparred with', (s.skills.fighting ?? 0) > 1, `${s.skills.fighting}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na skill for every wildermon — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
