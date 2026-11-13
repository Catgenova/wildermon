/**
 * Looks for the sculpted bodies: the browser's rules (`src/game/look.ts`) and the island's (`look_clean` and the doors,
 * `20261120000001_looks_for_the_sculpted_bodies.sql`), and that the two say the same.
 *
 * In the browser, with no database:
 *
 *   * the choices are the two bodies and Bald with every hairstyle there is a mesh for on both bodies
 *     (`src/sculpt/assets/lowhair.json`), as the list the tool writes beside it says (`lowhair-styles.json`);
 *   * the hair goes round the whole colour wheel and from near black to near white, the brown it opens on the old
 *     default's; the skin ramp ends where it says, the palest and darkest skin; and the palest
 *     skin is one the sculpted bodies' fitted light can shade, its red and green under full on the brightest facets
 *     (`tools/sculpt/lowlight-<who>.json`, lit as `lowLight` in `src/sculpt/gl.ts` lights a low-poly body's skin);
 *   * a number is kept to three places and to nought to one, anything else falls to the default;
 *   * every id a look could hold before maps to a look of now: a build to the nearest, every haircut to one there is
 *     a mesh for, an old skin swatch to its very colour, an old hair colour to the hue and brightness nearest it
 *     (the natural ones near); and a clean look is clean again unchanged, a rolled one too.
 *
 * On the island (skipped when there is no Postgres to reach):
 *
 *   * `look_kinds()`, `look_tones()`, `look_tone_defaults()`, `look_option` and `look_legacy` are what the
 *     TypeScript says;
 *   * `look_clean` cleans every one of a list of looks (old, new, half, crafted) exactly as `cleanLook` does;
 *   * `rpc_set_look` keeps the numbers, puts the look on every body ashore, and refuses at the door what is not a
 *     look; `rpc_my_look` reads an old look kept on the account as one of now; a join puts a look of now on the body;
 *   * the migration's own rewrite of the looks kept turns old rows into looks of now and leaves new ones as they are;
 *   * `look_random` rolls a clean look, never grey.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_LOOK, GENDERS, HAIRSTYLES, LOOK_KINDS, LOOK_TABLES, LOOK_TONES, SKIN_RAMP, cleanLook,
  hairColour, hairColourOf, legacyLooks, rampColour, randomLook, skinColour, type Look, type Ramp,
} from '../../src/game/look';
import HAIR from '../../src/sculpt/assets/lowhair.json';
import INDEX from '../../src/sculpt/assets/lowhair-styles.json';
import MALE_LIGHT from '../../tools/sculpt/lowlight-male.json';
import FEMALE_LIGHT from '../../tools/sculpt/lowlight-female.json';
import { ok, bad, check } from './harness';

/** The same, whatever order an object's keys come in (Postgres keeps a jsonb's keys in its own order). */
const sorted = (x: unknown): unknown => (Array.isArray(x) ? x.map(sorted) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sorted((x as Record<string, unknown>)[k])])) : x);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** Lab distance, as look.ts measures "nearest". */
const lab = (h: string): number[] => {
  const lin = rgb(h).map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  const xyz = [(0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047, 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2],
    (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883].map((v) => (v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
};
const gap = (a: string, b: string): number => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

/* ---- the choices ----------------------------------------------------------------------------------- */
console.log('--- the choices');
const meshed = (who: 'male' | 'female'): string[] => Object.keys((HAIR as unknown as Record<string, object>)[who]);
check('the bodies are the man and the woman', same(GENDERS.map((g) => g.id), ['man', 'woman']));
check('every hairstyle in the list has a mesh on both bodies',
  INDEX.styles.every((s) => meshed('male').includes(s.id) && meshed('female').includes(s.id)), JSON.stringify(INDEX.styles));
check('and every mesh is in the list', meshed('male').every((id) => INDEX.styles.some((s) => s.id === id)), meshed('male').join());
check('the creator offers Bald and every one of them, by name', same(HAIRSTYLES, [{ id: 'bald', name: 'Bald' }, ...INDEX.styles]),
  HAIRSTYLES.map((h) => h.name).join(', '));
check('the hairstyles and bald', HAIRSTYLES.length === INDEX.styles.length + 1, HAIRSTYLES.map((h) => h.id).join());
check('cornrows among them', HAIRSTYLES.some((h) => h.id === 'cornrows' && h.name === 'Cornrows'), HAIRSTYLES.map((h) => h.id).join());
check('the ids the island checks are the bodies and the hairstyles', same(Object.keys(LOOK_TABLES), ['gender', 'hair']));

/* ---- the ramps ------------------------------------------------------------------------------------- */
console.log('--- the ramps');
const hsl = (h: string): number[] => {
  const [r, g, b] = rgb(h).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const hue = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue / 6, d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l];
};
check('hair colour: red, yellow, green, cyan, blue, magenta round the wheel, red again at one',
  [0, 1, 2, 3, 4, 5].every((i) => Math.abs(hsl(hairColourOf(i / 6, 0.5))[0] - i / 6) < 0.01) && hairColourOf(1, 0.5) === hairColourOf(0, 0.5),
  [0, 1, 2, 3, 4, 5, 6].map((i) => hairColourOf(i / 6, 0.5)).join(' '));
check('hair brightness: near black at nought, near white at one, for every hue',
  [0, 0.2, 0.4, 0.6, 0.8].every((h) => lab(hairColourOf(h, 0))[0] < 8 && lab(hairColourOf(h, 1))[0] > 80), `${hairColourOf(0.6, 0)} ${hairColourOf(0.6, 1)}`);
check('the hue fades out over the top of the brightness: full at 0.7, half at 0.85, grey at one',
  Math.abs(hsl(hairColourOf(0.6, 0.7))[1] - 0.6) < 0.02 && Math.abs(hsl(hairColourOf(0.6, 0.85))[1] - 0.3) < 0.02 && hsl(hairColourOf(0.6, 1))[1] === 0
    && hairColourOf(0.1, 1) === hairColourOf(0.7, 1),
  [0.7, 0.85, 1].map((b) => `${b} ${hairColourOf(0.6, b)}`).join(', '));
check('at 60% saturation, lightness 6% to 90%', Math.abs(hsl(hairColourOf(0.3, 0.5))[1] - 0.6) < 0.02 && Math.abs(hsl(hairColourOf(0.3, 0.5))[2] - 0.48) < 0.01,
  hsl(hairColourOf(0.3, 0.5)).map((v) => v.toFixed(3)).join(' '));
check('skin: porcelain at nought, ebony at one', rampColour(SKIN_RAMP, 0) === '#f5ddc6' && rampColour(SKIN_RAMP, 1) === '#3e2617');
const steps = (r: Ramp): number[] => Array.from({ length: 100 }, (_, i) => gap(rampColour(r, i / 100), rampColour(r, (i + 1) / 100)));
const even = (r: Ramp): number => { const s = steps(r); return Math.max(...s) / (s.reduce((a, b) => a + b, 0) / s.length); };
check('the skin slider moves evenly: no step over three times the mean', even(SKIN_RAMP) < 3, even(SKIN_RAMP).toFixed(2));
check('the skin gets darker all the way along', steps(SKIN_RAMP).every((_, i) => lab(rampColour(SKIN_RAMP, (i + 1) / 100))[0] <= lab(rampColour(SKIN_RAMP, i / 100))[0] + 1e-9));

/*
 * The palest skin against the fitted light. A low-poly body's skin is `min(lit * tone, 1)` (`src/sculpt/gl.ts`), its
 * tone the look's skin material over the default look's per channel (`toneOf` in `src/sculpt/lowpoly.ts`), a skin
 * material the skin a touch toward '#f2b48c' (`bodyMaterials` in `src/sculpt/models/body.ts`); `lit` the fitted light
 * (`lowLight`) over the facets that face the viewer, the brightest hundredth of them.
 */
const SKIN_WARM = '#f2b48c', SKIN_WARMTH = 0.15;
const matOf = (h: string): number[] => rgb(h).map((v, i) => v + (rgb(SKIN_WARM)[i] - v) * SKIN_WARMTH);
function brightest(fit: { global: number[][] }): number[] {
  const SH = Array.from({ length: 19 }, (_, k) => [0, 1, 2].map((c) => fit.global[c][k] / 255));
  const d = [-0.95, 0.25, -0.2], dl = Math.hypot(...d);
  const ch: number[][] = [[], [], []];
  for (let i = 0; i < 60; i++) for (let j = 0; j < 120; j++) {
    const z = Math.cos(Math.PI * (i + 0.5) / 60);
    if (z < 0) continue;
    const r = Math.sqrt(1 - z * z), x = r * Math.cos(2 * Math.PI * j / 120), y = r * Math.sin(2 * Math.PI * j / 120), b = (1 - Math.max(z, 0)) ** 3;
    const t = [1, x, y, z, x * y, y * z, 3 * z * z - 1, x * z, x * x - y * y, y * (3 * x * x - y * y), x * y * z, y * (5 * z * z - 1), z * (5 * z * z - 3),
      x * (5 * z * z - 1), z * (x * x - y * y), x * (x * x - 3 * y * y), Math.max(0, (x * d[0] + y * d[1] + z * d[2]) / dl) ** 8, Math.max(-x, 0) * b, Math.max(x, 0) * b];
    for (let c = 0; c < 3; c++) ch[c].push(Math.max(0, t.reduce((s, tk, k) => s + tk * SH[k][c], 0)));
  }
  return ch.map((l) => [...l].sort((a, b) => a - b)[Math.floor(l.length * 0.99)]);
}
for (const [who, fit] of [['his', MALE_LIGHT], ['her', FEMALE_LIGHT]] as const) {
  const top = brightest(fit as { global: number[][] }), def = matOf(skinColour(DEFAULT_LOOK)), pale = matOf(rampColour(SKIN_RAMP, 0));
  const lit = [0, 1].map((c) => top[c] * pale[c] / def[c]);
  check(`the palest skin is shaded on ${who} brightest facets, red and green under full`, lit.every((v) => v < 1), lit.map((v) => v.toFixed(3)).join(' '));
}

/* ---- a look ---------------------------------------------------------------------------------------- */
console.log('--- a look');
check('numbers kept to three places', same(cleanLook({ ...DEFAULT_LOOK, skin: 0.12345, hairColour: 0.5, hairBright: 0.0004 }),
  { ...DEFAULT_LOOK, skin: 0.123, hairColour: 0.5, hairBright: 0 }));
check('and to nought to one', same(cleanLook({ ...DEFAULT_LOOK, skin: -3, hairColour: 7, hairBright: 1 }), { ...DEFAULT_LOOK, skin: 0, hairColour: 1, hairBright: 1 }));
check('anything else is the default', same(cleanLook({ gender: 'goblin', hair: 'mohawk', skin: '#ff0000', hairColour: null, hairBright: [1] }), DEFAULT_LOOK),
  JSON.stringify(cleanLook({ gender: 'goblin', hair: 'mohawk', skin: '#ff0000', hairColour: null, hairBright: [1] })));
check('nothing at all is the default', same(cleanLook(null), DEFAULT_LOOK) && same(cleanLook([1, 2]), DEFAULT_LOOK) && same(cleanLook('woman'), DEFAULT_LOOK));
check('eyes, beards and cloth are not kept', same(Object.keys(cleanLook({ ...DEFAULT_LOOK, eyes: 'green', beard: 'full', shirt: 'woad' })), LOOK_KINDS));
check('the default is the old default\'s skin exactly', skinColour(DEFAULT_LOOK) === '#ddae85');
const rolled = Array.from({ length: 200 }, () => randomLook());
check('a rolled look is clean', rolled.every((l) => same(cleanLook(l), l)));
check('and comes as either body and every hairstyle', GENDERS.every((g) => rolled.some((l) => l.gender === g.id)) && HAIRSTYLES.every((h) => rolled.some((l) => l.hair === h.id)));

/* ---- looks from before ----------------------------------------------------------------------------- */
console.log('--- looks from before');
const old = { gender: 'neither', skin: 'olive', hair: 'long', hairColour: 'auburn', eyes: 'hazel', beard: 'none', shirt: 'madder', trousers: 'bark' };
const now = cleanLook(old);
check('an old look becomes one of now', now.gender === 'man' && now.hair === 'braid' && skinColour(now) === '#c79a68' && gap(hairColour(now), '#7d3a1d') < 6, JSON.stringify(now));
check('neither: the build nearest it, the man\'s', cleanLook({ gender: 'neither' }).gender === 'man');
const OLD_HAIR = ['bald', 'crop', 'short', 'bowl', 'side', 'swept', 'fringe', 'curls', 'afro', 'waves', 'long', 'ponytail', 'topknot', 'bun', 'braid', 'braids', 'locs', 'ridge', 'undercut', 'tonsure'];
const hairNow = OLD_HAIR.map((h) => cleanLook({ hair: h }).hair);
check('every old haircut to one there is a mesh for', hairNow.every((h) => HAIRSTYLES.some((s) => s.id === h)), OLD_HAIR.map((h, i) => `${h}>${hairNow[i]}`).join(' '));
check('short to the swept back, long to the braid, bald and the tonsure to bald',
  cleanLook({ hair: 'crop' }).hair === 'swept' && cleanLook({ hair: 'ponytail' }).hair === 'braid' && cleanLook({ hair: 'tonsure' }).hair === 'bald');
check('a bowl cut and a fringe to the bob', cleanLook({ hair: 'bowl' }).hair === 'bob' && cleanLook({ hair: 'fringe' }).hair === 'bob');
const SKINS: Record<string, string> = { porcelain: '#f5ddc6', fair: '#ecc8a6', light: '#ddae85', olive: '#c79a68', tan: '#b5804f', bronze: '#9d6a3f', umber: '#855634', deep: '#6b4328', dark: '#55341f', ebony: '#3e2617' };
check('every old skin is its very colour', Object.entries(SKINS).every(([id, c]) => skinColour(cleanLook({ skin: id })) === c),
  Object.keys(SKINS).filter((id) => skinColour(cleanLook({ skin: id })) !== SKINS[id]).join());
check('and they come in their order along the slider', Object.keys(SKINS).every((id, i, a) => i === 0 || cleanLook({ skin: id }).skin > cleanLook({ skin: a[i - 1] }).skin));
const NATURAL: Record<string, string> = { black: '#1c1614', dark_brown: '#3b2a1c', brown: '#5a3a1e', chestnut: '#6f4423', auburn: '#7d3a1d', ginger: '#a5521f', copper: '#b8672a', honey: '#b98c3f', blond: '#d8b76a', flax: '#e6d3a1' };
const far = Object.entries(NATURAL).map(([id, c]) => [id, gap(hairColour(cleanLook({ hairColour: id })), c)] as const);
check('every old natural hair colour to within a shade or two of what it was', far.every(([, d]) => d < 8), far.map(([id, d]) => `${id} ${d.toFixed(1)}`).join(', '));
/** Nothing on the wheel nearer an old colour than what it became, by a coarse look over the whole of it. */
const nearest = (id: string, c: string): boolean => {
  const got = gap(hairColour(cleanLook({ hairColour: id })), c);
  for (let h = 0; h < 1; h += 0.02) for (let b = 0; b <= 1; b += 0.02) if (gap(hairColourOf(h, b), c) < got - 0.5) return false;
  return true;
};
check('the hair it opens on is the nearest to the old default brown, and near', gap(hairColour(DEFAULT_LOOK), '#5a3a1e') < 6 && nearest('brown', '#5a3a1e'), `${hairColour(DEFAULT_LOOK)}, ${gap(hairColour(DEFAULT_LOOK), '#5a3a1e').toFixed(1)} apart`);
const GREYS: Record<string, string> = { soot: '#2a211c', ash: '#b9b0a3', grey: '#8e8b85', white: '#ded9d0' };
check('soot, ash, grey and white to the nearest there is on the wheel', Object.entries(GREYS).every(([id, c]) => nearest(id, c)),
  Object.keys(GREYS).map((id) => `${id}>${hairColour(cleanLook({ hairColour: id }))}`).join(' '));
const DYED = ['pastel_blue', 'blue', 'teal', 'green', 'purple', 'lavender', 'pink', 'magenta', 'red'];
const DYES: Record<string, string> = { pastel_blue: '#9cc3ec', blue: '#3462bf', teal: '#2b8f8c', green: '#4e9a48', purple: '#6c40a6', lavender: '#b69de2', pink: '#e690bd', magenta: '#b9367f', red: '#bb2b30' };
check('a dyed colour to the nearest on the wheel, and close: the wheel has every hue', DYED.every((id) => gap(hairColour(cleanLook({ hairColour: id })), DYES[id]) < 12 && nearest(id, DYES[id])),
  DYED.map((id) => `${id}>${hairColour(cleanLook({ hairColour: id }))}`).join(' '));
check('every id from before is in the table the island is given, and becomes a clean look',
  legacyLooks().length === 3 + OLD_HAIR.length + 10 + 23 && legacyLooks().every((l) => {
    const c = cleanLook({ ...DEFAULT_LOOK, ...l.becomes });
    return Object.entries(l.becomes).every(([k, v]) => c[k as keyof Look] === v);
  }), String(legacyLooks().length));
check('a skin past one is the darkest', same(cleanLook({ skin: 3 }), { ...DEFAULT_LOOK, skin: 1 }));

/* ---- the island ------------------------------------------------------------------------------------ */
const ENV = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
  PGPORT: process.env.PGPORT ?? '5433',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
};
interface Ran { out: string; err: string }
function run(text: string): Ran {
  try {
    const out = execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'],
      { input: text, encoding: 'utf8', env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    return { out: out.trim(), err: '' };
  } catch (e) {
    const x = e as { stdout?: string; stderr?: string };
    return { out: (x.stdout ?? '').trim(), err: (x.stderr ?? '').trim() || String(e) };
  }
}
const psql = (text: string): string => {
  const r = run(text);
  if (r.err) throw new Error(r.err);
  return r.out;
};
const lit = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const as = (who: string, text: string): Ran =>
  run(`select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: who }))}, false) \\g /dev/null\nset role authenticated;\n${text}\n`);

const reached = run('select 1;');
if (reached.err) {
  console.log(`--- the island: no Postgres to reach, skipped (${reached.err.split('\n')[0]})`);
} else {
  console.log('--- the island');
  const ROCK = 'cc000000-0000-4000-8000-0000000000a1';
  const ANNA = 'cc000000-0000-4000-8000-000000000101', BERT = 'cc000000-0000-4000-8000-000000000102';
  const ALL = [ANNA, BERT];
  const list = ALL.map((x) => `'${x}'`).join(', ');
  const CLEAN = `
delete from world where id = '${ROCK}';
delete from private.player_ip where uid in (${list});
delete from private.ip_body where uid in (${list}) or world_id = '${ROCK}';
delete from auth.users where id in (${list});
delete from caller where uid in (${list});
delete from realtime.messages where topic like '%:${ROCK}%';`;
  psql(CLEAN);
  psql(`
insert into auth.users (id, email) values ${ALL.map((u, i) => `('${u}', 'sculptlook${i}@catgenova.github.io')`).join(', ')};
insert into world (id, name, seed, size, spawn_x, spawn_y, ready, made_by) values ('${ROCK}', 'Look Rock', 7, 32, 10, 12, true, '${ANNA}');
select land_blank('${ROCK}', 32) \\g /dev/null`);
  const j = (sqlText: string): unknown => JSON.parse(psql(sqlText) || 'null');

  check('look_kinds() is LOOK_KINDS', same(j(`select to_jsonb(look_kinds());`), LOOK_KINDS));
  check('look_tones() is LOOK_TONES', same(j(`select to_jsonb(look_tones());`), LOOK_TONES));
  const defaults = j(`select look_tone_defaults();`) as Record<string, number>;
  check('look_tone_defaults() is the default look\'s', LOOK_TONES.every((k) => defaults[k] === DEFAULT_LOOK[k]), JSON.stringify(defaults));
  const options = j(`select jsonb_agg(jsonb_build_array(kind, id, name, fallback) order by kind, ord) from look_option;`);
  const want = Object.entries(LOOK_TABLES).sort(([a], [b]) => (a < b ? -1 : 1))
    .flatMap(([kind, t]) => t.map((o) => [kind, o.id, o.name, DEFAULT_LOOK[kind as keyof Look] === o.id]));
  check('look_option is the bodies and the hairstyles', same(options, want), JSON.stringify(options));
  const legacy = j(`select jsonb_object_agg(kind || '|' || id, becomes) from look_legacy;`) as Record<string, Record<string, unknown>>;
  check('look_legacy is legacyLooks()', legacyLooks().every((l) => same(legacy[`${l.kind}|${l.id}`], l.becomes)) && Object.keys(legacy).length === legacyLooks().length);

  const LOOKS: unknown[] = [
    old, DEFAULT_LOOK, { gender: 'woman', hair: 'braid', skin: 0.9, hairColour: 0.75, hairBright: 0.25 },
    { gender: 'woman', skin: 'ebony', hair: 'afro', hairColour: 'white', eyes: 'green' }, { hair: 'tonsure', hairColour: 'pink' },
    { skin: 1.5, hairColour: -2, hairBright: 0.33333 }, { skin: '0.5' }, { gender: 7, hair: null, skin: { a: 1 } }, {}, [], 'man',
    { gender: 'neither', hair: 'braid', hairColour: 0.4 }, { hairColour: 'grey', hairBright: 0.1 }, { hair: 'swept', skin: 0 },
    ...Object.keys(SKINS).map((skin) => ({ skin })), ...Object.keys({ ...NATURAL, ...GREYS }).map((hairColour) => ({ hairColour })),
    ...DYED.map((hairColour) => ({ hairColour })), ...OLD_HAIR.map((hair) => ({ hair })),
  ];
  const island = j(`select jsonb_agg(look_clean(x) order by n) from jsonb_array_elements(${lit(JSON.stringify(LOOKS))}::jsonb) with ordinality t(x, n);`) as unknown[];
  const differ = LOOKS.map((l, i) => [l, island[i], cleanLook(l)]).filter(([, a, b]) => !same(a, b));
  check(`look_clean cleans ${LOOKS.length} looks as cleanLook does`, differ.length === 0, JSON.stringify(differ.slice(0, 3)));
  check('and keeps numbers as numbers', typeof (island[2] as Look).skin === 'number' && (island[2] as Look).skin === 0.9, JSON.stringify(island[2]));

  // The doors.
  const mine = { gender: 'woman', hair: 'braid', skin: 0.731, hairColour: 0.412, hairBright: 0.2 };
  psql(`select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: ANNA }))}, false) \\g /dev/null\nselect rpc_join('${ROCK}', 'Anna') \\g /dev/null`);
  const set = as(ANNA, `select rpc_set_look(${lit(JSON.stringify(mine))}::jsonb);`);
  check('rpc_set_look keeps the numbers', !set.err && same(JSON.parse(set.out), mine), set.err || set.out);
  check('on the account and on the body ashore', same(j(`select look from account where uid = '${ANNA}';`), mine) && same(j(`select look from player where uid = '${ANNA}';`), mine));
  const read = as(ANNA, `select rpc_my_look();`);
  check('rpc_my_look reads it back', same(JSON.parse(read.out || 'null'), mine), read.err || read.out);
  const clamped = as(ANNA, `select rpc_set_look('{"gender":"man","hair":"swept","skin":1.7,"hairColour":-0.2,"hairBright":0.12345}'::jsonb);`);
  check('a number out of range is kept at the end', same(JSON.parse(clamped.out || 'null'), { gender: 'man', hair: 'swept', skin: 1, hairColour: 0, hairBright: 0.123 }), clamped.err || clamped.out);
  for (const [what, look] of [['a list', '{"skin":[1]}'], ['an object', '{"skin":{"a":1}}'], ['a number past a thousand', '{"skin":5000}'], ['a key that is not a word', '{"sk in":0.5}']] as const) {
    const r = as(ANNA, `select rpc_set_look('${look}'::jsonb);`);
    check(`refused at the door: ${what}`, r.err.includes('Bad request: rpc_set_look p_look'), r.err.split('\n')[0] || r.out);
  }
  const anon = run(`set role anon;\nselect rpc_set_look('{}'::jsonb);`);
  check('nobody signed in may not set one', !!anon.err, anon.out);

  // An old look kept on an account, from before the migration's rewrite: read as one of now.
  psql(`select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: BERT }))}, false) \\g /dev/null\nselect rpc_my_name() \\g /dev/null`);
  psql(`update account set look = ${lit(JSON.stringify(old))}::jsonb where uid = '${BERT}';`);
  const bert = as(BERT, `select rpc_my_look();`);
  check('rpc_my_look reads an old look as one of now', same(JSON.parse(bert.out || 'null'), cleanLook(old)), bert.err || bert.out);
  const joined = as(BERT, `select rpc_join('${ROCK}', 'Bert') -> 'you' -> 'look';`);
  check('and a join puts that on the body', same(JSON.parse(joined.out || 'null'), cleanLook(old)), joined.err || joined.out);

  // The migration's rewrite, as it is written there.
  // (from the repository's root, where the suite runs)
  const migration = readFileSync('supabase/migrations/20261120000001_looks_for_the_sculpted_bodies.sql', 'utf8');
  const rewrite = migration.match(/^update account set look[\s\S]*?;\s*\nupdate player set look[\s\S]*?;/m)?.[0] ?? '';
  check('the migration rewrites the looks kept', rewrite.length > 0);
  psql(`update account set look = ${lit(JSON.stringify(old))}::jsonb where uid = '${BERT}';
update player set look = ${lit(JSON.stringify({ ...old, hair: 'afro', hairColour: 'grey' }))}::jsonb where uid = '${BERT}';`);
  const before = j(`select look from account where uid = '${ANNA}';`);
  psql(rewrite);
  check('an old look on an account is now one of now', same(j(`select look from account where uid = '${BERT}';`), cleanLook(old)));
  check('and on a body', same(j(`select look from player where uid = '${BERT}';`), cleanLook({ ...old, hair: 'afro', hairColour: 'grey' })));
  check('a look of now is left as it is', same(j(`select look from account where uid = '${ANNA}';`), before));

  const random = j(`select jsonb_agg(look_random()) from generate_series(1, 60);`) as Look[];
  check('look_random rolls clean looks', random.every((l) => same(cleanLook(l), l)), JSON.stringify(random[0]));
  check('anywhere along the skin', Math.min(...random.map((l) => l.skin)) < 0.3 && Math.max(...random.map((l) => l.skin)) > 0.7);
  psql(CLEAN);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`sculptlook — ${ok.length} of ${ok.length}`);
