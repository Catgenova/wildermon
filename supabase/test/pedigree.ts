/**
 * A pedigree on the creature window.
 *
 * Asked for: "A pedigree on the creature window. Show the dam, the sire and
 * which traits came from which, so breeding can be planned."
 *
 * Asked of both sides, of a dam and a sire with known traits -- one trait
 * they share, and fanged in a different grade on each:
 *
 *   * a covering through the door writes the sire, by id and by name, and
 *     where each trait came from into what the dam carries;
 *   * the young one is born with a pedigree: its dam and its sire by id and
 *     by name, and where each of its traits came from;
 *   * over five hundred coverings more, every trait a young one carries says
 *     where it came from and nothing else does; one from the dam is a trait
 *     the dam carries and the sire does not, grade and all, one from the sire
 *     the other way about, one from both a trait they both carry, and one
 *     bred up is above common; all five words turn up, they are the same five
 *     words on both sides, and how often each turns up agrees between them;
 *   * a young one of a covering made before pedigrees were kept has none;
 *   * a mutation (one young in `MUTATION_ODDS`) is a name neither parent
 *     carries, a tier above the best of theirs, and says so;
 *
 * and of a line (asked for: "each creature carries, per trait channel, a line
 * depth: the number of consecutive generations, ending with itself, in which
 * the creature on that line carried a trait on that channel ... Cap at
 * PEDIGREE_MOST"), of both sides:
 *
 *   * every young one's line is `bredLine` of its traits and its parents' as
 *     they stood at the covering, and goes into its pedigree;
 *   * six generations bred down one line deepen it by one a generation and
 *     stop at `PEDIGREE_MOST`, and a young one carrying nothing on a channel
 *     stands at none there;
 *   * what a line is worth is the same on both sides, in the blood the rules
 *     read (`bloodMul`, `beast_mul`), on a channel where more is better and one
 *     where less is, and nothing on a channel it no longer carries;
 *   * the backfill: nothing already on an island has a line past one, so every
 *     one of them stands at one on each channel it carries a trait on and gains
 *     nothing;
 *   * somebody else is sent its line only on the channels of the traits they
 *     can read;
 *
 * of the browser, that a pedigree and a covering in hand go through a save
 * and come back, that the tooltip names the dam and the sire of a bred one
 * and says nothing of one that was not, and that the island's answer is taken
 * as it comes, a creature it sends none for having none;
 *
 * and of the island, that `rpc_creatures` sends your own young one's pedigree
 * whole and nothing for a creature with none, and somebody else's saying where
 * a trait came from only for the traits they can read: a common one at any
 * husbandry, a rare one at one past its tier's level and not a point under,
 * and all of them to a reader who took the Knowledge path's Reader.
 */
import { execFileSync } from 'node:child_process';
// `game` first: the root of the module graph, so nothing below comes out half-built.
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { Creatures, type Creature, type IslandCreature, type Pedigree } from '../../src/game/creatures';
import { TIER_LEVEL } from '../../src/game/husbandry';
import { packLand, packWorld, unpack } from '../../src/game/save';
import {
  bredLine, CHANNELS, depthMul, familyOf, lineDepth, lineMul, mutationTier, PEDIGREE_MOST, TRAIT_SOURCES, traitTier, type Line, type TraitChannel, type TraitSource,
} from '../../src/game/traits';
import { bloodMul } from '../../src/game/creatures';
import { creatureLines } from '../../src/ui/creatureinfo';

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

/* ---- the pair, the same on both sides --------------------------------------- */

const DAM = { name: 'Snow', traits: ['willing', 'fleet', 'fanged_rare'] };
const SIRE = { name: 'Horn', traits: ['willing', 'thrifty', 'fanged'] };
const HUSBANDRY = 50;
const CARE = 0.5;
const COVERINGS = 500;
const WORDS = Object.keys(TRAIT_SOURCES).sort();
/** The words a draw writes often enough to turn up in five hundred: all but a mutation, one young in two hundred. */
const DRAWN = WORDS.filter((w) => w !== 'mutation');
/** A young one whose record is written by hand, for the reading of it: a common, a rare and a supreme trait, and a line on work and on speed. */
const KNOWN = { traits: ['willing', 'fleet', 'swift'], from: { willing: 'both', fleet: 'dam', swift: 'up' } as Record<string, TraitSource>, line: { work: 2, speed: 3 } as Line };

const sorted = (xs: Iterable<string>): string => JSON.stringify([...xs].sort());
/** What each side's blood made of each line in `BONUS`, over the same blood with none. */
const browserBonus: Record<string, number> = {};
/**
 * The same record, whatever order its keys were written in: jsonb keeps an
 * object's keys shortest first, so the island's `{dam, from, sire}` is the
 * browser's `{dam, sire, from}`. A list keeps its order, since that is the
 * order the traits were drawn in.
 */
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, canon(x)]))
  : v;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
/** A record's words, keyed as its traits are: the same keys, whatever order they were written in. */
const keyedAs = (from: Record<string, string> | undefined, traits: string[]): boolean => sorted(Object.keys(from ?? {})) === sorted(traits);

interface Young {
  traits: string[];
  pedigree: Pedigree | null;
}

/** A parent as a line reads it: its traits and what its pedigree says of its line. */
const asParent = (who: { traits: string[]; line?: Line }): { traits: string[]; line?: Line } => ({ traits: who.traits, line: who.line });

/**
 * The same questions of a side's young ones, whichever side bred them. Hands
 * back how often each word turned up, as a share of every trait they carry.
 */
function judge(side: string, young: Young[], dam: { id: number; name: string; traits: string[] }, sire: { id: number; name: string; traits: string[] }): Record<string, number> {
  let named = 0;
  let keyed = 0;
  const wrong: string[] = [];
  const count: Record<string, number> = {};
  let total = 0;
  for (const y of young) {
    const p = y.pedigree;
    if (p && same(p.dam, { id: dam.id, name: dam.name }) && same(p.sire, { id: sire.id, name: sire.name })) named++;
    if (p && keyedAs(p.from, y.traits)) keyed++;
    for (const [id, src] of Object.entries(p?.from ?? {})) {
      count[src] = (count[src] ?? 0) + 1;
      total++;
      const inDam = dam.traits.includes(id);
      const inSire = sire.traits.includes(id);
      const fits = src === 'dam' ? inDam && !inSire
        : src === 'sire' ? inSire && !inDam
        : src === 'both' ? inDam && inSire
        : src === 'up' ? traitTier(id) !== 'common'
        : src === 'mutation' ? ![...dam.traits, ...sire.traits].some((t) => familyOf(t) === familyOf(id)) && traitTier(id) === mutationTier(sire.traits, dam.traits)
        : src === 'roll';
      if (!fits) wrong.push(`${id} said to be ${src}`);
    }
  }
  check(`${side}: every young one names its dam and its sire, by id and by name`, named === young.length, `${named} of ${young.length}`);
  check(`${side}: every trait a young one carries says where it came from, and nothing else does`, keyed === young.length, `${keyed} of ${young.length}`);
  check(`${side}: from the dam is the dam's very trait and not the sire's, from the sire the other way about, from both theirs, bred up above common, `
    + 'a mutation a name neither carries a tier above the best of theirs', wrong.length === 0, wrong.slice(0, 5).join('; '));
  check(`${side}: the ${DRAWN.length} words of a draw all turn up, and no word but the ${WORDS.length}`,
    DRAWN.every((w) => count[w]) && Object.keys(count).every((w) => WORDS.includes(w)), sorted(Object.keys(count)));
  // Its line, off its traits and the parents', who carry no line of their own here: one past theirs on each channel it shares with one of them.
  const lined = young.filter((y) => same(y.pedigree?.line ?? null, bredLine(y.traits, asParent(dam), asParent(sire)))).length;
  check(`${side}: every young one's line is one past its parents' on each channel it carries a trait on that one of them does`, lined === young.length,
    `${lined} of ${young.length}; ${JSON.stringify(young.find((y) => !same(y.pedigree?.line ?? null, bredLine(y.traits, asParent(dam), asParent(sire))))?.pedigree?.line)}`);
  const share: Record<string, number> = {};
  for (const w of WORDS) share[w] = (count[w] ?? 0) / Math.max(1, total);
  console.log(`   ${side}, ${young.length} young ones: ${WORDS.map((w) => `${w} ${(share[w] * 100).toFixed(1)}%`).join(', ')}`);
  return share;
}

/* ---- the browser ------------------------------------------------------------ */

console.log('--- the browser');
const game = Game.create(4242);
// Seeded, so the five hundred are the same five hundred every run.
let seed = 20260925;
game.rand = (): number => {
  seed = (seed * 48271) % 2147483647;
  return seed / 2147483647;
};
game.skills.values.set('animal_husbandry', HUSBANDRY);
game.deed = { name: 'Hearth', x: game.player.tileX + 4, y: game.player.tileY + 4, radius: 5, level: 3 };
for (const c of [...game.creatures.list.values()]) if (c.mode !== 'wild') c.mode = 'wild';
const raise = (who: { name: string; traits: string[] }, sex: 'male' | 'female', dx: number): Creature => {
  const c = game.creatures.spawn('rabba', game.player.x + dx, game.player.y, 'deed', game.rand, 0);
  Object.assign(c, { name: who.name, sex, traits: [...who.traits], hunger: 1, care: CARE });
  return c;
};
const dam = raise(DAM, 'female', 0.3);
const sire = raise(SIRE, 'male', -0.3);

// Through the door once, as a keeper does it. The pairing is a roll, so it is tried until it takes.
const pairIt = ACTION_BY_ID.get('pair_creature')!;
const onDam: Target = { kind: 'creature', id: dam.id };
let refused: string | null = null;
for (let i = 0; i < 12 && dam.due === 0; i++) {
  dam.bredAt = -1e9;
  sire.bredAt = -1e9;
  refused = pairIt.check?.(onDam, game) ?? null;
  if (refused) break;
  pairIt.perform(onDam, game);
}
check('browser: the pair is put together through the door', dam.due > 0, refused ?? '');
const carried = dam.unborn;
check('browser: the covering writes the sire, by id and by name, and where each trait came from, into what she carries',
  same(carried?.sire, { id: sire.id, name: 'Horn' }) && keyedAs(carried?.from, carried?.traits ?? []), JSON.stringify(carried));
dam.due = game.time;
const first = game.creatures.giveBirth(game, dam);
check('browser: the young one is born with its pedigree: its dam, its sire, and where each trait came from, as the covering wrote it',
  !!first && same(first.traits, carried?.traits) && same(first.pedigree, { dam: { id: dam.id, name: 'Snow' }, sire: { id: sire.id, name: 'Horn' }, from: carried?.from, line: carried?.line }),
  JSON.stringify(first?.pedigree));

const browserYoung: Young[] = [];
for (let i = 0; i < COVERINGS; i++) {
  game.creatures.pair(game, dam, sire, HUSBANDRY);
  dam.due = game.time;
  const c = game.creatures.giveBirth(game, dam);
  if (!c) continue;
  browserYoung.push({ traits: c.traits, pedigree: c.pedigree });
  game.creatures.remove(c.id);
}
const browserShare = judge('browser', browserYoung, { id: dam.id, ...DAM }, { id: sire.id, ...SIRE });

dam.unborn = { traits: ['willing'], sex: 'female' };
dam.due = game.time;
const old = game.creatures.giveBirth(game, dam);
check('browser: a young one of a covering made before pedigrees were kept has none', !!old && old.pedigree === null, JSON.stringify(old?.pedigree));

// What pointing at one says.
const pointed = creatureLines(game, first!);
check('browser: pointing at a bred one names its dam and its sire', pointed.includes('Dam Snow · sire Horn'), pointed.join(' | '));
const pointedDam = creatureLines(game, dam);
check('browser: pointing at one that was not bred says nothing of it', !pointedDam.some((l) => l.startsWith('Dam ')), pointedDam.join(' | '));

// A save, with a pedigree in it and a covering in hand, and back.
game.creatures.pair(game, dam, sire, HUSBANDRY);
const inHand = JSON.parse(JSON.stringify(dam.unborn));
const back = await unpack(await packLand(game), JSON.parse(JSON.stringify(packWorld(game))));
check('browser: a pedigree goes through a save and comes back', !!back && same(back.creatures.get(first!.id)?.pedigree, first!.pedigree),
  JSON.stringify(back?.creatures.get(first!.id)?.pedigree));
check('browser: and so does the sire of a covering in hand, with where each trait came from', !!back && same(back.creatures.get(dam.id)?.unborn, inHand),
  JSON.stringify(back?.creatures.get(dam.id)?.unborn));
check('browser: and one with none still has none', !!back && back.creatures.get(old!.id)?.pedigree === null);

// The island's answer, taken as it comes.
const herd = new Creatures();
const row: IslandCreature = { id: 7, species: 'rabba', name: 'Lamb', variant: 0, mode: 'deed', stance: 'defensive', x: 5, y: 5, health: 10,
  traits: KNOWN.traits, pedigree: { dam: { id: 3, name: 'Snow' }, sire: { id: 4, name: 'Horn' }, from: KNOWN.from } };
herd.sawAll([row]);
check('browser: a pedigree the island sends is the one the card reads', same(herd.get(7)?.pedigree, row.pedigree));
herd.sawAll([{ ...row, pedigree: undefined }]);
check('browser: and a creature it sends none for has none', herd.get(7)?.pedigree === null);

/* ---- a line, both sides' questions ------------------------------------------- */

/** Generations bred down one line: one past the cap, to see it stop there. */
const CHAIN = PEDIGREE_MOST + 1;
/** What each generation's line on work should come to: one past the one before, from one out of the wild, and no further than the cap. */
const CHAIN_WANT = Array.from({ length: CHAIN }, (_, i) => Math.min(PEDIGREE_MOST, i + 2));
/** What a line is worth, asked of each side's blood: traits, the line written, the channel, and what it should come to. */
const BONUS: Array<[string, string[], Line, TraitChannel]> = [
  ['work4', ['willing'], { work: 4 }, 'work'],
  ['work9', ['willing'], { work: 9 }, 'work'],
  ['upkeep5', ['thrifty'], { appetite: 5 }, 'appetite'],
  ['gone', ['fleet'], { work: 4 }, 'work'],
  ['hardy3', ['thick_coated'], { hardy: 3 }, 'hardy'],
];
const bonusWant = (traits: string[], line: Line, ch: TraitChannel): number => (traits.some((t) => lineDepth([t], {}, ch) > 0) ? depthMul(line[ch] ?? 1, ch) : 1);

console.log('--- a line, in the browser');
{
  // Down one line: the last one born, put to one out of the wild carrying willing alone, until a young one carries willing too.
  let line = raise({ name: 'Root', traits: ['willing'] }, 'female', 0.6);
  const depths: number[] = [];
  let none = -1;
  for (let gen = 0; gen < CHAIN; gen++) {
    const mate = raise({ name: `Wild${gen}`, traits: ['willing'] }, 'male', -0.6);
    let born: Creature | null = null;
    for (let k = 0; k < 60 && !born; k++) {
      game.creatures.pair(game, line, mate, 0);
      const un = line.unborn!;
      if (!un.traits.includes('willing')) {
        if (!CHANNELS.some((ch) => ch.id === 'work' && un.traits.some((t) => lineDepth([t], {}, 'work') > 0))) none = un.line?.work ?? 0;
        line.unborn = null;
        continue;
      }
      line.due = game.time;
      born = game.creatures.giveBirth(game, line);
    }
    depths.push(born ? lineDepth(born.traits, born.pedigree?.line, 'work') : -1);
    if (!born) break;
    born.sex = 'female';
    line = born;
  }
  check(`browser: ${CHAIN} generations bred down one line on work come to ${CHAIN_WANT.join(', ')}: one deeper a generation, and no deeper than ${PEDIGREE_MOST}`,
    same(depths, CHAIN_WANT), depths.join(', '));
  check('browser: a young one of that line carrying nothing on work stands at none there', none === 0, String(none));
  // What it is worth, in the blood the rules read.
  for (const [key, traits, ln, ch] of BONUS) {
    const c = raise({ name: key, traits }, 'female', 1.2);
    c.pedigree = null;
    const plain = bloodMul(c, ch);
    c.pedigree = { dam: { id: 1, name: 'A' }, sire: { id: 2, name: 'B' }, from: {}, line: ln };
    browserBonus[key] = bloodMul(c, ch) / plain;
    game.creatures.remove(c.id);
  }
  // Born before lines were kept: a pedigree with no line, and one out of the wild, stand at one on each channel they carry and gain nothing.
  const oldPed: Pedigree = { dam: { id: 1, name: 'A' }, sire: { id: 2, name: 'B' }, from: {} };
  check('browser: one bred before lines were kept, or caught, stands at one on each channel it carries a trait on and at none elsewhere, and gains nothing',
    CHANNELS.every((ch) => lineDepth(DAM.traits, oldPed.line, ch.id) === (lineDepth(DAM.traits, { [ch.id]: 1 }, ch.id) ? 1 : 0)
      && lineMul(DAM.traits, undefined, ch.id) === 1 && lineMul(DAM.traits, oldPed.line, ch.id) === 1)
      && lineDepth(DAM.traits, undefined, 'work') === 1 && lineDepth(DAM.traits, undefined, 'hardy') === 0);
}

/* ---- the island ------------------------------------------------------------- */

const sqlArray = (xs: string[]): string => `'{${xs.join(',')}}'::text[]`;
const isle = psql(`
begin;
select setseed(0.25) \\g /dev/null
create temp table said (k text);
do $b$
declare w uuid; me uuid; them uuid; v_x double precision; v_y double precision;
        v_dam int; v_sire int; v_first int; v_young int; v_known int; v_i int; v_why text;
        v_all jsonb := '[]'; v_seen jsonb; v_line int; v_mate int; v_born int; v_gen int; v_k int; v_none int := -1;
        v_b creature; v_plain double precision;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  select uid into them from player where world_id = w and name = 'Crowd1';
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  update player set act = null, act_queue = '[]'::jsonb where world_id = w and uid = me;
  select x, y into v_x, v_y from player where world_id = w and uid = me;
  -- Nothing of his own about, and no crate for a young one to go into: each goes where it goes and is let go.
  update creature set mode = 'wild', keeper = null where world_id = w and keeper = me and mode in ('active', 'stored', 'deed');
  delete from item where world_id = w and holder = 'player' and holder_uid = me and def = 'creature_crate';
  delete from placed where world_id = w and sub = 'creature_crate' and made_by = me;
  insert into skill (world_id, uid, id, value) values (w, me, 'animal_husbandry', ${HUSBANDRY})
    on conflict (world_id, uid, id) do update set value = ${HUSBANDRY};
  v_dam := creature_spawn(w, 'rabba', v_x + 0.3, v_y, 'deed', now() - interval '10 days', me);
  v_sire := creature_spawn(w, 'rabba', v_x - 0.3, v_y, 'deed', now() - interval '10 days', me);
  update creature set sex = 'female', name = '${DAM.name}', traits = ${sqlArray(DAM.traits)}, hunger = 1, care = ${CARE},
      from_x = to_x, from_y = to_y, leg_at = now(), leg_ends = now(), settled_at = now()
    where world_id = w and id = v_dam;
  update creature set sex = 'male', name = '${SIRE.name}', traits = ${sqlArray(SIRE.traits)}, hunger = 1, care = ${CARE},
      from_x = to_x, from_y = to_y, leg_at = now(), leg_ends = now(), settled_at = now()
    where world_id = w and id = v_sire;
  insert into said values ('IDS|' || v_dam || ',' || v_sire);

  -- The backfill: nothing born before lines were kept has one, so each stands at one on each channel it carries a trait
  -- on, at none elsewhere, and gains nothing; and nothing at all on the island was written a line by the migration.
  insert into said values ('BACKFILL|' || (select count(*) from creature c cross join channel_def ch
    where not coalesce(c.pedigree ? 'line', false)
      and (line_depth(c.traits, c.pedigree->'line', ch.id) <> case when carries_on(c.traits, ch.id) then 1 else 0 end
           or line_mul(c.traits, c.pedigree->'line', ch.id) <> 1)) || ',' || (select count(*) from creature));
  insert into said values ('OLDPED|' || (select string_agg(ch.id || '=' || line_depth(${sqlArray(DAM.traits)}, ('{"dam":{"id":1,"name":"A"},"sire":{"id":2,"name":"B"},"from":{}}'::jsonb)->'line', ch.id)
      || '/' || line_mul(${sqlArray(DAM.traits)}, ('{"dam":{"id":1,"name":"A"},"sire":{"id":2,"name":"B"},"from":{}}'::jsonb)->'line', ch.id), ',' order by ch.id) from channel_def ch));

  -- Down one line, as in the browser: the last one born, put to one out of the wild carrying willing alone.
  v_line := creature_spawn(w, 'rabba', v_x + 0.6, v_y, 'deed', now() - interval '10 days', me);
  update creature set sex = 'female', name = 'Root', traits = '{willing}', hunger = 1, care = ${CARE} where world_id = w and id = v_line;
  for v_gen in 1..${CHAIN} loop
    v_mate := creature_spawn(w, 'rabba', v_x - 0.6, v_y, 'deed', now() - interval '10 days', me);
    update creature set sex = 'male', name = 'Wild' || v_gen, traits = '{willing}', hunger = 1, care = ${CARE} where world_id = w and id = v_mate;
    v_born := null;
    for v_k in 1..60 loop
      perform pair_them(w, v_line, v_mate, 0);
      if not ((select unborn->'traits' from creature where world_id = w and id = v_line) ? 'willing') then
        if not carries_on(array(select jsonb_array_elements_text((select unborn->'traits' from creature where world_id = w and id = v_line))), 'work') then
          v_none := coalesce((select (unborn->'line'->>'work')::int from creature where world_id = w and id = v_line), 0);
        end if;
        update creature set unborn = null, due = null where world_id = w and id = v_line;
        continue;
      end if;
      update creature set due = now() - interval '1 second' where world_id = w and id = v_line;
      v_born := give_birth(w, v_line);
      exit;
    end loop;
    insert into said select 'CHAIN' || v_gen || '|' || coalesce((select line_depth(c.traits, c.pedigree->'line', 'work') from creature c
      where c.world_id = w and c.id = v_born), -1);
    update creature set sex = 'female', hunger = 1, care = ${CARE} where world_id = w and id = v_born;
    v_line := v_born;
  end loop;
  -- And where the chain's own draws threw no young carrying nothing on work (one a generation is bred until it carries
  -- willing, so a few at most are looked at), the last of the line is covered again until one comes, never born.
  for v_k in 1..2000 loop
    exit when v_none <> -1;
    perform pair_them(w, v_line, v_mate, 0);
    if not carries_on(array(select jsonb_array_elements_text((select unborn->'traits' from creature where world_id = w and id = v_line))), 'work') then
      v_none := coalesce((select (unborn->'line'->>'work')::int from creature where world_id = w and id = v_line), 0);
    end if;
    update creature set unborn = null, due = null where world_id = w and id = v_line;
  end loop;
  insert into said values ('NONE|' || v_none);

  -- What a line is worth, in the blood the rules read (beast_mul), over the same blood with none.
  v_b := null;
${BONUS.map(([key, traits, ln, ch]) => `  update creature set traits = ${sqlArray(traits)}, pedigree = null where world_id = w and id = v_dam;
  select * into v_b from creature where world_id = w and id = v_dam;
  v_plain := beast_mul(v_b, '${ch}');
  update creature set pedigree = jsonb_build_object('dam', jsonb_build_object('id', 1, 'name', 'A'), 'sire', jsonb_build_object('id', 2, 'name', 'B'),
      'from', '{}'::jsonb, 'line', '${JSON.stringify(ln)}'::jsonb) where world_id = w and id = v_dam;
  select * into v_b from creature where world_id = w and id = v_dam;
  insert into said values ('BONUS:${key}|' || (beast_mul(v_b, '${ch}') / v_plain)::text);`).join('\n')}
  update creature set traits = ${sqlArray(DAM.traits)}, pedigree = null where world_id = w and id = v_dam;

  -- Through the door once, as a keeper does it. The pairing is a roll, so it is tried until it takes.
  for v_i in 1..12 loop
    exit when (select due from creature where world_id = w and id = v_dam) is not null;
    update creature set bred_at = null where world_id = w and id in (v_dam, v_sire);
    v_why := act_refusal(w, me, 'pair_creature', jsonb_build_object('kind', 'creature', 'id', v_dam));
    exit when v_why is not null;
    perform act_perform(w, me, 'pair_creature', jsonb_build_object('kind', 'creature', 'id', v_dam));
  end loop;
  insert into said values ('REFUSED|' || coalesce(v_why, ''));
  insert into said values ('UNBORN|' || coalesce((select unborn::text from creature where world_id = w and id = v_dam), 'null'));
  update creature set due = now() - interval '1 second' where world_id = w and id = v_dam;
  v_first := give_birth(w, v_dam);
  insert into said values ('FIRST|' || coalesce((select jsonb_build_object('traits', to_jsonb(c.traits), 'pedigree', c.pedigree)::text
                                                   from creature c where c.world_id = w and c.id = v_first), 'null'));

  -- Five hundred more, straight to the covering and the hour.
  for v_i in 1..${COVERINGS} loop
    perform pair_them(w, v_dam, v_sire, ${HUSBANDRY});
    update creature set due = now() - interval '1 second' where world_id = w and id = v_dam;
    v_young := give_birth(w, v_dam);
    select v_all || jsonb_build_array(jsonb_build_object('traits', to_jsonb(c.traits), 'pedigree', c.pedigree))
      into v_all from creature c where c.world_id = w and c.id = v_young;
    delete from creature where world_id = w and id = v_young;
  end loop;
  insert into said values ('YOUNG|' || v_all::text);

  -- A covering made before pedigrees were kept.
  update creature set unborn = jsonb_build_object('traits', '["willing"]'::jsonb, 'sex', 'female'),
      due = now() - interval '1 second' where world_id = w and id = v_dam;
  v_young := give_birth(w, v_dam);
  insert into said values ('OLD|' || coalesce((select pedigree::text from creature where world_id = w and id = v_young), 'null'));

  -- One whose record is known, working his deed where he and Crowd1 both stand, for the reading of it.
  update creature set unborn = jsonb_build_object('traits', '${JSON.stringify(KNOWN.traits)}'::jsonb, 'sex', 'female',
        'sire', jsonb_build_object('id', v_sire, 'name', '${SIRE.name}'), 'from', '${JSON.stringify(KNOWN.from)}'::jsonb,
        'line', '${JSON.stringify(KNOWN.line)}'::jsonb),
      due = now() - interval '1 second' where world_id = w and id = v_dam;
  v_known := give_birth(w, v_dam);
  update creature set keeper = me, mode = 'deed', from_x = v_x, from_y = v_y, to_x = v_x, to_y = v_y,
      leg_at = now(), leg_ends = now(), settled_at = now()
    where world_id = w and id = v_known;
  insert into said values ('KNOWN|' || (select pedigree::text from creature where world_id = w and id = v_known));
  v_seen := rpc_creatures(w, 40);
  insert into said values ('MINE|' || coalesce((select e->>'pedigree' from jsonb_array_elements(v_seen) e where (e->>'id')::int = v_known), 'not sent'));
  insert into said values ('BARE|' || coalesce((select (e ? 'pedigree')::text from jsonb_array_elements(v_seen) e where (e->>'id')::int = v_dam), 'not sent'));

  -- Somebody else, at one husbandry under a rare trait, at one past it, and a reader with Reader and none.
  perform set_config('request.jwt.claims', json_build_object('sub', them)::text, true);
  insert into skill (world_id, uid, id, value) values (w, them, 'animal_husbandry', ${TIER_LEVEL.rare})
    on conflict (world_id, uid, id) do update set value = ${TIER_LEVEL.rare};
  update player set way = null where world_id = w and uid = them;
  v_seen := rpc_creatures(w, 40);
  insert into said values ('UNDER|' || coalesce((select e->>'pedigree' from jsonb_array_elements(v_seen) e where (e->>'id')::int = v_known), 'not sent'));
  update skill set value = ${1 + TIER_LEVEL.rare} where world_id = w and uid = them and id = 'animal_husbandry';
  v_seen := rpc_creatures(w, 40);
  insert into said values ('PAST|' || coalesce((select e->>'pedigree' from jsonb_array_elements(v_seen) e where (e->>'id')::int = v_known), 'not sent'));
  update skill set value = 1 where world_id = w and uid = them and id = 'animal_husbandry';
  -- A reader's Reader: the Knowledge path's discipline, taken at its tier (meditation.ts).
  update player set way = 'knowledge' where world_id = w and uid = them;
  insert into skill (world_id, uid, id, value)
    values (w, them, meditation_skill(), (select t.at from path_tier t join path_pick k on k.tier = t.tier where k.id = 'knowledge_reader'))
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into path_taken (world_id, uid, pick) values (w, them, 'knowledge_reader') on conflict do nothing;
  v_seen := rpc_creatures(w, 40);
  insert into said values ('KNOWING|' || coalesce((select e->>'pedigree' from jsonb_array_elements(v_seen) e where (e->>'id')::int = v_known), 'not sent'));
end $b$;
select string_agg(k, E'\\n') from said;
rollback;
`);
const said = (key: string): string => isle.split('\n').find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? '(nothing)';
const parsed = <T>(key: string): T | null => {
  try {
    return JSON.parse(said(key)) as T;
  } catch {
    return null;
  }
};

console.log('--- the island');
const [islandDam, islandSire] = said('IDS').split(',').map(Number);
check('island: the pair is put together through the door', said('REFUSED') === '' && said('UNBORN') !== 'null', said('REFUSED'));
const islandCarried = parsed<{ traits: string[]; sire?: { id: number; name: string }; from?: Record<string, string>; line?: Line }>('UNBORN');
check('island: the covering writes the sire, by id and by name, and where each trait came from, into what she carries',
  same(islandCarried?.sire, { id: islandSire, name: 'Horn' }) && keyedAs(islandCarried?.from, islandCarried?.traits ?? []), said('UNBORN'));
const islandFirst = parsed<Young>('FIRST');
check('island: the young one is born with its pedigree: its dam, its sire, and where each trait came from, as the covering wrote it',
  !!islandFirst && same(islandFirst.traits, islandCarried?.traits)
  && same(islandFirst.pedigree, { dam: { id: islandDam, name: 'Snow' }, sire: { id: islandSire, name: 'Horn' }, from: islandCarried?.from, line: islandCarried?.line }),
  said('FIRST'));
const islandYoung = parsed<Young[]>('YOUNG') ?? [];
check('island: five hundred more are born', islandYoung.length === COVERINGS, `${islandYoung.length}`);
const islandShare = judge('island', islandYoung, { id: islandDam, ...DAM }, { id: islandSire, ...SIRE });
check('island: a young one of a covering made before pedigrees were kept has none', said('OLD') === 'null', said('OLD'));

console.log('--- a line, on the island');
{
  const [wrong, all] = said('BACKFILL').split(',').map(Number);
  check(`island: of the ${all} creatures on the islands, everything without a line stands at one on each channel it carries a trait on, none elsewhere, and gains nothing`,
    wrong === 0 && all > 0, said('BACKFILL'));
  const want = [...CHANNELS].sort((a, b) => (a.id < b.id ? -1 : 1)).map((ch) => `${ch.id}=${lineDepth(DAM.traits, undefined, ch.id)}/1`).join(',');
  check('island: one bred before lines were kept stands where the browser has it, and gains nothing', said('OLDPED') === want, `${said('OLDPED')} // ${want}`);
  const depths = CHAIN_WANT.map((_, i) => Number(said(`CHAIN${i + 1}`)));
  check(`island: ${CHAIN} generations bred down one line on work come to ${CHAIN_WANT.join(', ')}`, same(depths, CHAIN_WANT), depths.join(', '));
  check('island: a young one of that line carrying nothing on work stands at none there', said('NONE') === '0', said('NONE'));
}

console.log('--- the two of them');
for (const [key, traits, ln, ch] of BONUS) {
  const isle = Number(said(`BONUS:${key}`));
  const want = bonusWant(traits, ln, ch);
  check(`a line of ${JSON.stringify(ln)} on ${traits.join(', ')} is worth ${want.toFixed(4)}× its ${ch} on both sides`,
    Math.abs(browserBonus[key] - want) < 1e-9 && Math.abs(isle - want) < 1e-6, `browser ${browserBonus[key]}, island ${isle}`);
}
const words = (ys: Young[]): string => sorted(new Set(ys.flatMap((y) => Object.values(y.pedigree?.from ?? {}))));
check(`both sides write the same ${DRAWN.length} words of a draw`,
  [browserYoung, islandYoung].every((ys) => DRAWN.every((w) => JSON.parse(words(ys)).includes(w)) && JSON.parse(words(ys)).every((w: string) => WORDS.includes(w))),
  `${words(browserYoung)} and ${words(islandYoung)}`);
check('and the same record: a dam, a sire, where each trait came from and its line',
  sorted(Object.keys(first?.pedigree ?? {})) === sorted(Object.keys(islandFirst?.pedigree ?? {})), `${sorted(Object.keys(first?.pedigree ?? {}))} and ${sorted(Object.keys(islandFirst?.pedigree ?? {}))}`);
for (const w of WORDS) {
  check(`how often a trait is ${TRAIT_SOURCES[w as TraitSource].label} agrees between the two sides`, Math.abs(browserShare[w] - islandShare[w]) < 0.08,
    `${(browserShare[w] * 100).toFixed(1)}% and ${(islandShare[w] * 100).toFixed(1)}%`);
}

// Who can read what of somebody else's, by the rule the card's chips keep.
const known = parsed<Pedigree>('KNOWN');
const readable = (husbandry: number): string[] => KNOWN.traits.filter((id) => husbandry >= 1 + TIER_LEVEL[traitTier(id)]);
const fromOf = (key: string): string => sorted(Object.keys(parsed<Pedigree>(key)?.from ?? {}));
check('island: your own young one\'s pedigree is sent whole', !!known && same(parsed<Pedigree>('MINE'), known), said('MINE'));
check('island: nothing is sent for a creature with none', said('BARE') === 'false', said('BARE'));
check('island: somebody else is sent its dam and its sire', same(parsed<Pedigree>('UNDER')?.dam, known?.dam) && same(parsed<Pedigree>('UNDER')?.sire, known?.sire), said('UNDER'));
check(`island: at ${TIER_LEVEL.rare} husbandry, where a trait came from only for the common one`,
  fromOf('UNDER') === sorted(readable(TIER_LEVEL.rare)) && readable(TIER_LEVEL.rare).length === 1, `${fromOf('UNDER')} of ${sorted(KNOWN.traits)}`);
check(`island: at ${1 + TIER_LEVEL.rare}, for the rare one as well, and not yet the supreme`,
  fromOf('PAST') === sorted(readable(1 + TIER_LEVEL.rare)) && readable(1 + TIER_LEVEL.rare).length === 2, `${fromOf('PAST')}`);
check('island: and to a reader who took Reader, all of them', fromOf('KNOWING') === sorted(KNOWN.traits), fromOf('KNOWING'));
const lineOf = (key: string): string => JSON.stringify(canon(parsed<Pedigree>(key)?.line ?? null));
const seenLine = (husbandry: number): string => JSON.stringify(canon(Object.fromEntries(Object.entries(KNOWN.line)
  .filter(([ch]) => readable(husbandry).some((id) => lineDepth([id], {}, ch as TraitChannel) > 0)))));
check('island: somebody else is sent its line only on the channels of the traits they can read, and a reader with Reader all of it',
  lineOf('UNDER') === seenLine(TIER_LEVEL.rare) && lineOf('PAST') === seenLine(1 + TIER_LEVEL.rare) && lineOf('KNOWING') === JSON.stringify(canon(KNOWN.line))
    && Object.keys(JSON.parse(lineOf('UNDER'))).length === 1 && Object.keys(JSON.parse(lineOf('PAST'))).length === 2,
  `${lineOf('UNDER')} / ${lineOf('PAST')} / ${lineOf('KNOWING')}`);
check('island: in the words the record was written in', same(parsed<Pedigree>('PAST')?.from, Object.fromEntries(readable(1 + TIER_LEVEL.rare).map((id) => [id, KNOWN.from[id]]))),
  JSON.stringify(parsed<Pedigree>('PAST')?.from));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a pedigree — ${ok.length} of ${ok.length}`);
