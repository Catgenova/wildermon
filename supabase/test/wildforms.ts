/**
 * Wild forms: a rare colour and a rare size.
 *
 * Asked for: "rare forms in the wild: a colour form (a fifth palette per kind, distinct from its four variants) at 1 in
 * 500 wild spawns, and a size form (large +15% drawn size and +10% health, or small −15% size and +10% speed) at 1 in
 * 200, independent. Exact odds as constants. Kept when tamed; passed to young with a stated chance (e.g. 25% if one
 * parent has it). Shown: the card names it, the Field guide marks each form seen per kind (seen/tamed) ... the renderer
 * draws the colour and scale."
 *
 *   * the numbers are the ones asked for, and the island's are the browser's;
 *   * the two rolls, the same way on both sides at every roll (`wildFormRoll`, `wild_form_roll`), never for a monster;
 *   * over a large seeded draw, on both sides, each form comes up as often as it says, and independently;
 *   * the wild stocking puts them out through it on both sides (`standWild`, `wild_form_put`), a large one with its
 *     health, and the stocking still puts out what it did;
 *   * a large one's health and a small one's speed are in its blood on both sides (`formMul`, `form_mul`);
 *   * kept when tamed, by hand and out of a trap, and the forms marked tamed in the book;
 *   * a young one's, the same rule on both sides (`bredForm`, `bred_form`), at the stated chance over many coverings,
 *     and born with them;
 *   * the field guide: a form in view is marked seen, on both sides; the island takes one only while one in it stands
 *     near; the book hands it back and the browser takes it; a kind's page lists its forms with their marks;
 *   * the island sends them with the creature, and the browser draws its colours and its size: a fifth palette per
 *     kind, none of its four.
 *
 * The browser's half runs on its own; the island's against the database the suite leaves behind (Hoarding, and Dane
 * on it), in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { sightedLine } from '../../src/game/sighted';
import { RARITIES } from '../../src/game/items';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { bloodMul, Creatures, maxHealth, SPECIES, type IslandCreature } from '../../src/game/creatures';
import { FieldGuide, formLines, guidePage } from '../../src/game/guide';
import {
  bredForm, coatOf, COLOUR_FORM_ODDS, FORM_PASS, formCoat, formKey, formLabels, formMul, formName, formScale, LARGE_HEALTH, LARGE_SIZE, paleKind,
  SIZE_FORM_ODDS, SMALL_SIZE, SMALL_SPEED, wildFormRoll, type SizeForm,
} from '../../src/game/wildforms';

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
/** Whether `n` of `of` draws is within four standard deviations of a chance `p`. */
const about = (n: number, of: number, p: number): boolean => Math.abs(n - of * p) <= 4 * Math.sqrt(of * p * (1 - p));
const fmt = (n: number, of: number, p: number): string => `${n} of ${of}, expected ${(of * p).toFixed(1)}`;

/* ---- the asked-for numbers ------------------------------------------------------------------- */

check(`colour form 1 in ${COLOUR_FORM_ODDS}, size form 1 in ${SIZE_FORM_ODDS}, large ×${LARGE_SIZE} size ×${LARGE_HEALTH} health, small ×${SMALL_SIZE} size ×${SMALL_SPEED} speed, ${FORM_PASS} a parent, as asked`,
  COLOUR_FORM_ODDS === 500 && SIZE_FORM_ODDS === 200 && LARGE_SIZE === 1.15 && LARGE_HEALTH === 1.1 && SMALL_SIZE === 0.85 && SMALL_SPEED === 1.1 && FORM_PASS === 0.25);

/* ---- the rolls, the browser ------------------------------------------------------------------ */

const ROLLS: Array<[number, number]> = [
  [0, 0], [1 / COLOUR_FORM_ODDS - 1e-9, 0.5], [1 / COLOUR_FORM_ODDS, 0.5], [0.9, 1 / (2 * SIZE_FORM_ODDS) - 1e-9], [0.9, 1 / (2 * SIZE_FORM_ODDS)],
  [0.9, 1 / SIZE_FORM_ODDS - 1e-9], [0.9, 1 / SIZE_FORM_ODDS], [0.0001, 0.004], [0.5, 0.999],
];
const rolled = (species: string, c: number, s: number): string => {
  const f = wildFormRoll(SPECIES[species], c, s);
  return `${f.formColour}/${f.formSize ?? '-'}`;
};
const browserRolls = ROLLS.map(([c, s]) => rolled('rabba', c, s)).concat(ROLLS.map(([c, s]) => rolled('goblin', c, s)));
check('one roll for the colour and one for the size, either side of each line exactly where the odds put it',
  browserRolls.slice(0, ROLLS.length).join() === 'true/large,true/-,false/-,false/large,false/small,false/small,false/-,true/small,false/-', browserRolls.join());
check('and never for a monster', browserRolls.slice(ROLLS.length).every((r) => r === 'false/-'), browserRolls.slice(ROLLS.length).join());

const N = 400000;
{
  const r = seeded(500200);
  let colour = 0, large = 0, small = 0, both = 0;
  for (let i = 0; i < N; i++) {
    const f = wildFormRoll(SPECIES.rabba, r(), r());
    if (f.formColour) colour++;
    if (f.formSize === 'large') large++;
    if (f.formSize === 'small') small++;
    if (f.formColour && f.formSize) both++;
  }
  check(`browser, ${N} seeded rolls: colour form ${fmt(colour, N, 1 / COLOUR_FORM_ODDS)}`, about(colour, N, 1 / COLOUR_FORM_ODDS));
  check(`browser: large ${fmt(large, N, 1 / (2 * SIZE_FORM_ODDS))}, small ${fmt(small, N, 1 / (2 * SIZE_FORM_ODDS))}`,
    about(large, N, 1 / (2 * SIZE_FORM_ODDS)) && about(small, N, 1 / (2 * SIZE_FORM_ODDS)));
  check(`browser: independent: both at once ${fmt(both, N, 1 / (COLOUR_FORM_ODDS * SIZE_FORM_ODDS))}`, about(both, N, 1 / (COLOUR_FORM_ODDS * SIZE_FORM_ODDS)));
}

/* ---- the wild stocking, the browser ----------------------------------------------------------- */

const game = Game.create(4242);
game.rand = seeded(77);
for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
const { x: px, y: py } = game.player;
{
  const SPAWNS = 40000;
  let colour = 0, large = 0, small = 0, monsters = 0, healthy = true;
  for (let i = 0; i < SPAWNS; i++) {
    const kind = i % 10 === 9 ? 'goblin' : 'woola';
    const c = game.creatures.standWild(game, kind, px + 20, py + 20);
    if (kind === 'goblin' && (c.formColour || c.formSize)) monsters++;
    if (c.formColour) colour++;
    if (c.formSize === 'large') {
      large++;
      if (c.health !== maxHealth(c, SPECIES[kind]) || maxHealth(c, SPECIES[kind]) <= maxHealth({ ...c, formSize: null }, SPECIES[kind])) healthy = false;
    }
    if (c.formSize === 'small') small++;
    game.creatures.remove(c.id);
  }
  const kept = SPAWNS * 0.9;
  check(`browser, ${SPAWNS} put out in the country: colour ${fmt(colour, kept, 1 / COLOUR_FORM_ODDS)}, large ${fmt(large, kept, 1 / (2 * SIZE_FORM_ODDS))}, small ${fmt(small, kept, 1 / (2 * SIZE_FORM_ODDS))}`,
    about(colour, kept, 1 / COLOUR_FORM_ODDS) && about(large, kept, 1 / (2 * SIZE_FORM_ODDS)) && about(small, kept, 1 / (2 * SIZE_FORM_ODDS)));
  check('none of them a monster in a form, and every large one at its larger health', monsters === 0 && healthy, `${monsters} monsters`);
}
{
  const c = game.creatures.spawn('woola', px + 30, py + 30, 'wild', game.rand, 0);
  const health = bloodMul(c, 'hardy'), speed = bloodMul(c, 'speed');
  c.formSize = 'large';
  const bigH = bloodMul(c, 'hardy') / health, bigS = bloodMul(c, 'speed') / speed;
  c.formSize = 'small';
  const smallH = bloodMul(c, 'hardy') / health, smallS = bloodMul(c, 'speed') / speed;
  check(`browser: a large one ×${LARGE_HEALTH} health and a small one ×${SMALL_SPEED} speed, and nothing else`,
    Math.abs(bigH - LARGE_HEALTH) < 1e-9 && Math.abs(bigS - 1) < 1e-9 && Math.abs(smallH - 1) < 1e-9 && Math.abs(smallS - SMALL_SPEED) < 1e-9
      && formMul({ formSize: null }, 'hardy') === 1, `${bigH} ${bigS} ${smallH} ${smallS}`);
  game.creatures.remove(c.id);
}

/* ---- kept when tamed, and the book, the browser ------------------------------------------------- */

game.rand = (): number => 0;
game.log.length = 0;
const pale = game.creatures.spawn('rabba', px + 0.6, py, 'wild', game.rand, 0);
pale.formColour = true;
pale.formSize = 'large';
game.update(1.1);
check('browser: one in its forms in view marks its kind and each form seen, and says so',
  game.guide.seen.has('rabba') && game.guide.seen.has(formKey('rabba', 'colour')) && game.guide.seen.has(formKey('rabba', 'large')) && !game.guide.seen.has(formKey('rabba', 'small'))
    && game.log.some((l) => l.text.startsWith(`First ${formName(SPECIES.rabba, 'colour').toLowerCase()} ${SPECIES.rabba.name.toLowerCase()} seen.`)),
  `${[...game.guide.seen].join()} | ${game.log.map((l) => l.text).join(' | ')}`);
game.inventory.add('blueberry', { count: 3 });
ACTION_BY_ID.get('tame')?.perform({ kind: 'creature', id: pale.id } as Target, game);
check('browser: tamed, it keeps its forms, and the book marks each tamed',
  pale.mode !== 'wild' && pale.formColour === true && pale.formSize === 'large' && game.guide.tamed.has(formKey('rabba', 'colour'))
    && game.guide.tamed.has(formKey('rabba', 'large')) && !game.guide.tamed.has(formKey('rabba', 'small')), `${pale.mode} ${[...game.guide.tamed].join()}`);
{
  const page = guidePage(SPECIES.rabba, true, 0, game.guide).find((s) => s.head === 'Forms')?.lines ?? [];
  const want = formLines(SPECIES.rabba, game.guide);
  check(`browser: the kind's page lists its forms with their marks: ${page.join(' / ')}`, page.length === 3 && page.join() === want.join()
    && page[0] === `${formName(SPECIES.rabba, 'colour')}: 1 in ${COLOUR_FORM_ODDS} wild, colours only · seen · tamed`
    && page[2].endsWith('· not seen yet · not tamed yet') && !guidePage(SPECIES.goblin, true, 0, game.guide).some((s) => s.head === 'Forms'), page.join(' / '));
  const book = FieldGuide.fromJSON({ seen: ['rabba/colour', 'rabba/nosuch', 'goblin/large', 'rabba:1/colour'], tamed: ['rabba/small'], bred: ['rabba/colour'] });
  check('browser: the book takes a form\'s seen and tamed, and nothing for a form there is not, a monster\'s, or bred',
    [...book.seen].sort().join() === 'rabba/colour,rabba/small' && [...book.tamed].join() === 'rabba/small' && !book.bred.size,
    JSON.stringify(book.toJSON()));
}
check(`browser: its card names them: ${formLabels(pale, SPECIES.rabba).join(' / ')}`,
  formLabels(pale, SPECIES.rabba).join(' / ') === `${formName(SPECIES.rabba, 'colour')}: colours only / Large form: size +15%, health +10%`
    && formLabels({ formSize: 'small' }, SPECIES.rabba).join() === 'Small form: size −15%, speed +10%');

/* ---- young ones, the browser ----------------------------------------------------------------- */

const GRID: Array<[boolean, SizeForm | null, boolean, SizeForm | null, number, number]> = [
  [true, null, false, null, 0.2499, 0.1], [true, null, false, null, 0.25, 0.1], [true, null, true, null, 0.4999, 0.9], [true, null, true, null, 0.5, 0.9],
  [false, 'large', false, null, 0.9, 0.2499], [false, 'large', false, null, 0.9, 0.25], [false, null, false, 'small', 0.9, 0.1],
  [false, 'large', false, 'small', 0.9, 0.1], [false, 'large', false, 'small', 0.9, 0.3], [false, 'large', false, 'small', 0.9, 0.5],
  [false, null, false, null, 0, 0],
];
const browserBred = GRID.map(([dc, ds, sc, ss, r1, r2]) => {
  const f = bredForm({ formColour: dc, formSize: ds }, { formColour: sc, formSize: ss }, r1, r2);
  return `${f.formColour}/${f.formSize ?? '-'}`;
});
check(`browser: a young one's forms at ${FORM_PASS} for each parent with one, the dam's size first`,
  browserBred.join() === 'true/-,false/-,true/-,false/-,false/large,false/-,false/small,false/large,false/small,false/-,false/-', browserBred.join());
const COVERINGS = 4000;
{
  game.rand = seeded(4040);
  const dam = game.creatures.spawn('rabba', px + 0.3, py, 'deed', game.rand, 0);
  const sire = game.creatures.spawn('rabba', px - 0.3, py, 'deed', game.rand, 0);
  Object.assign(dam, { sex: 'female', formColour: true, formSize: 'large' });
  Object.assign(sire, { sex: 'male', formColour: true, formSize: null });
  let colour = 0, large = 0, small = 0;
  for (let i = 0; i < COVERINGS; i++) {
    game.creatures.pair(game, dam, sire, 50);
    if (dam.unborn?.formColour) colour++;
    if (dam.unborn?.formSize === 'large') large++;
    if (dam.unborn?.formSize === 'small') small++;
    dam.unborn = null;
  }
  check(`browser, ${COVERINGS} coverings of a pale large dam and a pale sire: pale ${fmt(colour, COVERINGS, 2 * FORM_PASS)}, large ${fmt(large, COVERINGS, FORM_PASS)}, never small`,
    about(colour, COVERINGS, 2 * FORM_PASS) && about(large, COVERINGS, FORM_PASS) && small === 0);
  game.creatures.pair(game, dam, sire, 50);
  dam.unborn = { ...dam.unborn!, formColour: true, formSize: 'small' };
  dam.due = game.time;
  const young = game.creatures.giveBirth(game, dam);
  check('browser: and born with them', !!young && young.formColour === true && young.formSize === 'small' && young.health === maxHealth(young, SPECIES.rabba),
    JSON.stringify({ c: young?.formColour, s: young?.formSize }));
}

/* ---- drawn, the browser ---------------------------------------------------------------------- */

{
  const hsl = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    const v = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    return (Math.max(...v) + Math.min(...v)) / 2;
  };
  const clash: string[] = [];
  for (const def of Object.values(SPECIES)) {
    const [coat] = formCoat(def);
    const l = hsl(coat);
    // A fifth palette: none of its four, and lighter than all of them for a pale one, darker for a dark.
    if (def.variants.some(([c, m]) => c === coat && m === formCoat(def)[1])
      || (paleKind(def) ? def.variants.some(([c]) => hsl(c) + 0.08 > l) : def.variants.some(([c]) => hsl(c) - 0.08 < l))) clash.push(def.id);
  }
  const pales = Object.values(SPECIES).filter(paleKind).length;
  check(`drawn: every kind's colour form is a fifth palette, none of its four (${pales} pale, ${Object.keys(SPECIES).length - pales} dark)`, !clash.length, clash.join());
  check(`drawn: a large one ×${LARGE_SIZE}, a small one ×${SMALL_SIZE}, in its form's colours`,
    formScale({ formSize: 'large' }) === LARGE_SIZE && formScale({ formSize: 'small' }) === SMALL_SIZE && formScale({}) === 1
      && coatOf({ formColour: true, variant: 2 }, SPECIES.rabba).join() === formCoat(SPECIES.rabba).join()
      && coatOf({ formColour: false, variant: 2 }, SPECIES.rabba).join() === SPECIES.rabba.variants[2].join());
  const herd = new Creatures();
  const row: IslandCreature = { id: 9, species: 'rabba', name: 'Pale', variant: 1, mode: 'wild', stance: 'defensive', x: 5, y: 5, health: 10, formColour: true, formSize: 'small' };
  herd.sawAll([row]);
  check('the browser takes them as the island sends them', herd.get(9)?.formColour === true && herd.get(9)?.formSize === 'small');
}

/* ---- the island ------------------------------------------------------------------------------ */

const ISLE_N = 200000;
const sqlRolls = ROLLS.map(([c, s]) => `(select f.form_colour || '/' || coalesce(f.form_size, '-') from wild_form_roll('rabba', ${c}, ${s}) f)`).join(" || ',' || ")
  + " || ',' || " + ROLLS.map(([c, s]) => `(select coalesce(f.form_colour, false) || '/' || coalesce(f.form_size, '-') from wild_form_roll('goblin', ${c}, ${s}) f)`).join(" || ',' || ");
const sqlBred = GRID.map(([dc, ds, sc, ss, r1, r2]) => `(select f.form_colour || '/' || coalesce(f.form_size, '-') from bred_form(${dc}, ${ds ? `'${ds}'` : 'null'}, ${sc}, ${ss ? `'${ss}'` : 'null'}, ${r1}, ${r2}) f)`).join(" || ',' || ");
const out = psql(`
begin;
select setseed(0.5) \\g /dev/null
create temp table said (k text, v text);
do $t$
declare w uuid; dane uuid; v_x double precision; v_y double precision; v_id int; v_dam int; v_sire int; v_young int; v_i int; v_n int;
        c creature; v_h double precision; v_s double precision; v_trap bigint;
begin
  insert into said values ('NUMBERS', colour_form_odds() || '|' || size_form_odds() || '|' || large_health() || '|' || small_speed() || '|' || form_pass());
  insert into said values ('ROLLS', ${sqlRolls});
  insert into said values ('BRED', ${sqlBred});
  insert into said select 'DRAW', count(*) filter (where f.form_colour) || '|' || count(*) filter (where f.form_size = 'large')
      || '|' || count(*) filter (where f.form_size = 'small') || '|' || count(*) filter (where f.form_colour and f.form_size is not null)
    -- Each row its own two rolls: \`g\` named in them, or the planner rolls once for the lot.
    from generate_series(1, ${ISLE_N}) g, lateral wild_form_roll('rabba', random() + 0 * g, random() + 0 * g) f;

  select id into w from world where name = 'Hoarding';
  select uid into dane from player where world_id = w and name = 'Dane';
  perform set_config('request.jwt.claims', json_build_object('sub', dane)::text, true);
  update player set act = null, act_queue = '[]'::jsonb where world_id = w and uid = dane;
  select x, y into v_x, v_y from player where world_id = w and uid = dane;
  delete from guide where world_id = w and uid = dane;
  delete from creature where world_id = w and species in ('rabba', 'vola', 'woola');
  update creature set mode = 'wild', keeper = null where world_id = w and keeper = dane and mode in ('active', 'stored', 'deed');

  -- Put out through the stocking's door, the rolls forced either side of the lines.
  v_id := wild_form_put(w, creature_spawn(w, 'woola', v_x + 30, v_y + 30, 'wild', now() - interval '3 hours'), 0.0001, 0.001);
  select * into c from creature where world_id = w and id = v_id;
  insert into said values ('PUTF', c.form_colour || '/' || coalesce(c.form_size, '-'));
  v_h := max_health(c);
  insert into said values ('PUTH', (c.health = v_h)::text);
  c.form_size := null;
  insert into said values ('PUT', 'true/large/' || (select v from said where k = 'PUTH') || '/' || (v_h > max_health(c)));
  v_id := wild_form_put(w, creature_spawn(w, 'woola', v_x + 30, v_y + 30, 'wild', now() - interval '3 hours'), 0.5, 0.004);
  select * into c from creature where world_id = w and id = v_id;
  insert into said values ('PUT2', c.form_colour || '/' || coalesce(c.form_size, '-'));
  v_id := wild_form_put(w, creature_spawn(w, 'goblin', v_x + 30, v_y + 30, 'wild', now() - interval '3 hours'), 0, 0);
  insert into said select 'MONSTER', form_colour || '/' || coalesce(form_size, '-') from creature where world_id = w and id = v_id;
  -- And at the island's own dice, many times.
  v_n := 0;
  for v_i in 1..20000 loop
    v_id := wild_form_put(w, creature_spawn(w, 'woola', v_x + 30, v_y + 30, 'wild', now() - interval '3 hours'));
    select * into c from creature where world_id = w and id = v_id;
    insert into said select 'STOCKED', c.form_colour || '/' || coalesce(c.form_size, '-') where c.form_colour or c.form_size is not null;
    delete from creature where world_id = w and id = v_id;
  end loop;
  -- The stocking itself goes through it.
  insert into said values ('STOCK', (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
    where p.proname in ('creature_stock', 'creature_stock_block', 'wild_turnover') and pg_get_functiondef(p.oid) like '%wild_form_put(%'));

  -- Its blood.
  v_id := creature_spawn(w, 'woola', v_x + 30, v_y + 30, 'wild', now() - interval '3 hours');
  select * into c from creature where world_id = w and id = v_id;
  v_h := beast_mul(c, 'hardy'); v_s := beast_mul(c, 'speed');
  c.form_size := 'large';
  insert into said values ('LARGE', (beast_mul(c, 'hardy') / v_h) || '|' || (beast_mul(c, 'speed') / v_s));
  c.form_size := 'small';
  insert into said values ('SMALL', (beast_mul(c, 'hardy') / v_h) || '|' || (beast_mul(c, 'speed') / v_s));

  -- Seen: one in its forms near, and a form nothing near is in.
  v_id := creature_spawn(w, 'rabba', v_x + 0.6, v_y, 'wild', now() - interval '3 hours');
  update creature set form_colour = true, form_size = 'large' where world_id = w and id = v_id;
  insert into said values ('SEEN', rpc_guide_seen(w, array['rabba', 'rabba/colour', 'rabba/large', 'rabba/small', 'rabba/nosuch'])::text);
  insert into said select 'SENT', (e->>'formColour') || '/' || coalesce(e->>'formSize', '-')
    from jsonb_array_elements(rpc_creatures(w, 10)) e where (e->>'id')::int = v_id;

  -- Tamed by an offering: kept, and marked.
  perform give(w, dane, 'blueberry', 40, 40);
  for v_i in 1..40 loop
    exit when (select mode from creature where world_id = w and id = v_id) <> 'wild';
    perform act_perform(w, dane, 'tame', jsonb_build_object('kind', 'creature', 'id', v_id));
  end loop;
  insert into said select 'TAMED', mode || '|' || form_colour || '|' || coalesce(form_size, '-') from creature where world_id = w and id = v_id;
  update creature set mode = 'wild', keeper = null where world_id = w and keeper = dane and mode in ('active', 'stored');

  -- Out of a trap: kept, and marked.
  insert into skill (world_id, uid, id, value) values (w, dane, 'taming', 60) on conflict (world_id, uid, id) do update set value = 60;
  v_id := creature_spawn(w, 'vola', v_x + 0.6, v_y, 'wild', now() - interval '3 hours');
  update creature set form_size = 'small' where world_id = w and id = v_id;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, caught)
    values (w, 'trap', 'snare', floor(v_x)::int, floor(v_y)::int, 0, 0, floor(v_x) + 0.5, floor(v_y) + 0.5, 60, dane, v_id)
    returning id into v_trap;
  update creature set trapped = v_trap where world_id = w and id = v_id;
  for v_i in 1..20 loop
    exit when (select caught from placed where id = v_trap) is null;
    perform act_perform(w, dane, 'take_catch', jsonb_build_object('kind', 'trap', 'id', v_trap));
  end loop;
  insert into said select 'TRAPPED', mode || '|' || coalesce(form_size, '-') from creature where world_id = w and id = v_id;
  update creature set mode = 'wild', keeper = null where world_id = w and keeper = dane and mode in ('active', 'stored');
  delete from placed where id = v_trap;
  insert into said values ('BOOK', rpc_guide(w)::text);

  -- Young ones: the covering settles them off the parents', and the birth gives them.
  insert into skill (world_id, uid, id, value) values (w, dane, 'animal_husbandry', 50) on conflict (world_id, uid, id) do update set value = 50;
  v_dam := creature_spawn(w, 'rabba', v_x + 0.3, v_y, 'deed', now() - interval '3 hours', dane);
  v_sire := creature_spawn(w, 'rabba', v_x - 0.3, v_y, 'deed', now() - interval '3 hours', dane);
  update creature set sex = 'female', form_colour = true, form_size = 'large', hunger = 1 where world_id = w and id = v_dam;
  update creature set sex = 'male', form_colour = true, form_size = null, hunger = 1 where world_id = w and id = v_sire;
  for v_i in 1..${COVERINGS} loop
    perform pair_them(w, v_dam, v_sire, 50);
    insert into said select 'U', coalesce(unborn->>'formColour', 'false') || '/' || coalesce(unborn->>'formSize', '-') from creature where world_id = w and id = v_dam;
    update creature set unborn = null, due = null where world_id = w and id = v_dam;
  end loop;
  perform pair_them(w, v_dam, v_sire, 50);
  update creature set unborn = unborn || '{"formColour": true, "formSize": "small"}'::jsonb, due = now() - interval '1 second' where world_id = w and id = v_dam;
  v_young := give_birth(w, v_dam);
  select * into c from creature where world_id = w and id = v_young;
  insert into said values ('BORN', c.form_colour || '/' || coalesce(c.form_size, '-') || '/' || (c.health = max_health(c)));
end $t$;
select k || '|' || coalesce(v, 'NULL') from said;
rollback;
`);
const lines = out.split('\n');
const answer = (key: string): string => lines.find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? 'MISSING';

check('the island\'s numbers are the browser\'s', answer('NUMBERS') === `${COLOUR_FORM_ODDS}|${SIZE_FORM_ODDS}|${LARGE_HEALTH}|${SMALL_SPEED}|${FORM_PASS}`, answer('NUMBERS'));
check('the island rolls the same way at every roll, and never for a monster', answer('ROLLS') === browserRolls.join(), answer('ROLLS'));
check('and settles a young one\'s forms the same way', answer('BRED') === browserBred.join(), answer('BRED'));
{
  const [colour, large, small, both] = answer('DRAW').split('|').map(Number);
  check(`island, ${ISLE_N} seeded rolls: colour ${fmt(colour, ISLE_N, 1 / COLOUR_FORM_ODDS)}, large ${fmt(large, ISLE_N, 1 / (2 * SIZE_FORM_ODDS))}, small ${fmt(small, ISLE_N, 1 / (2 * SIZE_FORM_ODDS))}, both ${both}`,
    about(colour, ISLE_N, 1 / COLOUR_FORM_ODDS) && about(large, ISLE_N, 1 / (2 * SIZE_FORM_ODDS)) && about(small, ISLE_N, 1 / (2 * SIZE_FORM_ODDS))
      && about(both, ISLE_N, 1 / (COLOUR_FORM_ODDS * SIZE_FORM_ODDS)), answer('DRAW'));
}
check('island: put out with its rolls under the lines, it is in its colour form and large, at its larger health', answer('PUTF') === 'true/large' && answer('PUT') === 'true/large/true/true',
  `${answer('PUTF')} ${answer('PUT')}`);
check('island: over the colour line and between the size lines, small and nothing more; a monster never', answer('PUT2') === 'false/small' && answer('MONSTER') === 'false/-',
  `${answer('PUT2')} ${answer('MONSTER')}`);
{
  const stocked = lines.filter((l) => l.startsWith('STOCKED|')).map((l) => l.slice(8));
  const n = 20000;
  const colour = stocked.filter((s) => s.startsWith('true')).length, large = stocked.filter((s) => s.endsWith('/large')).length, small = stocked.filter((s) => s.endsWith('/small')).length;
  check(`island: ${n} put out at its own dice: colour ${fmt(colour, n, 1 / COLOUR_FORM_ODDS)}, large ${fmt(large, n, 1 / (2 * SIZE_FORM_ODDS))}, small ${fmt(small, n, 1 / (2 * SIZE_FORM_ODDS))}`,
    about(colour, n, 1 / COLOUR_FORM_ODDS) && about(large, n, 1 / (2 * SIZE_FORM_ODDS)) && about(small, n, 1 / (2 * SIZE_FORM_ODDS)));
}
check('island: the stocking puts them out through it', answer('STOCK') === 'creature_stock,creature_stock_block', answer('STOCK'));
{
  const [lh, ls] = answer('LARGE').split('|').map(Number);
  const [sh, ss] = answer('SMALL').split('|').map(Number);
  check(`island: a large one ×${LARGE_HEALTH} health, a small one ×${SMALL_SPEED} speed, in its blood`,
    Math.abs(lh - LARGE_HEALTH) < 1e-9 && Math.abs(ls - 1) < 1e-9 && Math.abs(sh - 1) < 1e-9 && Math.abs(ss - SMALL_SPEED) < 1e-9, `${answer('LARGE')} ${answer('SMALL')}`);
}
check('island: a form is taken seen while one in it stands near; a form nothing near is in, or none there is, is absent',
  answer('SEEN') === '{"had": [], "added": ["rabba", "rabba/colour", "rabba/large"], "absent": ["rabba/nosuch", "rabba/small"]}', answer('SEEN'));
check('island: it sends them with the creature', answer('SENT') === 'true/large', answer('SENT'));
check('island: tamed by an offering, it keeps its forms', answer('TAMED') === 'active|true|large', answer('TAMED'));
check('island: and out of a trap', answer('TRAPPED') === 'active|small', answer('TRAPPED'));
{
  const book = JSON.parse(answer('BOOK')) as { seen: string[]; tamed: string[]; bred: string[] };
  check('island: and the book marks each form tamed with its kind',
    book.tamed?.join() === 'rabba,rabba/colour,rabba/large,vola,vola/small' && book.seen?.includes('vola/small') && book.seen.includes('rabba/large'), answer('BOOK'));
  const read = FieldGuide.fromJSON(book);
  check('and the browser takes it as it comes', read.has('vola/small', 'tamed') && read.has('rabba/colour', 'seen') && read.has('rabba', 'tamed'));
}
{
  const u = lines.filter((l) => l.startsWith('U|')).map((l) => l.slice(2));
  const colour = u.filter((s) => s.startsWith('true')).length, large = u.filter((s) => s.endsWith('/large')).length, small = u.filter((s) => s.endsWith('/small')).length;
  check(`island, ${COVERINGS} coverings of a pale large dam and a pale sire: pale ${fmt(colour, COVERINGS, 2 * FORM_PASS)}, large ${fmt(large, COVERINGS, FORM_PASS)}, never small`,
    u.length === COVERINGS && about(colour, COVERINGS, 2 * FORM_PASS) && about(large, COVERINGS, FORM_PASS) && small === 0);
}
check('island: and born with them, at its health', answer('BORN') === 'true/small/true', answer('BORN'));

// "Add a text line when the player comes into view of a rare or variant wild wildermon": what the log says of one.
{
  const def = SPECIES.sparra;
  const said = sightedLine({ species: 'sparra', skills: {}, rare: 2, formColour: true, formSize: 'large', x: 20, y: 0 }, 10, 10);
  check(`a rare one in a form in view is said with what it is, how far and which way: ${said}`,
    said === `Sighted: ${def.name} (${RARITIES[2].name.toLowerCase()}, ${formName(def, 'colour').toLowerCase()}, ${formName(def, 'large').toLowerCase()}), 14 tiles north-east.`);
  check('and one straight below you is south', sightedLine({ species: 'sparra', skills: {}, rare: 0, formSize: 'small', x: 10, y: 15 }, 10, 10).endsWith('5 tiles south.'));
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nwild forms — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
