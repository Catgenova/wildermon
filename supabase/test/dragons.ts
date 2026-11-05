/**
 * The dragon's three subspecies.
 *
 * Asked for: "All 3 dragons": every dragon is a Runewing Dragon, a Runestone Drake or a Stormcoil Dragon, by its
 * variant -- the one the island rolls evenly among the dragon's three when it puts one out (`creature_spawn`) and
 * sends with it (`rpc_creatures`) -- with the same health, blow and speed, as every ogre is one of its three
 * (`supabase/test/ogres.ts`, the same mechanism: `SpeciesDef.subspecies`).
 *
 *   * the browser's: three names, one for each of the dragon's variants, and each named, drawn and stated by its own;
 *   * the same health and blow, whichever it is;
 *   * the field guide's Subspecies lines and the hover card;
 *   * the island's: as many variants as names, put out evenly among them over many spawns, and no dragon left in the
 *     fourth variant there was (`20261105050000_dragon_subspecies.sql`);
 *   * both sides agree for a set of ids: the island sends each one's variant, and the browser, taking the island's
 *     rows, calls each by its variant's subspecies and draws it as that subspecies' body.
 *
 * The browser's half runs on its own; the island's against the database the suite leaves behind (Hoarding, and Dane
 * on it), in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { creatureLines } from '../../src/ui/creatureinfo';
import { attackOf, Creatures, kindName, maxHealth, SPECIES, type IslandCreature } from '../../src/game/creatures';
import { guidePage } from '../../src/game/guide';

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
/** Whether `n` of `of` draws is within four standard deviations of a chance `p`. */
const about = (n: number, of: number, p: number): boolean => Math.abs(n - of * p) <= 4 * Math.sqrt(of * p * (1 - p));

const DRAGON = SPECIES.dragon;
const NAMES = DRAGON.subspecies ?? [];

/* ---- the browser ------------------------------------------------------------------------------ */

check(`three subspecies, one for each of the dragon's variants: ${NAMES.join(', ')}`,
  NAMES.length === 3 && DRAGON.variants.length === NAMES.length && new Set(NAMES).size === 3);
check('the ogre and the dragon are the only kinds with subspecies', Object.values(SPECIES).every((d) => d.id === 'ogre' || d.id === 'dragon' || !d.subspecies));

const row = (id: number, variant: number): IslandCreature => ({ id, species: 'dragon', name: DRAGON.name, variant, mode: 'wild', stance: 'aggressive', x: 5, y: 5, health: DRAGON.health, traits: [] });
const game = Game.create(4242);
for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
{
  const herd = new Creatures();
  herd.sawAll(NAMES.map((_, v) => row(100 + v, v)));
  const seen = NAMES.map((_, v) => herd.get(100 + v)!);
  check('each is called its subspecies, and one nobody named takes that name',
    seen.every((c, v) => kindName(c) === NAMES[v] && c.name === NAMES[v]), seen.map((c) => `${c.variant}:${c.name}`).join(', '));
  check('the same health and blow whichever it is',
    seen.every((c) => maxHealth(c, DRAGON) === maxHealth(seen[0], DRAGON) && attackOf(c, DRAGON) === attackOf(seen[0], DRAGON)),
    seen.map((c) => `${maxHealth(c, DRAGON)}/${attackOf(c, DRAGON)}`).join(', '));
  game.creatures.sawAll(NAMES.map((_, v) => row(100 + v, v)));
  const lines = NAMES.map((_, v) => creatureLines(game, game.creatures.get(100 + v)!)[0]);
  check('its hover card names it', lines.every((l, v) => l === `${NAMES[v]} · hostile`), lines.join(' / '));
}
{
  const sub = guidePage(DRAGON).find((s) => s.head === 'Subspecies');
  check('the field guide lists them, each 1 in 3 wild', !!sub && sub.lines.length === 3 && sub.lines.every((l, v) => l.startsWith(`${NAMES[v]}: 1 in 3 wild`)), sub?.lines.join(' / '));
}

/* ---- the island ------------------------------------------------------------------------------ */

const SPAWNS = 600;
const IDS = 9;
const out = psql(`
begin;
select setseed(0.5) \\g /dev/null
create temp table said (k text, v text);
do $t$
declare w uuid; dane uuid; v_x double precision; v_y double precision; v_id int; v_i int;
begin
  insert into said values ('VARIANTS', (select variants::text from species_def where id = 'dragon'));
  insert into said values ('OUTSIDE', (select count(*)::text from creature where species = 'dragon' and variant not between 0 and 2));
  select id into w from world where name = 'Hoarding';
  select uid into dane from player where world_id = w and name = 'Dane';
  perform set_config('request.jwt.claims', json_build_object('sub', dane)::text, true);
  select x, y into v_x, v_y from player where world_id = w and uid = dane;
  delete from creature where world_id = w and species = 'dragon';
  -- Put out many times, and counted by variant.
  for v_i in 1..${SPAWNS} loop
    v_id := creature_spawn(w, 'dragon', v_x + 40, v_y + 40, 'wild', now() - interval '10 days');
    insert into said select 'SPAWN', variant::text from creature where world_id = w and id = v_id;
  end loop;
  delete from creature where world_id = w and species = 'dragon';
  -- A set of ids near Dane, as the island sends them.
  for v_i in 1..${IDS} loop
    v_id := creature_spawn(w, 'dragon', v_x + 2 + (v_i % 3) * 2, v_y + 2 + (v_i / 3) * 2, 'wild', now() - interval '10 days');
  end loop;
  insert into said select 'SENT', (e->>'id') || ':' || (e->>'variant') || ':' || (e->>'name')
    from jsonb_array_elements(rpc_creatures(w, 12)) e where e->>'species' = 'dragon';
end $t$;
select k || '|' || coalesce(v, 'NULL') from said;
rollback;
`);
const lines = out.split('\n');
const answers = (key: string): string[] => lines.filter((l) => l.startsWith(`${key}|`)).map((l) => l.slice(key.length + 1));

check(`the island's dragon has as many variants as there are subspecies: ${answers('VARIANTS')[0]}`, answers('VARIANTS')[0] === String(NAMES.length));
check(`no dragon on the island in a variant outside them: ${answers('OUTSIDE')[0]}`, answers('OUTSIDE')[0] === '0');
{
  const vs = answers('SPAWN').map(Number);
  const counts = NAMES.map((_, v) => vs.filter((x) => x === v).length);
  check(`island, ${SPAWNS} put out: each subspecies about a third (${counts.join(', ')}), none outside them`,
    vs.length === SPAWNS && vs.every((v) => v >= 0 && v < NAMES.length) && counts.every((n) => about(n, SPAWNS, 1 / NAMES.length)));
}
{
  const sent = answers('SENT').map((s) => { const [id, variant, name] = s.split(':'); return { id: Number(id), variant: Number(variant), name }; });
  const herd = new Creatures();
  herd.sawAll(sent.map((s) => ({ ...row(s.id, s.variant), name: s.name })));
  const agree = sent.filter((s) => {
    const c = herd.get(s.id);
    return c && c.variant === s.variant && kindName(c) === NAMES[s.variant] && c.name === NAMES[s.variant];
  });
  check(`both sides agree for ${sent.length} ids: the island's variant is the browser's subspecies (${sent.map((s) => `${s.id}:${NAMES[s.variant]?.split(' ')[0]}`).join(', ')})`,
    sent.length === IDS && agree.length === IDS && sent.every((s) => s.name === DRAGON.name));
}

/* ---- drawn as its own body -------------------------------------------------------------------- */

// The models need a canvas for nothing but their pictures; their kinds are plain data.
{
  const { DRAGONS } = await import('../../src/render/wild-dragon');
  check('a body for each subspecies, each its own, the same size, each with a strike',
    DRAGONS.length === NAMES.length && new Set(DRAGONS).size === NAMES.length && DRAGONS.every((k) => k.size === DRAGONS[0].size && k.acts?.includes('strike')));
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\ndragon subspecies — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
