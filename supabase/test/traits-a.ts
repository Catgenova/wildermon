/**
 * Twelve more traits on the channels there were: eleven plain ones and a fighting name in four grades.
 *
 * Asked for (part A of thirty): steady-handed, ox-necked, hawk-eyed, lean, bookish, glutton, sure-footed, hearth-bred
 * (communal), thorned (fighting blood), gentle-mouthed, dense-boned and fleece-heavy, each at its rarity and with the
 * figures it was asked with. This asks, of both sides:
 *
 *   * that each is on the table at its rarity, communal where asked, a fighting name in four grades for thorned, with
 *     the same figures on every channel, and that its card says exactly what it was asked to do, the same words on
 *     both sides;
 *   * that each comes up in a wild roll at its rarity, on the island's `roll_trait` and the browser's `rollTrait`;
 *   * that hearth-bred's healing is communal, the one channel no communal trait had touched: a hurt wildermon working
 *     beside one heals that much faster, by the same figure on the island's `creature_settle` and the browser's body.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { bloodMul, type Creature } from '../../src/game/creatures';
import {
  CHANNELS, FIGHTING, gradeId, rollTrait, TIERS, traitMul, traitOf, traitSays, type TraitDef, type TraitTier,
} from '../../src/game/traits';

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

/** What was asked, trait by trait: its rarity, its figures, communal or not, and the card it should print. */
const ASKED: Array<{ id: string; tier: TraitTier; effects: Record<string, number>; aura?: boolean; says: string }> = [
  { id: 'steady_handed', tier: 'common', effects: { yield: 1.05, work: 1.03 }, says: '+3% work, +5% yield' },
  { id: 'ox_necked', tier: 'rare', effects: { haul: 1.2, hardy: 1.1 }, says: '+20% hauling, +10% health' },
  { id: 'hawk_eyed', tier: 'supreme', effects: { sight: 1.5, range: 1.15 }, says: '+50% sight, +15% range' },
  { id: 'lean', tier: 'common', effects: { appetite: 0.95, speed: 1.04 }, says: '+4% speed, −5% upkeep' },
  { id: 'bookish', tier: 'rare', effects: { learn: 1.2, work: 0.95 }, says: '−5% work, +20% learning' },
  { id: 'glutton', tier: 'common', effects: { work: 1.1, appetite: 1.15 }, says: '+10% work, +15% upkeep' },
  { id: 'sure_footed', tier: 'rare', effects: { speed: 1.1, evade: 0.9 }, says: '+10% speed, −10% chance to be hit' },
  { id: 'hearth_bred', tier: 'common', effects: { mend: 1.04 }, aura: true, says: '+4% healing' },
  { id: 'gentle_mouthed', tier: 'rare', effects: { yield: 1.15 }, says: '+15% yield' },
  { id: 'dense_boned', tier: 'fantastic', effects: { hardy: 1.5, soak: 0.8, speed: 0.9 }, says: '−10% speed, +50% health, −20% damage taken' },
  { id: 'fleece_heavy', tier: 'rare', effects: { grow: 1.4 }, says: '+40% regrowth' },
];
/** Thorned, the fighting name: what it was asked at common, and its grades by the ladder every fighting name climbs. */
const THORNED = 'thorned';
const THORNED_SAYS: Record<TraitTier, string> = {
  common: '+5% damage, −5% damage taken',
  rare: '+13% damage, −11% damage taken',
  supreme: '+23% damage, −18% damage taken',
  fantastic: '+35% damage, −26% damage taken',
};
const NEW_IDS = [...ASKED.map((a) => a.id), ...TIERS.map((t) => gradeId(THORNED, t))];
const arr = (xs: string[]): string => `array[${xs.map((x) => `'${x}'`).join(',')}]::text[]`;
/** Wild rolls each side makes: at nothing, and as a fantastic wildermon's own blood is rolled, at a hundred husbandry. */
const ROLLS = 40000;

/* ---- on the island ----------------------------------------------------------------- */

const U = '7e5b0000-0000-4000-8000-0000000000a7';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; px double precision; py double precision; a int; b int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hearths', 276, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Hearthkeeper');
  select x, y into px, py from player where world_id = w and uid = u;

  insert into said select 'DEF:' || d.id, d.name || '|' || d.tier || '|' || d.aura || '|' || coalesce(d.family, '-') || '|' || coalesce(trait_says(d.id), '')
    from trait_def d where d.id = any(${arr(NEW_IDS)});
  insert into said select 'MUL:' || d.id || '.' || ch.id, round(trait_mul(array[d.id], ch.id)::numeric, 4)::float8::text
    from trait_def d cross join channel_def ch where d.id = any(${arr(NEW_IDS)});
  insert into said select 'ROLL0:' || r, count(*)::text from (select roll_trait('{}', 0, 0) r from generate_series(1, ${ROLLS})) s
    where r = any(${arr(NEW_IDS)}) group by r;
  insert into said select 'ROLL3:' || r, count(*)::text from (select roll_trait('{}', 100, 3) r from generate_series(1, ${ROLLS})) s
    where r = any(${arr(NEW_IDS)}) group by r;

  -- Two at work on one settlement, the one beside it hearth-bred; then the same with nothing communal beside it.
  a := creature_spawn(w, 'roxxen', px + 0.5, py, 'deed', now() - interval '30 days', u);
  b := creature_spawn(w, 'roxxen', px - 0.5, py, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, post = null, hunger = 1, care = 0 where world_id = w and id in (a, b);
  update creature set traits = array['hearth_bred'] where world_id = w and id = b;
  insert into said select 'HERD', round(deed_aura(c, 'mend')::numeric, 4)::float8::text from creature c where c.world_id = w and c.id = a;
  insert into said select 'OWN', round(beast_mul(c, 'mend')::numeric, 4)::float8::text from creature c where c.world_id = w and c.id = b;
  update creature set health = 1, hurt_at = null, bleed_until = null, settled_at = now() - interval '10 seconds' where world_id = w and id = a;
  perform creature_settle(w, a);
  insert into said select 'HEALED', round((health - 1)::numeric, 4)::float8::text from creature where world_id = w and id = a;
  -- Put back as it was before: a worker with no settlement to work is let go by the settle.
  update creature set traits = '{}', mode = 'deed', post = null where world_id = w and id = b;
  update creature set mode = 'deed', post = null, health = 1, hurt_at = null, bleed_until = null, settled_at = now() - interval '10 seconds' where world_id = w and id = a;
  perform creature_settle(w, a);
  insert into said select 'HEALED0', round((health - 1)::numeric, 4)::float8::text from creature where world_id = w and id = a;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const rolled = (k: 'ROLL0' | 'ROLL3', id: string): number => Number(isle.get(`${k}:${id}`) ?? 0);

/* ---- in the browser ---------------------------------------------------------------- */

/** A seeded random, so the odds measured are the same odds every run. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const browserRolls = (husbandry: number, rare: number): Map<string, number> => {
  const rand = seeded(276 + rare);
  const n = new Map<string, number>();
  for (let i = 0; i < ROLLS; i++) {
    const id = rollTrait(rand, [], husbandry, rare);
    if (id) n.set(id, (n.get(id) ?? 0) + 1);
  }
  return n;
};
const wild0 = browserRolls(0, 0);
const wild3 = browserRolls(100, 3);

/* ---- the table and the card ------------------------------------------------------- */

for (const a of ASKED) {
  const t = traitOf(a.id);
  check(`${a.id}: ${a.tier}${a.aura ? ', communal' : ''}, with the figures asked`,
    !!t && t.tier === a.tier && !!t.aura === !!a.aura && !t.family && JSON.stringify(Object.entries(t.effects).sort()) === JSON.stringify(Object.entries(a.effects).sort()),
    JSON.stringify(t));
  check(`${a.id}: the card says "${a.says}" in the browser`, !!t && traitSays(t) === a.says, t ? traitSays(t) : '-');
  check(`${a.id}: and the island has it the same, in the same words`,
    at(`DEF:${a.id}`) === `${t?.name}|${a.tier}|${!!a.aura}|-|${a.says}`, at(`DEF:${a.id}`));
}
const thorned = FIGHTING.find((f) => f.id === THORNED);
check('thorned: a fighting name, +5% damage and −5% damage taken at common', !!thorned && !thorned.aura, JSON.stringify(thorned));
for (const tier of TIERS) {
  const id = gradeId(THORNED, tier);
  const t = traitOf(id) as TraitDef | undefined;
  check(`${id}: the card says "${THORNED_SAYS[tier]}" in the browser`, !!t && t.tier === tier && t.family === THORNED && traitSays(t) === THORNED_SAYS[tier],
    t ? traitSays(t) : '-');
  check(`${id}: and the island has it the same, in the same words`,
    at(`DEF:${id}`) === `${t?.name}|${tier}|false|${THORNED}|${THORNED_SAYS[tier]}`, at(`DEF:${id}`));
}
{
  const wrong: string[] = [];
  for (const id of NEW_IDS) {
    for (const ch of CHANNELS) {
      const b = Math.round(traitMul([id], ch.id) * 10000) / 10000;
      if (Number(at(`MUL:${id}.${ch.id}`)) !== b) wrong.push(`${id}.${ch.id} ${at(`MUL:${id}.${ch.id}`)} against ${b}`);
    }
  }
  check(`each of the ${NEW_IDS.length} rows is worth the same on every one of the ${CHANNELS.length} channels on both sides (trait_mul, traitMul)`,
    wrong.length === 0, wrong.slice(0, 3).join(' / '));
}

/* ---- the wild ---------------------------------------------------------------------- */

for (const id of NEW_IDS) {
  const tier = traitOf(id)?.tier;
  // Common blood is rolled at nothing; anything better on a fantastic wildermon's own table, which has no common in it.
  const k = tier === 'common' ? 'ROLL0' : 'ROLL3';
  const b = (tier === 'common' ? wild0 : wild3).get(id) ?? 0;
  check(`${id} comes up in a wild roll at ${tier}, on both sides`, rolled(k, id) > 0 && b > 0, `island ${rolled(k, id)}, browser ${b} in ${ROLLS}`);
}

/* ---- hearth-bred heals the herd ---------------------------------------------------- */

const herd = traitOf('hearth_bred')?.effects.mend ?? 0;
const g = Game.create(276);
g.time = 3600 * 24 * 60;
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
const hurt = g.creatures.spawn('roxxen', g.player.x + 1, g.player.y, 'deed', g.rand, g.time - 3600 * 24 * 30);
const lead = g.creatures.spawn('roxxen', g.player.x - 1, g.player.y, 'deed', g.rand, g.time - 3600 * 24 * 30);
for (const c of [hurt, lead]) Object.assign(c, { traits: [], rare: 0, care: 0, hunger: 1, post: undefined });
lead.traits = ['hearth_bred'];
const body = (c: Creature, secs: number): void => {
  (g.creatures as unknown as { body: (g0: Game, c0: Creature, e: number) => unknown }).body(g, c, secs);
};
const heal = (): number => {
  Object.assign(hurt, { health: 1, attackedAt: -1e9, bleedUntil: 0, bleedFrom: undefined });
  body(hurt, 10);
  return Math.round((hurt.health - 1) * 10000) / 10000;
};
const browserHerd = g.creatures.aura(hurt, 'mend');
const healed = heal();
lead.traits = [];
const healed0 = heal();
const per = Math.round(10 * 0.6 * bloodMul(hurt, 'mend') * 10000) / 10000;
check(`hearth-bred: +${Math.round((herd - 1) * 100)}% healing to every wildermon working its settlement, itself included, on the island (deed_aura)`,
  // The bearer's own blood and the herd's, as every communal trait counts for the one carrying it.
  at('HERD') === String(herd) && at('OWN') === String(Math.round(herd * herd * 10000) / 10000), `herd ${at('HERD')}, its own ${at('OWN')}`);
check('in the browser, the herd\'s figure the same (aura)', Math.round(browserHerd * 10000) / 10000 === herd, String(browserHerd));
check('a hurt one beside it heals that much faster in ten seconds on the island (creature_settle), and as fast as before without it',
  Number(at('HEALED')) === Math.round(Number(at('HEALED0')) * herd * 10000) / 10000 && Number(at('HEALED0')) > 0, `${at('HEALED')} against ${at('HEALED0')}`);
check('and the same figures in the browser (body), the same on both sides',
  healed === Math.round(healed0 * herd * 10000) / 10000 && healed0 === per && String(healed) === at('HEALED') && String(healed0) === at('HEALED0'),
  `${healed} against ${healed0}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\ntwelve more traits — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
