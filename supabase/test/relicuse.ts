/**
 * Restored relics used on a wildermon.
 *
 * Asked for: "restored artifacts can be used on Wildermon. Bone comb reduces the age of a wildermon by 1 stage. Old
 * file has a 1/20 chance of increasing the wildermon rarity by one step. Old pot increases one base stat randomly by 1
 * (max 10 per stat per wildermon). Make stats visible in Wildermon UI". This asks, of both sides:
 *
 *   * that an old pot, a bone comb and an old file restore into an ancient pot, comb and file of their own, and that a
 *     bone comb held from before is an ancient comb (in a save; the island's rows are carried over by its migration);
 *   * that an ancient comb takes an old one to the start of grown and a grown one to the start of young, at its
 *     keeper's `kept:age`, and is refused on a young one and kept;
 *   * that an ancient file makes one a step rarer about one time in `FILE_RARITY_ODDS`, says so either way, and is
 *     refused on a fantastic one and kept;
 *   * that an ancient pot puts points into its base stats, never more than `POT_MOST` in one, each `POT_STEP` more of
 *     health, attack, speed and work as every rule reads them, and is refused once all four are full and kept;
 *   * that each is used up, one at a time, and refused on a wild one and without one in the pack;
 *   * that the island sends your own wildermon's points, and the Wildermon window's card says each stat with them.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { packLand, packWorld, unpack } from '../../src/game/save';
import { Game } from '../../src/game/game';
import { RELICS } from '../../src/game/archaeology';
import { CREATURE_ACTION_BY_ID } from '../../src/game/creatureActions';
import { ACTIONS } from '../../src/game/actions';
import {
  ageOf, attackOf, BASE_STATS, COMB_INTO, FILE_RARITY_ODDS, maxHealth, POT_MOST, POT_STEP, potPoints, SPECIES, YOUNG_FOR, type Creature,
} from '../../src/game/creatures';
import { ITEM_DEFS, RARITIES } from '../../src/game/items';
import { baseStatTags } from '../../src/ui/panels/wildermon';

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
const near = (a: number, b: number, by = 1e-6): boolean => Math.abs(a - b) < by * Math.max(1, Math.abs(b));
/** How many goes the odds of the file are sampled over, and how far from the expected count they may land. */
const FILES = 2000;
const expectSteps = FILES / FILE_RARITY_ODDS;
const inBand = (n: number): boolean => Math.abs(n - expectSteps) < 4 * Math.sqrt(expectSteps);
const RESULTS = { 'old pot': 'ancient_pot', 'bone comb': 'ancient_comb', 'old file': 'ancient_file' } as Record<string, string>;
const TOP = RARITIES[RARITIES.length - 1].name;

/* ---- on the island ----------------------------------------------------------------- */

const U = '7e5b0000-0000-4000-8000-0000000000a7';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; a int; v_wild int; c creature; i int; v_n int; v_steps int := 0; px double precision; py double precision;
        v_j jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Relics', 205, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Delver');
  select x, y into px, py from player where world_id = w and uid = u;
  insert into said select 'RELICS', string_agg(name || ':' || result, ',' order by name) from relic_def where name in ('old pot', 'bone comb', 'old file');
  insert into said select 'ITEMS', string_agg(id || ':' || name, ',' order by id) from item_def where id in ('ancient_comb', 'ancient_file', 'ancient_pot', 'bone_comb');
  insert into said values ('NUMBERS', comb_into() || '|' || file_rarity_odds() || '|' || pot_step() || '|' || pot_most());
  insert into said select 'PORTED', string_agg(t.act || ':' || act_ported(t.act) || ':' || exists (select 1 from action_def d where d.id = t.act), ',' order by t.act)
    from unnest(array['use_ancient_comb', 'use_ancient_file', 'use_ancient_pot']) as t(act);
  insert into said select 'STATS', string_agg(s || ':' || base_stat_name(s) || ':' || base_stat_says(s), '|' order by o)
    from unnest(base_stats()) with ordinality as t(s, o);

  a := creature_spawn(w, 'rabba', px + 0.5, py, 'active', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, name = 'Ash', kept = null where world_id = w and id = a;
  v_wild := creature_spawn(w, 'rabba', px - 0.5, py, 'wild', now() - interval '30 days', null);

  -- Nothing in the pack, and a wild one.
  insert into said values ('NONE', coalesce(creature_refusal(w, u, 'use_ancient_comb', jsonb_build_object('kind', 'creature', 'id', a)), '-'));
  perform give(w, u, 'ancient_comb', 3, 30);
  insert into said values ('WILD', coalesce(creature_refusal(w, u, 'use_ancient_comb', jsonb_build_object('kind', 'creature', 'id', v_wild)), '-'));

  -- The comb: old to grown, grown to young, and a young one refused.
  select * into c from creature where world_id = w and id = a;
  insert into said values ('COMB:0', age_of(c.born, old_of(c), age_pace(c)) || '|' || coalesce(creature_refusal(w, u, 'use_ancient_comb', jsonb_build_object('kind', 'creature', 'id', a)), '-'));
  for i in 1..3 loop
    if creature_refusal(w, u, 'use_ancient_comb', jsonb_build_object('kind', 'creature', 'id', a)) is null then
      perform perform_creature(w, u, 'use_ancient_comb', jsonb_build_object('kind', 'creature', 'id', a));
    end if;
    select * into c from creature where world_id = w and id = a;
    insert into said values ('COMB:' || i, age_of(c.born, old_of(c), age_pace(c)) || '|' || round(extract(epoch from now() - c.born)::numeric, 3)
      || '|' || pack_count(w, u, 'ancient_comb') || '|' || coalesce(creature_refusal(w, u, 'use_ancient_comb', jsonb_build_object('kind', 'creature', 'id', a)), '-'));
  end loop;
  insert into said select 'COMBTOLD', string_agg(text, ' / ' order by n) from event where world_id = w and uid = u and text like 'Ancient comb used on%';
  -- At half the pace, for a keeper whose Kin ages it slower: twice as long ago, so its keeper's sum lands in the same place.
  update creature set born = now() - interval '30 days', kept = '{"kept:age": 0.5}' where world_id = w and id = a;
  perform give(w, u, 'ancient_comb', 1, 30);
  perform perform_creature(w, u, 'use_ancient_comb', jsonb_build_object('kind', 'creature', 'id', a));
  select * into c from creature where world_id = w and id = a;
  insert into said values ('COMBKIN', age_of(c.born, old_of(c), age_pace(c)) || '|' || round(extract(epoch from now() - c.born)::numeric, 3));
  update creature set kept = null, born = now() - interval '30 days' where world_id = w and id = a;

  -- The file, ${FILES} goes at it, put back to ordinary each time it comes up rarer.
  perform give(w, u, 'ancient_file', ${FILES}, 30);
  for i in 1..${FILES} loop
    perform perform_creature(w, u, 'use_ancient_file', jsonb_build_object('kind', 'creature', 'id', a));
    if (select rare from creature where world_id = w and id = a) is not null then
      v_steps := v_steps + 1;
      update creature set rare = null where world_id = w and id = a;
    end if;
  end loop;
  insert into said values ('FILE', v_steps || '|' || pack_count(w, u, 'ancient_file')
    || '|' || (select count(*) from event where world_id = w and uid = u and text like 'Ancient file used on Ash: now rare,%')
    || '|' || (select count(*) from event where world_id = w and uid = u and text like 'Ancient file used on Ash: no change.%'));
  update creature set rare = 'supreme' where world_id = w and id = a;
  perform give(w, u, 'ancient_file', 400, 30);
  for i in 1..400 loop
    exit when (select rare from creature where world_id = w and id = a) = '${TOP}';
    perform perform_creature(w, u, 'use_ancient_file', jsonb_build_object('kind', 'creature', 'id', a));
  end loop;
  v_n := pack_count(w, u, 'ancient_file');
  insert into said values ('FILETOP', (select rare from creature where world_id = w and id = a) || '|'
    || coalesce(creature_refusal(w, u, 'use_ancient_file', jsonb_build_object('kind', 'creature', 'id', a)), '-'));
  perform perform_creature(w, u, 'use_ancient_file', jsonb_build_object('kind', 'creature', 'id', a));
  insert into said values ('FILEKEPT', (v_n = pack_count(w, u, 'ancient_file'))::text);
  update creature set rare = null where world_id = w and id = a;

  -- The pot: before, ${4 * POT_MOST} of them, and one more.
  select * into c from creature where world_id = w and id = a;
  insert into said values ('BEFORE', max_health(c) || '|' || attack_of(c) || '|' || beast_mul(c, 'speed') || '|' || beast_mul(c, 'work'));
  perform give(w, u, 'ancient_pot', ${4 * POT_MOST + 1}, 30);
  perform perform_creature(w, u, 'use_ancient_pot', jsonb_build_object('kind', 'creature', 'id', a));
  insert into said select 'POTONE', (select boosts::text from creature where world_id = w and id = a) || '|'
    || (select text from event where world_id = w and uid = u and text like 'Ancient pot used on%' order by n desc limit 1);
  for i in 2..${4 * POT_MOST} loop
    perform perform_creature(w, u, 'use_ancient_pot', jsonb_build_object('kind', 'creature', 'id', a));
  end loop;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('AFTER', max_health(c) || '|' || attack_of(c) || '|' || beast_mul(c, 'speed') || '|' || beast_mul(c, 'work'));
  insert into said values ('BOOSTS', (select string_agg(k || ':' || (c.boosts->>k), ',' order by k) from jsonb_object_keys(c.boosts) k)
    || '|' || pack_count(w, u, 'ancient_pot') || '|' || coalesce(creature_refusal(w, u, 'use_ancient_pot', jsonb_build_object('kind', 'creature', 'id', a)), '-'));
  perform perform_creature(w, u, 'use_ancient_pot', jsonb_build_object('kind', 'creature', 'id', a));
  insert into said values ('POTKEPT', pack_count(w, u, 'ancient_pot')::text);

  -- What the island sends of yours, and of nobody else's.
  v_j := rpc_creatures(w, 40);
  insert into said select 'SENT', coalesce((select e->'boosts' from jsonb_array_elements(v_j) e where (e->>'id')::int = a)::text, '-')
    || '|' || coalesce((select e->>'age' from jsonb_array_elements(v_j) e where (e->>'id')::int = a), '-')
    || '|' || coalesce((select (e ? 'boosts')::text from jsonb_array_elements(v_j) e where (e->>'id')::int = v_wild), '-');
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(2051);
// Far enough on that one born a month ago was born after the clock started, and so has an age at all.
g.time = 3600 * 24 * 60;
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
const ash = g.creatures.spawn('rabba', g.player.x + 1, g.player.y, 'active', g.rand, g.time - 3600 * 24 * 30);
ash.traits = [];
ash.rare = 0;
ash.name = 'Ash';
const wild = g.creatures.spawn('rabba', g.player.x - 1, g.player.y, 'wild', g.rand, g.time - 3600 * 24 * 30);
const T = { kind: 'creature' as const, id: ash.id };
const comb = CREATURE_ACTION_BY_ID.get('use_ancient_comb')!;
const file = CREATURE_ACTION_BY_ID.get('use_ancient_file')!;
const pot = CREATURE_ACTION_BY_ID.get('use_ancient_pot')!;
const count = (id: string): number => g.inventory.countAll(id);
const use = (def: typeof comb): string | null => {
  const why = def.check?.(T, g) ?? null;
  if (!why) def.perform(T, g);
  return why;
};
const told = (start: string): string[] => g.log.map((e) => e.text).filter((t) => t.startsWith(start));

/* ---- both ---------------------------------------------------------------------------- */

const browserRelics = RELICS.filter((r) => r.name in RESULTS).map((r) => `${r.name}:${r.result}`).sort().join(',');
check('an old pot, a bone comb and an old file restore into an ancient pot, comb and file, on both sides',
  browserRelics === Object.entries(RESULTS).map(([k, v]) => `${k}:${v}`).sort().join(',') && at('RELICS') === browserRelics, at('RELICS'));
check('the three are items of their own named Ancient comb, file and pot, and a bone comb is no item any more, on both sides',
  at('ITEMS') === 'ancient_comb:Ancient comb,ancient_file:Ancient file,ancient_pot:Ancient pot'
    && ['ancient_comb', 'ancient_file', 'ancient_pot'].every((id) => ITEM_DEFS[id] && !ITEM_DEFS[id].description?.includes('{')) && !ITEM_DEFS.bone_comb, at('ITEMS'));
check('their descriptions say the numbers off the rules',
  ITEM_DEFS.ancient_file.description!.includes(`1 in ${FILE_RARITY_ODDS}`) && ITEM_DEFS.ancient_pot.description!.includes(`${Math.round(POT_STEP * 100)}% more`),
  `${ITEM_DEFS.ancient_file.description} / ${ITEM_DEFS.ancient_pot.description}`);
check(`a comb leaves one ${COMB_INTO} second into the stage, a file is one in ${FILE_RARITY_ODDS}, a pot point ${POT_STEP} and ${POT_MOST} a stat, on both sides`,
  at('NUMBERS') === `${COMB_INTO}|${FILE_RARITY_ODDS}|${POT_STEP}|${POT_MOST}`, at('NUMBERS'));
check('the three are creature actions the island does and prices',
  at('PORTED') === 'use_ancient_comb:true:true,use_ancient_file:true:true,use_ancient_pot:true:true'
    && ['use_ancient_comb', 'use_ancient_file', 'use_ancient_pot'].every((id) => ACTIONS.some((a) => a.id === id)), at('PORTED'));
check('the four base stats are the same and said the same on both sides',
  at('STATS') === BASE_STATS.map((s) => `${s.id}:${s.name}:${s.says}`).join('|'), at('STATS'));

// Refusals with nothing in the pack, and on a wild one.
check('on the island, without one in the pack it is refused', at('NONE') === 'Need an ancient comb.', at('NONE'));
check('in the browser, without one the menu offers nothing, and it is refused in the same words',
  !comb.applies(T, g) && comb.check?.(T, g) === at('NONE'), comb.check?.(T, g) ?? '-');
g.inventory.add('ancient_comb', { ql: 30 });
g.inventory.add('ancient_comb', { ql: 30 });
g.inventory.add('ancient_comb', { ql: 30 });
check('a wild one is not yours on either side, and its menu offers nothing',
  at('WILD') === 'Not yours.' && !comb.applies({ kind: 'creature', id: wild.id }, g)
    && comb.check?.({ kind: 'creature', id: wild.id }, g) === 'Not yours.', at('WILD'));

// The comb.
{
  const [age0, why0] = at('COMB:0').split('|');
  const steps = [1, 2, 3].map((i) => at(`COMB:${i}`).split('|'));
  check('on the island, an old one combed is grown again, as old as one just grown, and one comb is used',
    age0 === 'old' && why0 === '-' && steps[0][0] === 'grown' && near(Number(steps[0][1]), YOUNG_FOR + COMB_INTO, 1e-3) && steps[0][2] === '2', at('COMB:1'));
  check('on the island, a grown one combed is young, as one just born, and a young one is refused and keeps its comb',
    steps[1][0] === 'young' && Number(steps[1][1]) < COMB_INTO + 1 && steps[1][2] === '1'
      && steps[2][2] === '1' && steps[2][3] === 'Ash is already young.', `${at('COMB:2')} ${at('COMB:3')}`);
  check('on the island, at half the pace for its keeper\'s Kin, it is put twice as long ago and is grown',
    at('COMBKIN').split('|')[0] === 'grown' && near(Number(at('COMBKIN').split('|')[1]), (YOUNG_FOR + COMB_INTO) / 0.5, 1e-3), at('COMBKIN'));

  const was = ageOf(ash, g.time);
  const why1 = use(comb);
  const age1 = ageOf(ash, g.time);
  const lived1 = g.time - ash.born;
  const left1 = count('ancient_comb');
  const why2 = use(comb);
  const age2 = ageOf(ash, g.time);
  const left2 = count('ancient_comb');
  const why3 = use(comb);
  check('in the browser, an old one combed is grown again, as old as one just grown, and one comb is used',
    was === 'old' && why1 === null && age1 === 'grown' && near(lived1, YOUNG_FOR + COMB_INTO) && left1 === 2, `${was} ${age1} ${lived1} ${left1}`);
  check('in the browser, a grown one combed is young, and a young one is refused in the island\'s words and keeps its comb',
    why2 === null && age2 === 'young' && left2 === 1 && why3 === steps[2][3] && count('ancient_comb') === 1, `${age2} ${left2} ${why3}`);
  check('both sides say the same when it is combed',
    told('Ancient comb used on').join(' / ') === at('COMBTOLD'), `${told('Ancient comb used on').join(' / ')} | ${at('COMBTOLD')}`);
  ash.born = g.time - 3600 * 24 * 30;
  ash.kept = { 'kept:age': 0.5 };
  use(comb);
  check('in the browser, at half the pace it is put twice as long ago and is grown',
    ageOf(ash, g.time) === 'grown' && near(g.time - ash.born, (YOUNG_FOR + COMB_INTO) / 0.5), `${g.time - ash.born}`);
  ash.kept = undefined;
  ash.born = g.time - 3600 * 24 * 30;
}

// The file.
{
  const [steps, left, up, none] = at('FILE').split('|').map(Number);
  check(`on the island, ${FILES} files make it a step rarer about one time in ${FILE_RARITY_ODDS}, each is used, and each says which`,
    inBand(steps) && left === 0 && up === steps && none === FILES - steps, at('FILE'));
  check(`on the island, a ${TOP} one is refused and keeps its file`,
    at('FILETOP') === `${TOP}|Ash is already ${TOP}, the top rarity.` && at('FILEKEPT') === 'true', `${at('FILETOP')} ${at('FILEKEPT')}`);
  for (let i = 0; i < FILES; i++) g.inventory.add('ancient_file', { ql: 30 });
  let up2 = 0;
  let saidUp = 0;
  let saidNone = 0;
  for (let i = 0; i < FILES; i++) {
    use(file);
    // Read as each is said: the log keeps only so many lines.
    const last = g.log[g.log.length - 1]?.text ?? '';
    if (last.startsWith('Ancient file used on Ash: now rare,')) saidUp += 1;
    if (last.startsWith('Ancient file used on Ash: no change.')) saidNone += 1;
    if (ash.rare) {
      up2 += 1;
      ash.rare = 0;
    }
  }
  check(`in the browser, ${FILES} files make it a step rarer about one time in ${FILE_RARITY_ODDS}, each is used, and each says which`,
    inBand(up2) && count('ancient_file') === 0 && saidUp === up2 && saidNone === FILES - up2, `${up2} ${saidUp} ${saidNone} ${count('ancient_file')}`);
  ash.rare = RARITIES.length - 1;
  g.inventory.add('ancient_file', { ql: 30 });
  check(`in the browser, a ${TOP} one is refused in the island's words and keeps its file`,
    use(file) === at('FILETOP').split('|')[1] && count('ancient_file') === 1, file.check?.(T, g) ?? '-');
  ash.rare = 0;
}

// The pot.
{
  const def = SPECIES.rabba;
  const [h0, a0, s0, w0] = at('BEFORE').split('|').map(Number);
  const [h1, a1, s1, w1] = at('AFTER').split('|').map(Number);
  const full = 1 + POT_STEP * POT_MOST;
  check(`on the island, a pot puts a point in one stat and says what it is worth`,
    /^\{"(hardy|tough|speed|work)": 1\}\|Ancient pot used on Ash: (health|attack|speed|work) 1\/10 points, .+ \+3%\.$/.test(at('POTONE')),
    at('POTONE'));
  check(`on the island, ${4 * POT_MOST} pots put ${POT_MOST} in every stat, and health, attack, speed and work are each ${full} what they were`,
    h0 === def.health && h1 === Math.round(def.health * full) && near(a1, a0 * full, 1e-5) && near(s1, s0 * full, 1e-5) && near(w1, w0 * full, 1e-5),
    `${at('BEFORE')} -> ${at('AFTER')}`);
  check('on the island, with every stat full the next is refused and kept',
    at('BOOSTS') === `hardy:${POT_MOST},speed:${POT_MOST},tough:${POT_MOST},work:${POT_MOST}|1|Ash: every base stat at ${POT_MOST} ancient pot points, the max.`
      && at('POTKEPT') === '1', `${at('BOOSTS')} ${at('POTKEPT')}`);
  check('the island sends your own one\'s points and its age, and nobody else\'s points',
    at('SENT') === `{"work": ${POT_MOST}, "hardy": ${POT_MOST}, "speed": ${POT_MOST}, "tough": ${POT_MOST}}|old|false`, at('SENT'));

  const before = { h: maxHealth(ash, def), a: attackOf(ash, def), s: g.creatures.speedMul(ash), w: g.creatures.workMul(ash) };
  for (let i = 0; i < 4 * POT_MOST + 1; i++) g.inventory.add('ancient_pot', { ql: 30 });
  use(pot);
  const first = BASE_STATS.filter((s) => potPoints(ash, s.id) === 1).map((s) => s.id);
  const firstSaid = told('Ancient pot used on Ash')[0] ?? '';
  for (let i = 1; i < 4 * POT_MOST; i++) use(pot);
  check('in the browser, a pot puts a point in one stat and says it as the island does',
    first.length === 1 && firstSaid.replace(/: \w+ 1\/10 points, .+ \+3%/, 'X') === at('POTONE').split('|')[1].replace(/: \w+ 1\/10 points, .+ \+3%/, 'X'),
    firstSaid);
  check(`in the browser, ${4 * POT_MOST} pots put ${POT_MOST} in every stat, and health, attack, speed and work are each ${full} what they were`,
    BASE_STATS.every((s) => potPoints(ash, s.id) === POT_MOST) && before.h === def.health && maxHealth(ash, def) === Math.round(def.health * full)
      && near(attackOf(ash, def), before.a * full) && near(g.creatures.speedMul(ash), before.s * full) && near(g.creatures.workMul(ash), before.w * full),
    JSON.stringify(ash.boosts));
  check('in the browser, with every stat full the next is refused in the island\'s words and kept',
    use(pot) === at('BOOSTS').split('|')[2] && count('ancient_pot') === 1, pot.check?.(T, g) ?? '-');
  // The card.
  const tags = baseStatTags(g, ash);
  check(`the Wildermon window's card says each base stat as the rules read it, with the ${POT_MOST} points in it`,
    tags.length === BASE_STATS.length && tags[0].text === `Health ${maxHealth(ash, def)} (+${POT_MOST} of ${POT_MOST} from ancient pots)`
      && tags.every((t) => t.text.endsWith(`(+${POT_MOST} of ${POT_MOST} from ancient pots)`)) && tags[3].text.startsWith(`Work ×${g.creatures.workMul(ash).toFixed(2)}`),
    tags.map((t) => t.text).join(' / '));
  const plain = g.creatures.spawn('rabba', g.player.x + 1, g.player.y + 1, 'active', g.rand, g.time - 3600 * 24 * 30);
  check('and one with no points says the stat alone', baseStatTags(g, plain).every((t) => !t.text.includes('ancient pots')), baseStatTags(g, plain)[0].text);
  // And what the island sends is what the browser reads.
  const seen = g.creatures.list.get(ash.id) as Creature;
  g.creatures.sawAll([{ id: ash.id, species: 'rabba', name: 'Ash', variant: 0, mode: 'active', stance: 'defensive', x: seen.x, y: seen.y, health: 10, age: 'young', boosts: { tough: 3 } }], g.time);
  const back = g.creatures.list.get(ash.id) as Creature;
  check('the browser reads the points and the age the island sends', potPoints(back, 'tough') === 3 && potPoints(back, 'hardy') === 0 && ageOf(back, g.time) === 'young',
    `${JSON.stringify(back.boosts)} ${ageOf(back, g.time)}`);
}

// A save keeps the points, and carries a bone comb across.
{
  const s = Game.create(7);
  for (const c of [...s.creatures.list.values()]) s.creatures.list.delete(c.id);
  const c = s.creatures.spawn('rabba', s.player.x + 1, s.player.y, 'active', s.rand, s.time - 3600 * 24 * 30);
  c.boosts = { speed: 4 };
  s.inventory.addItem({ uid: s.inventory.nextUid++, id: 'bone_comb', ql: 25, dmg: 0, count: 1 });
  const back = await unpack(await packLand(s), packWorld(s));
  check('a save keeps what ancient pots have put into one, and a bone comb in it comes back an ancient comb',
    potPoints(back!.creatures.get(c.id)!, 'speed') === 4 && back!.inventory.items.some((it) => it.id === 'ancient_comb') && !back!.inventory.items.some((it) => it.id === 'bone_comb'),
    JSON.stringify(back?.creatures.get(c.id)?.boosts));
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nrestored relics on a wildermon — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
