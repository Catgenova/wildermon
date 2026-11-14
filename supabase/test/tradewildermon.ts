/**
 * A wildermon traded in its crate, through the Trade window.
 *
 * Asked for: "Trading wildermon. A secure trade window between two people,
 * with the pedigree shown."
 *
 * On an island of its own, Beastwater, with Ivar and Hild two tiles apart:
 *
 *   * Ivar carries Pip, a bred rabba with traits, both forms, a rarity, skills
 *     and a pedigree, in a wildermon crate; Hild carries Wren in hers;
 *   * each side shows its crated wildermon to both in full -- name, kind, sex,
 *     age, level, traits, forms, rarity, the dam and sire and the line -- and
 *     the browser writes it in labels (`beastLines`); an empty crate shows none;
 *   * refused, in the browser's words: a dam carrying young, one whose
 *     panniers are loaded, and a crate whose wildermon is not shut in it; an
 *     empty crate goes as a plain crate;
 *   * the crate's wildermon changed after an Accept (opened, another one in
 *     its place) takes both Accepts back, is told to both, and moves nothing;
 *     and the check at the deal itself refuses a crate that is not as accepted;
 *   * the deal: the crate and its wildermon are Hild's -- keeper, what her
 *     perks make of keeping it, no work post -- with name, sex, traits, forms,
 *     rarity, skills, stance and pedigree untouched; Wren is Ivar's; Hild lets
 *     Pip out and has it follow her, Ivar cannot; her creature read has it as
 *     hers and his no longer does, and her pack hears of the crate with Pip in
 *     it; no field guide "tamed" for a wildermon nobody tamed.
 *
 * Makes and removes everything it uses.
 */
import { execFileSync } from 'node:child_process';
import { barterPutRefusal, barterSaid, barterThing, beastLines, type Barter } from '../../src/game/barter';
import { kindName, lineLines, pedigreeLine, SPECIES, type Pedigree } from '../../src/game/creatures';
import { traitOf, traitSays } from '../../src/game/traits';
import { formLabels } from '../../src/game/wildforms';
import { ok, bad, check } from './harness';

const ENV = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
  PGPORT: process.env.PGPORT ?? '5433',
  PGUSER: process.env.PGUSER ?? 'wildermon',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
};
const ARGS = ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'];
interface Ran { out: string; err: string }
const sql = (text: string): Ran => {
  try {
    return { out: execFileSync('psql', ARGS, { input: text, encoding: 'utf8', env: ENV, stdio: ['pipe', 'pipe', 'pipe'] }).trim(), err: '' };
  } catch (e) {
    const x = e as { stdout?: string; stderr?: string };
    return { out: (x.stdout ?? '').trim(), err: (x.stderr ?? '').trim() || String(e) };
  }
};
const psql = (text: string): string => {
  const r = sql(text);
  if (r.err) throw new Error(r.err);
  return r.out;
};
const as = (who: string, text: string): Ran => sql(
  `select set_config('request.jwt.claims', '${JSON.stringify({ sub: who })}', false) \\g /dev/null\nset role authenticated;\n${text}\n`);
interface Said { why?: string; barter?: Barter | null; done?: boolean }
const said = (r: Ran): Said => {
  if (r.err) return { why: `ERROR ${r.err}` };
  try {
    return JSON.parse(r.out) as Said;
  } catch {
    return { why: `UNREADABLE ${r.out}` };
  }
};

const W = 'bb000000-0000-4000-8000-0000000000b1';
const IVAR = 'bb000000-0000-4000-8000-000000000011';
const HILD = 'bb000000-0000-4000-8000-000000000012';
const CLEAN = `
delete from world where id = '${W}';
delete from auth.users where id in ('${IVAR}', '${HILD}');
delete from caller where uid in ('${IVAR}', '${HILD}');
delete from realtime.messages where topic like '%:${W}%';
`;
psql(CLEAN);
const BODY = `'{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb`;
psql(`
insert into auth.users (id, email) values ('${IVAR}', 'ivar@beasts.test'), ('${HILD}', 'hild@beasts.test');
insert into world (id, name, seed, size, spawn_x, spawn_y, ready, made_by) values ('${W}', 'Beastwater', 5, 48, 10, 10, true, '${IVAR}');
select land_blank('${W}', 48) \\g /dev/null
insert into player (world_id, uid, name, x, y, stats) values
  ('${W}', '${IVAR}', 'Ivar', 10.5, 10.5, ${BODY}), ('${W}', '${HILD}', 'Hild', 12.5, 10.5, ${BODY});
`);

/** A wildermon of `uid`'s shut in a crate in their pack: [creature, crate]. */
const crated = (uid: string, species: string, name: string, more = ''): [number, number] => {
  const id = Number(psql(`select creature_spawn('${W}', '${species}', 10.5, 10.5, 'stored', now() - interval '10 days', '${uid}');`));
  psql(`update creature set name = '${name}'${more ? `, ${more}` : ''} where world_id = '${W}' and id = ${id};`);
  const crate = Number(psql(`insert into item (world_id, holder, holder_uid, def, ql, count, creature)
    values ('${W}', 'player', '${uid}', 'creature_crate', 30, 1, ${id}) returning id;`));
  return [id, crate];
};
const PEDIGREE: Pedigree = { dam: { id: 9001, name: 'Snow' }, sire: { id: 9002, name: 'Horn' }, from: { fleet: 'dam', curious: 'sire' }, line: { speed: 3 } };
const [PIP, PIP_CRATE] = crated(IVAR, 'rabba', 'Pip', `sex = 'female', traits = '{fleet,curious}', form_colour = true, form_size = 'large',
  rare = 'rare', stance = 'aggressive', skills = '{"foraging": 23.5}', pedigree = '${JSON.stringify(PEDIGREE)}'::jsonb`);
const [WREN, WREN_CRATE] = crated(HILD, 'sparra', 'Wren', `sex = 'male', traits = '{keen_nosed}'`);
const [, MAB_CRATE] = crated(IVAR, 'rabba', 'Mab', `sex = 'female', due = now() + interval '1 day',
  unborn = '{"traits": [], "sex": "male"}'::jsonb`);
const [BO, BO_CRATE] = crated(IVAR, 'bura', 'Bo');
psql(`insert into item (world_id, holder, pannier, def, ql, count) values ('${W}', 'pannier', ${BO}, 'log', 30, 3);`);
// A crate that names a wildermon that is not in it: at heel, out of its crate.
const [ZED, ZED_CRATE] = crated(IVAR, 'rabba', 'Zed');
psql(`update creature set mode = 'active' where world_id = '${W}' and id = ${ZED};
      update item set creature = ${ZED} where id = ${ZED_CRATE};`);
const EMPTY = Number(psql(`insert into item (world_id, holder, holder_uid, def, ql, count) values ('${W}', 'player', '${IVAR}', 'creature_crate', 30, 1) returning id;`));
// Tag follows Ivar: what goes into Pip's crate in Pip's place when Ivar lets Pip out of it.
const TAG = Number(psql(`select creature_spawn('${W}', 'rabba', 10.5, 10.5, 'active', now() - interval '10 days', '${IVAR}');`));
psql(`update creature set name = 'Tag' where world_id = '${W}' and id = ${TAG};`);

/** Everything about a wildermon that a trade must not touch. */
const blood = (id: number): string => psql(`select jsonb_build_object('name', name, 'species', species, 'sex', sex, 'traits', traits,
  'formColour', form_colour, 'formSize', form_size, 'rare', rare, 'skills', skills, 'stance', stance, 'pedigree', pedigree,
  'born', born, 'variant', variant, 'xp', xp)::text from creature where world_id = '${W}' and id = ${id};`);
const pipBlood = blood(PIP);
const wrenBlood = blood(WREN);

const lastLine = (uid: string): string => psql(`select text from event where world_id = '${W}' and uid = '${uid}' order by n desc limit 1;`);
const read = (uid: string): Said => said(as(uid, `select rpc_barter('${W}');`));
const offer = (by: string, n: number, things: number[]): Said =>
  said(as(by, `select rpc_barter_offer('${W}', ${n}, array[${things.join(',')}]::bigint[], array[${things.map(() => 1).join(',')}]::int[], 0);`));
const accept = (by: string, n: number, rev: number): Said => said(as(by, `select rpc_barter_accept('${W}', ${n}, ${rev});`));
const rev = (n: number): number => Number(psql(`select rev from barter where world_id = '${W}' and n = ${n};`));
const oks = (n: number): string => psql(`select asker_ok || ',' || other_ok from barter where world_id = '${W}' and n = ${n};`);
const keeper = (id: number): string => psql(`select coalesce(keeper::text, 'none') from creature where world_id = '${W}' and id = ${id};`);
const inCrate = (crate: number): string => psql(`select coalesce(creature::text, 'empty') from item where id = ${crate};`);
const holder = (crate: number): string => psql(`select holder || ':' || coalesce(holder_uid::text, '') from item where id = ${crate};`);
const follow = (uid: string, crate: number): void => {
  psql(`select act_perform('${W}', '${uid}', 'crate_follow', jsonb_build_object('kind', 'item', 'uid', ${crate}));`);
};
const openRefusal = (uid: string, crate: number): string =>
  psql(`select coalesce(crate_open_refusal('${W}', '${uid}', 'crate_follow', jsonb_build_object('kind', 'item', 'uid', ${crate})), 'opens');`);

/* ---- a trade ----------------------------------------------------------------- */
const n = said(as(IVAR, `select rpc_barter_ask('${W}', '${HILD}');`)).barter?.n ?? 0;
said(as(HILD, `select rpc_barter_answer('${W}', ${n}, true);`));
check('Ivar asks Hild and Hild says yes', read(IVAR).barter?.state === 'open', JSON.stringify(read(IVAR)));

/* ---- refused ----------------------------------------------------------------- */
console.log('--- refused');
const young = barterSaid('young', { who: 'Ivar', what: 'Mab' });
check('a dam carrying young, in the browser\'s words', offer(IVAR, n, [MAB_CRATE]).why === young, `${offer(IVAR, n, [MAB_CRATE]).why} / ${young}`);
check('which the browser refuses itself, seeing her carry',
  barterPutRefusal({ id: 'creature_crate', count: 1 }, false, 1, 'Ivar', { name: 'Mab', due: true }) === young);
const loaded = barterSaid('loaded', { who: 'Ivar', what: 'Bo' });
check('one whose panniers carry things', offer(IVAR, n, [BO_CRATE]).why === loaded, `${offer(IVAR, n, [BO_CRATE]).why} / ${loaded}`);
const loose = barterSaid('loose', { who: 'Ivar', what: 'Zed' });
check('a crate whose wildermon is not shut in it', offer(IVAR, n, [ZED_CRATE]).why === loose, `${offer(IVAR, n, [ZED_CRATE]).why} / ${loose}`);
check('none of that went on a side', read(IVAR).barter?.mine.things.length === 0 && rev(n) === 1, String(rev(n)));

/* ---- shown ------------------------------------------------------------------- */
console.log('--- shown to both');
// Zed back out of the way: a wildermon at heel is what a crate swaps in when one is let out of it.
psql(`delete from creature where world_id = '${W}' and id = ${ZED};`);
offer(IVAR, n, [PIP_CRATE, EMPTY]);
const hers = offer(HILD, n, [WREN_CRATE]).barter;
const pipOf = (b: Barter | null | undefined) => b?.theirs.things.find((t) => t.id === PIP_CRATE)?.beast ?? null;
/** The same, whatever order the keys came in. */
const same = (a: unknown, b: unknown): boolean => {
  const sorted = (v: unknown): unknown => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)).map(([k, x]) => [k, sorted(x)])) : v);
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
};
const low = pipOf(hers);
check('Hild sees Pip in the crate on Ivar\'s side', !!low && low.id === PIP && low.name === 'Pip' && low.species === 'rabba', JSON.stringify(low));
check('its sex, age, level, traits, forms and rarity', !!low && low.sex === 'female' && low.age === 'grown' && low.level === 23
  && low.traits.join() === 'fleet,curious' && low.formColour && low.formSize === 'large' && low.rare === 'rare' && !low.due, JSON.stringify(low));
check('and its dam and sire', low?.pedigree?.dam.name === 'Snow' && low.pedigree.sire.name === 'Horn', JSON.stringify(low?.pedigree));
check('reading no rare trait, she is told where only the common one came from, and no line, as on its card',
  same(low?.pedigree?.from, { curious: 'sire' }) && same(low?.pedigree?.line, {}), JSON.stringify(low?.pedigree));
const lowLines = low ? beastLines(low, (id) => traitOf(id)?.tier === 'common') : [];
check('and the window names the rare trait to her as unread', lowLines.includes('Trait: unread') && lowLines.includes(`Trait: curious: ${traitSays(traitOf('curious')!)}`)
  && !lowLines.some((l) => l.startsWith('Line')), lowLines.join(' | '));
check('the empty crate shows no wildermon', hers?.theirs.things.find((t) => t.id === EMPTY)?.beast == null);
const mineSeen = read(IVAR).barter;
check('Ivar sees Wren on Hild\'s side', mineSeen?.theirs.things[0]?.beast?.name === 'Wren' && mineSeen.theirs.things[0].beast.sex === 'male',
  JSON.stringify(mineSeen?.theirs.things[0]));
check('and Pip on his own, with its whole pedigree', same(mineSeen?.mine.things[0]?.beast?.pedigree, PEDIGREE),
  JSON.stringify(mineSeen?.mine.things[0]?.beast?.pedigree));

// Hild learns her husbandry: now she reads all of it.
psql(`insert into skill (world_id, uid, id, value) values ('${W}', '${HILD}', 'animal_husbandry', 40);`);
const seen = pipOf(read(HILD).barter);
check('with the husbandry for it, Hild reads its whole pedigree', same(seen?.pedigree, PEDIGREE), JSON.stringify(seen?.pedigree));
const all = (): boolean => true;
const lines = seen ? beastLines(seen, all) : [];
const pipLike = { species: 'rabba', skills: { foraging: 23.5 }, variant: seen?.variant ?? 0 };
const fleet = traitOf('fleet')!;
check('the window: name, sex, kind, age and level on one line', lines[0] === `Pip · female ${kindName(pipLike)} · grown · Lv 23`, lines[0]);
check('each trait with its tier and what it gives', lines.includes(`Trait: fleet (rare): ${traitSays(fleet)}`) && lines.includes(`Trait: curious: ${traitSays(traitOf('curious')!)}`),
  lines.join(' | '));
check('both forms with what they give', formLabels({ formColour: true, formSize: 'large' }, SPECIES.rabba).every((l) => lines.includes(l)), lines.join(' | '));
const lineOf = lineLines({ traits: ['fleet', 'curious'], pedigree: PEDIGREE });
check('the dam and sire, and the line', lines.includes(pedigreeLine(PEDIGREE)) && lineOf.length === 1 && lineOf.every((l) => lines.includes(l)), lines.join(' | '));
const wren = mineSeen?.theirs.things[0]?.beast;
const wrenLines = wren ? beastLines(wren, all) : [];
check('no pedigree on one not bred', wrenLines.includes('Pedigree: none'), wrenLines.join(' | '));

/* ---- the crate's wildermon changed under the trade ----------------------------- */
console.log('--- changed under the trade');
const r1 = rev(n);
accept(IVAR, n, r1);
follow(IVAR, PIP_CRATE);
check('Ivar accepted, then let Pip out: Tag went into the crate in its place', inCrate(PIP_CRATE) === String(TAG) && keeper(PIP) === IVAR, inCrate(PIP_CRATE));
const late = accept(HILD, n, r1);
check('Hild\'s Accept against the trade as it was is refused', late.why === barterSaid('changed'), JSON.stringify(late.why));
check('both Accepts are taken back', oks(n) === 'false,false' && rev(n) > r1, `${oks(n)} rev ${rev(n)}`);
const stirred = barterSaid('stirred', { who: 'Ivar', what: barterThing('creature_crate') });
check('and both are told what changed', lastLine(IVAR) === stirred && lastLine(HILD) === stirred, `${lastLine(IVAR)} / ${lastLine(HILD)}`);
check('Hild now sees Tag in that crate', read(HILD).barter?.theirs.things.find((t) => t.id === PIP_CRATE)?.beast?.name === 'Tag');
check('and nothing moved', holder(PIP_CRATE) === `player:${IVAR}` && keeper(TAG) === IVAR && keeper(WREN) === HILD);
follow(IVAR, PIP_CRATE);
check('Pip back in, Tag out', inCrate(PIP_CRATE) === String(PIP), inCrate(PIP_CRATE));
const r2 = rev(n);
read(IVAR);
check('a look sees it changed again: both Accepts back once more', rev(n) > r2 && oks(n) === 'false,false', `${oks(n)} rev ${rev(n)}`);

// At the deal itself, under its locks: a crate not as it was accepted is refused, whatever the look before it saw.
psql(`update item set creature = ${TAG} where id = ${PIP_CRATE};
      update creature set mode = 'stored' where world_id = '${W}' and id = ${TAG};`);
const atDeal = psql(`select coalesce(barter_side_refusal(b, '${IVAR}'), 'none') from barter b where world_id = '${W}' and n = ${n};`);
check('the deal\'s own check refuses a crate whose wildermon is not the one accepted', atDeal === barterSaid('changed'), atDeal);
psql(`update item set creature = ${PIP} where id = ${PIP_CRATE};
      update creature set mode = 'active' where world_id = '${W}' and id = ${TAG};`);

/* ---- the deal ---------------------------------------------------------------- */
console.log('--- the deal');
read(HILD);
const r3 = rev(n);
accept(HILD, n, r3);
const done = accept(IVAR, n, r3);
check('both accept: done', done.done === true, JSON.stringify(done));
check('the crate is Hild\'s, with Pip in it', holder(PIP_CRATE) === `player:${HILD}` && inCrate(PIP_CRATE) === String(PIP));
check('and Pip is Hild\'s', keeper(PIP) === HILD, keeper(PIP));
check('kept by her perks, at no work post', psql(`select (kept is not distinct from kept_of('${W}', '${HILD}')) || ',' || (post is null) || ',' || mode
  from creature where world_id = '${W}' and id = ${PIP};`) === 'true,true,stored');
check('its name, sex, traits, forms, rarity, skills, stance and pedigree untouched', blood(PIP) === pipBlood, `${blood(PIP)} / ${pipBlood}`);
check('the empty crate is Hild\'s too, still empty', holder(EMPTY) === `player:${HILD}` && inCrate(EMPTY) === 'empty');
check('Wren is Ivar\'s, untouched', keeper(WREN) === IVAR && holder(WREN_CRATE) === `player:${IVAR}` && blood(WREN) === wrenBlood);
check('Hild\'s pack heard the crate come, with Pip in it', psql(`select count(*) from realtime.messages where topic = 'own:${W}:${HILD}' and event = 'pack'
  and exists (select 1 from jsonb_array_elements(payload->'set') s where (s->>'id')::bigint = ${PIP_CRATE} and (s->>'creature')::int = ${PIP});`) !== '0');
const hersNow = as(HILD, `select r from jsonb_array_elements(rpc_creatures('${W}')) r where (r->>'id')::int = ${PIP};`);
check('her creature read has Pip as hers, with its pedigree', !hersNow.err && JSON.parse(hersNow.out || '{}').mine === true
  && JSON.parse(hersNow.out || '{}').pedigree?.dam?.name === 'Snow', hersNow.err || hersNow.out);
const hisNow = as(IVAR, `select coalesce((select (r->>'mine') from jsonb_array_elements(rpc_creatures('${W}')) r where (r->>'id')::int = ${PIP}), 'absent');`);
check('and his no longer does', !hisNow.err && hisNow.out !== 'true', hisNow.err || hisNow.out);
check('no field guide "tamed" for Hild: she did not tame it', psql(`select count(*) from guide where world_id = '${W}' and uid = '${HILD}' and tamed;`) === '0');
check('Ivar cannot open the crate', openRefusal(IVAR, PIP_CRATE) !== 'opens', openRefusal(IVAR, PIP_CRATE));
check('Hild can', openRefusal(HILD, PIP_CRATE) === 'opens', openRefusal(HILD, PIP_CRATE));
follow(HILD, PIP_CRATE);
check('and lets Pip out to follow her', psql(`select mode || ',' || (keeper = '${HILD}') from creature where world_id = '${W}' and id = ${PIP};`) === 'active,true'
  && inCrate(PIP_CRATE) === 'empty');

psql(CLEAN);
console.log(ok.join('\n'));
if (bad.length) {
  console.log(bad.join('\n'));
  console.log(`\n${bad.length} of ${ok.length + bad.length} failed`);
  process.exit(1);
}
console.log(`\nall ${ok.length} passed`);
