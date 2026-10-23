/**
 * Four traits on four new channels (part C): night-eyed, deep-pocketed, lucky finder and settler.
 *
 * Asked of both sides:
 *
 *   * each trait's card says the same on both (`traitSays`, `trait_says`), off its channel's label and its figure, and
 *     the island holds it at the tier, with the aura, the browser does;
 *   * each is rolled from the wild table at its tier on both sides (`rollTrait`, `roll_trait`);
 *   * `night`: what the dark takes of a kept one's sight for you, nought for a night-eyed one (`keptSight`), and the
 *     island's blood on it the same (`beast_mul`); sight for you is worked out in the browser alone;
 *   * `loads`: a load more a trip on both (`stageLoads`, `stage_loads`): a reed cutter with one in its arms goes out
 *     for another rather than home;
 *   * `find`: a seek go's chance of a relic fragment by its blood (`findChance` times `mul`, `find_chance` times
 *     `beast_mul`), the same number on both, a rare one's its traits' alone (`find` is out of the blood), and a lucky
 *     finder turning up more than one without;
 *   * `idle`: a worker with nothing to do waits `WORKER_REST_FIRST` by its blood and its herd's (`idleRest`, `worker_rest`
 *     times `beast_mul`): the settler itself, another worker beside it, and one on a settlement without one.
 *
 * Runs against the database the suite leaves behind; the island half makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { bloodMul, rarityMul, stageLoads, type Creature } from '../../src/game/creatures';
import { findChance } from '../../src/game/archaeology';
import { WORKER_REST_FIRST } from '../../src/game/keep';
import { keptSight } from '../../src/game/vision';
import { BLOOD_CHANNELS, bredLine, CHANNEL_BY_ID, CHANNELS, figSays, lineMul, rollTrait, TRAITS, traitMul, traitOf, traitSays, type TraitChannel } from '../../src/game/traits';

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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;

/** The four, and the channel each is on. */
const NEW: Array<[string, TraitChannel]> = [['night_eyed', 'night'], ['deep_pocketed', 'loads'], ['lucky_finder', 'find'], ['settler', 'idle']];
const ROLLS = 4000;

/* ---- the island ---------------------------------------------------------- */

const T = 16;
const U = '7e5b0000-0000-4000-8000-0000000000c3';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; a int; b int; c creature; i int; n int; v_got jsonb; v_seen text[] := '{}'; v_id text;
begin
  -- Each trait as the island holds it and says it.
  ${NEW.map(([id]) => `
  insert into said select 'DEF_${id}', d.tier || '|' || d.aura || '|' || coalesce(d.family, '-') || '|' || coalesce(trait_says(d.id), '-')
    from trait_def d where d.id = '${id}';`).join('')}

  -- The wild table, with a lift that leaves no common in it, until each has come up.
  perform setseed(0.27);
  for i in 1..${ROLLS} loop
    v_id := roll_trait('{}', 100, 3);
    if v_id = any(array[${NEW.map(([id]) => `'${id}'`).join(', ')}]) and not (v_id = any(v_seen)) then v_seen := v_seen || v_id; end if;
  end loop;
  insert into said values ('ROLLED', array_to_string(array(select x from unnest(v_seen) x order by x), ','));

  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Traitsc', 276, 40, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Traitsc', ${T}, ${T}, 10, 1, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 1, 'plank', ${T + 1}, ${T}, 0, 0, true, u);

  -- What a fantastic rarity and a line five deep make of each channel, and the line a young one is born with off
  -- parents five deep on speed and on find: none of it on a channel out of the blood.
  insert into said select 'RARITY', string_agg(ch.id || ':' || ch.blood || ':' || round(rarity_blood('fantastic', ch.id)::numeric, 6)::float8
      || ':' || round(line_mul(array(select e.trait from trait_effect e where e.channel = ch.id limit 1), jsonb_build_object(ch.id, 5), ch.id)::numeric, 6)::float8,
      ',' order by ch.ord) from channel_def ch;
  insert into said select 'BRED', bred_line(array['fleet', 'lucky_finder'], array['fleet', 'lucky_finder'], '{"speed": 4, "find": 4}',
    array['fleet', 'lucky_finder'], '{"speed": 4, "find": 4}')::text;

  -- night: its blood on it, as a kept one.
  a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T} + 0.5, 'active', now() - interval '60 days', u);
  update creature set traits = array['night_eyed'], rare = null where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('NIGHT', beast_mul(c, 'night')::text);
  update creature set traits = '{}' where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('NIGHT0', beast_mul(c, 'night')::text);
  delete from creature where world_id = w and id = a;

  -- loads: a reed cutter at its first stage, with and without, cuts once.
  perform land_set_tile(w, x, ${T + 4}, tile_id('Reed')) from generate_series(${T - 2}, ${T + 2}) x;
  for i in 0..1 loop
    a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T + 3} + 0.5, 'deed', now() - interval '60 days', u);
    update creature set traits = case i when 0 then '{}'::text[] else array['deep_pocketed'] end, rare = null, care = 0,
           carrying = null, hunger = 1, stance = 'passive', skills = jsonb_build_object('foraging', 10),
           phase = 'work', work_x = ${T}, work_y = ${T + 4}, from_x = ${T} + 0.5, from_y = ${T + 3} + 0.5,
           to_x = ${T} + 0.5, to_y = ${T + 3} + 0.5, until = now() - interval '0.3 seconds', leg_at = now(), leg_ends = now()
     where world_id = w and id = a;
    select * into c from creature where world_id = w and id = a;
    insert into said values ('LOADS' || i, stage_loads(c)::text);
    perform worker_settle(w, a);
    insert into said select 'CUT' || i, cr.phase || ',' || loads_in(cr.carrying) from creature cr where cr.world_id = w and cr.id = a;
    delete from creature where world_id = w and id = a;
  end loop;
  perform land_set_tile(w, x, ${T + 4}, tile_id('Grass')) from generate_series(${T - 2}, ${T + 2}) x;

  -- find: a rare seeker at a hundred archaeology, with and without.
  for i in 0..1 loop
    a := creature_spawn(w, 'snout', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
    update creature set traits = case i when 0 then '{}'::text[] else array['lucky_finder'] end, rare = 'rare', care = 0,
           skills = jsonb_build_object('archaeology', 100), work_x = ${T + 2}, work_y = ${T + 2}
     where world_id = w and id = a;
    select * into c from creature where world_id = w and id = a;
    insert into said values ('FIND' || i, (find_chance(100, 30) * beast_mul(c, 'find'))::text);
    n := 0;
    for b in 1..60 loop
      v_got := worker_do(w, a);
      if v_got is not null and v_got->>'def' = 'fragment' then n := n + 1; end if;
    end loop;
    insert into said values ('FOUND' || i, n::text);
    delete from creature where world_id = w and id = a;
  end loop;

  -- idle: reed cutters with no reeds anywhere, one a settler, and then one on its own.
  a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  b := creature_spawn(w, 'sedra', ${T} + 1.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set traits = case when id = a then array['settler'] else '{}'::text[] end, rare = null, care = 0,
         carrying = null, hunger = 1, stance = 'passive', skills = jsonb_build_object('foraging', 10), idle_since = null,
         phase = 'idle', work_x = null, work_y = null, until = now() - interval '0.3 seconds', leg_at = now(), leg_ends = now(),
         from_x = x0, from_y = ${T} + 0.5, to_x = x0, to_y = ${T} + 0.5
    from (select ${T} + 0.5 as x0) z
   where world_id = w and id in (a, b);
  perform worker_settle(w, a);
  perform worker_settle(w, b);
  insert into said select 'WAIT_' || case when cr.id = a then 'SETTLER' else 'BESIDE' end,
      extract(epoch from cr.until - cr.leg_ends)::text || ',' || coalesce(cr.idle_why, '-')
    from creature cr where cr.world_id = w and cr.id in (a, b);
  delete from creature where world_id = w and id = a;
  update creature set idle_since = null, phase = 'idle', work_x = null, work_y = null, until = now() - interval '0.3 seconds',
         leg_at = now(), leg_ends = now()
   where world_id = w and id = b;
  perform worker_settle(w, b);
  insert into said select 'WAIT_ALONE', extract(epoch from cr.until - cr.leg_ends)::text || ',' || coalesce(cr.idle_why, '-')
    from creature cr where cr.world_id = w and cr.id = b;
end $t$;
select k || '=' || v from said;
rollback;
`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => {
  const i = l.indexOf('=');
  return [l.slice(0, i), l.slice(i + 1)] as [string, string];
}));

/* ---- the cards and the rolls --------------------------------------------- */

const rand = ((): (() => number) => {
  let s = 276;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
})();
const rolled = new Set<string>();
for (let i = 0; i < ROLLS; i++) {
  const id = rollTrait(rand, [], 100, 3);
  if (id) rolled.add(id);
}
for (const [id, ch] of NEW) {
  const t = traitOf(id);
  if (!t) {
    check(`${id} is a trait`, false);
    continue;
  }
  const v = t.effects[ch] as number;
  const card = `${figSays(ch, v)} ${CHANNEL_BY_ID.get(ch)?.label}`;
  check(`${t.name}: its card says ${card}`, traitSays(t) === card, traitSays(t));
  const [tier, aura, fam, says] = (said.get(`DEF_${id}`) ?? '').split('|');
  check(`${t.name}: the island holds it ${t.tier}${t.aura ? ', communal' : ''}, and says the same`,
    tier === t.tier && aura === String(!!t.aura) && fam === '-' && says === traitSays(t), said.get(`DEF_${id}`));
  check(`${t.name}: rolled from the wild table in the browser`, rolled.has(id));
  check(`${t.name}: and on the island`, (said.get('ROLLED') ?? '').split(',').includes(id), said.get('ROLLED'));
}

/* ---- rarity and lines ---------------------------------------------------- */

{
  const carrier = (ch: TraitChannel): string[] => [TRAITS.find((t) => t.effects[ch] !== undefined)?.id ?? ''];
  const r6 = (x: number): string => String(Number(x.toFixed(6)));
  const browser = CHANNELS.map((ch) => `${ch.id}:${ch.blood !== false}:${r6(rarityMul({ rare: 3 }, ch.id))}:${r6(lineMul(carrier(ch.id), { [ch.id]: 5 }, ch.id))}`).join(',');
  check('rarity and a line on every channel the same on both sides, and none on a channel out of the blood',
    said.get('RARITY') === browser && CHANNELS.every((ch) => ch.blood !== false || (rarityMul({ rare: 3 }, ch.id) === 1 && lineMul(carrier(ch.id), { [ch.id]: 5 }, ch.id) === 1)),
    `${said.get('RARITY')} | ${browser}`);
  check('every channel new with these traits is out of the blood, the fifteen before in it',
    CHANNELS.slice(0, 15).every((ch) => ch.blood !== false) && CHANNELS.slice(15).every((ch) => ch.blood === false), BLOOD_CHANNELS.map((ch) => ch.id).join(','));
  const pair = { traits: ['fleet', 'lucky_finder'], line: { speed: 4, find: 4 } };
  const young = bredLine(pair.traits, pair, pair);
  check('a young one\'s line runs on a channel in the blood alone, on both sides',
    JSON.stringify(young) === JSON.stringify({ speed: 5 }) && JSON.stringify(JSON.parse(said.get('BRED') ?? 'null')) === JSON.stringify(young), `${said.get('BRED')} | ${JSON.stringify(young)}`);
}

/* ---- the rules ----------------------------------------------------------- */

const g = Game.create(4276);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
g.deed = { name: 'Traitsc', x: T, y: T, radius: 10, level: 1 };
const make = (species: string, mode: Creature['mode'], traits: string[], rare = 0, x = T + 0.5): Creature => {
  const c = g.creatures.spawn(species, x, T + 0.5, mode);
  c.traits = traits;
  c.rare = rare;
  c.care = 0;
  c.pedigree = null;
  return c;
};

// night
{
  const c = make('sedra', 'active', ['night_eyed']);
  const plain = make('sedra', 'active', []);
  const def = g.creatures.species(c);
  check('night-eyed: the dead of night takes none of its sight for you', near(keptSight(def, 1, 1, bloodMul(c, 'night')), keptSight(def, 1, 0)),
    `${keptSight(def, 1, 1, bloodMul(c, 'night'))} at night, ${keptSight(def, 1, 0)} by day`);
  check('and without it the night takes its share', keptSight(def, 1, 1, bloodMul(plain, 'night')) < keptSight(def, 1, 0));
  check('night: its blood on it the same on both sides', near(Number(said.get('NIGHT')), bloodMul(c, 'night')) && near(Number(said.get('NIGHT0')), bloodMul(plain, 'night')),
    `${said.get('NIGHT')}/${said.get('NIGHT0')} against ${bloodMul(c, 'night')}/${bloodMul(plain, 'night')}`);
  g.creatures.remove(c.id);
  g.creatures.remove(plain.id);
}

// loads
{
  const plain = make('sedra', 'deed', []);
  const deep = make('sedra', 'deed', ['deep_pocketed']);
  plain.skills = { foraging: 10 };
  deep.skills = { foraging: 10 };
  check('deep-pocketed: a load more a trip in the browser', stageLoads(deep) === stageLoads(plain) + 1, `${stageLoads(plain)} and ${stageLoads(deep)}`);
  check('and the same loads on the island', said.get('LOADS0') === String(stageLoads(plain)) && said.get('LOADS1') === String(stageLoads(deep)),
    `${said.get('LOADS0')} and ${said.get('LOADS1')}`);
  check('on the island a reed cutter with one load goes home without it, and out for another with it',
    said.get('CUT0') === 'home,1' && (said.get('CUT1') ?? '').endsWith(',1') && !(said.get('CUT1') ?? '').startsWith('home'),
    `${said.get('CUT0')} and ${said.get('CUT1')}`);
  g.creatures.remove(plain.id);
  g.creatures.remove(deep.id);
}

// find
{
  const plain = make('snout', 'deed', [], 1);
  const lucky = make('snout', 'deed', ['lucky_finder'], 1);
  for (const c of [plain, lucky]) {
    c.skills = { archaeology: 100 };
    c.workX = T + 2;
    c.workY = T + 2;
  }
  const at = (c: Creature): number => findChance(100, 30) * g.creatures.mul(c, 'find');
  check('lucky finder: a seek go finds by the same chance on both sides', near(Number(said.get('FIND0')), at(plain)) && near(Number(said.get('FIND1')), at(lucky)),
    `${said.get('FIND0')}/${said.get('FIND1')} against ${at(plain)}/${at(lucky)}`);
  const seek = (c: Creature): number => {
    let n = 0;
    for (let i = 0; i < 60; i++) if ((g.creatures as unknown as { finishSeek(g: Game, c: Creature): { id: string } | null }).finishSeek(g, c)?.id === 'fragment') n += 1;
    return n;
  };
  const base = findChance(100, 30);
  check('a rare one\'s find chance is its traits\' figure alone: rarity does not move it',
    near(at(plain), base) && near(at(lucky), base * traitMul(lucky.traits, 'find')) && at(lucky) > at(plain), `${at(plain)} and ${at(lucky)} against ${base}`);
  const [found0, found1] = [Number(said.get('FOUND0')), Number(said.get('FOUND1'))];
  const [seek0, seek1] = [seek(plain), seek(lucky)];
  check('and a lucky finder turns up more in 60 goes than one without, in the browser and on the island',
    found1 > found0 && seek1 > seek0, `island ${found0} and ${found1}, browser ${seek0} and ${seek1}`);
  g.creatures.remove(plain.id);
  g.creatures.remove(lucky.id);
}

// idle
{
  const settler = make('sedra', 'deed', ['settler']);
  const beside = make('sedra', 'deed', [], 0, T + 1.5);
  const wait = (k: string): number => Number((said.get(k) ?? '').split(',')[0]);
  check('settler: its own wait, its blood and its herd\'s, the same on both sides', near(wait('WAIT_SETTLER'), g.creatures.idleRest(settler)),
    `${said.get('WAIT_SETTLER')} against ${g.creatures.idleRest(settler)}`);
  check('a worker beside it waits its herd\'s, the same on both sides', near(wait('WAIT_BESIDE'), g.creatures.idleRest(beside))
    && near(g.creatures.idleRest(beside), WORKER_REST_FIRST * (traitOf('settler')?.effects.idle ?? 1)),
    `${said.get('WAIT_BESIDE')} against ${g.creatures.idleRest(beside)}`);
  g.creatures.remove(settler.id);
  check('and with no settler about, the plain wait', near(wait('WAIT_ALONE'), WORKER_REST_FIRST) && near(g.creatures.idleRest(beside), WORKER_REST_FIRST),
    `${said.get('WAIT_ALONE')} against ${g.creatures.idleRest(beside)}`);
  check('each of them was standing about for want of work', ['WAIT_SETTLER', 'WAIT_BESIDE', 'WAIT_ALONE'].every((k) => (said.get(k) ?? '').endsWith(',range')),
    ['WAIT_SETTLER', 'WAIT_BESIDE', 'WAIT_ALONE'].map((k) => said.get(k)).join(' / '));
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nnight-eyed, deep-pocketed, lucky finder and settler, the same on both sides — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
