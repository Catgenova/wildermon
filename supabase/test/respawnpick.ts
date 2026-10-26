/**
 * On death, where to wake: a Runestone or a settlement of yours
 * (`src/game/respawn.ts`, `src/ui/respawn.ts`; `player_die`, `respawn_offer`,
 * `rpc_settle`'s `fallen` and `rpc_respawn` on the island).
 *
 * Asked for: "show that screen [the Runestone start picker] on death, with an
 * indicator of how far each rune is from your corpse, or an option to respawn
 * at your deed token or one you belong to". So this asks, of the island:
 *
 *   * a death is as it was: the body wakes whole on the spawn, what it carried
 *     in a grave where it fell, said in the same line; and the beat then
 *     carries the offer: where it fell, and the settlement it founded and the
 *     one it is a citizen of, with token and level -- not one it is neither;
 *   * picking each of the five stones wakes it on the first tile of the ring a
 *     first join starts on round that stone (`START_RING`), and the offer goes;
 *   * picking its own settlement, or the one it is a citizen of, wakes it on
 *     the first tile of `RESPAWN_RING` round the token; with that tile built
 *     on, the next;
 *   * a settlement it neither founded nor belongs to is refused, the body
 *     stays and the offer stands; so is anybody who has not died, and a body
 *     that stepped off the spawn, whose offer is gone even back on it; and a
 *     pick that is no stone, settlement or `stay` is refused at the door;
 *   * `stay`, or never picking, leaves the body on the spawn (the default);
 *   * a death by a blow (`hurt_player`) makes the offer too;
 *   * the tiles tried round a token, and their order, are the browser's
 *     (`respawn_ring` against `RESPAWN_RING`);
 *
 * and of the browser:
 *
 *   * `respawnChoices` gives the five stones then the settlements, each with
 *     its distance from where the body fell, to the stone's `stonePoint` and
 *     the middle of the token's tile; and `fallenIn` reads the island's offer;
 *   * `Island` hands each beat's offer to its hook, and `respawn` knocks at
 *     `rpc_respawn` and puts the body where the island says, or says why not;
 *   * in Chromium (`respawnpick-page.ts`), over the world: the island's own
 *     offer shown as the five stones and the two settlements, each by name,
 *     place and distance in tiles, with its picture (no two alike), and a way
 *     to stay; the first card has the keys, which go round the cards and
 *     never reach the game; a card clicked is what is sent, and the chooser
 *     goes; a refusal shows it again, with why; an offer withdrawn takes it
 *     away; and on a phone nothing is off the side of the screen.
 *     `RESPAWN_SHOTS=<dir>` keeps a picture of it on a desktop and a phone.
 *     Needs a Chromium as `stonestart.ts` does; without one that part is
 *     skipped, unless `RESPAWN_STRICT` is set.
 *
 * Runs against the database the suite leaves behind; the island half is
 * rolled back.
 *
 *   npx esbuild supabase/test/respawnpick.ts --bundle --platform=node --format=esm \
 *     --external:typescript --outfile=node_modules/.cache/respawnpick.mjs && node node_modules/.cache/respawnpick.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import {
  DEED_AT, DEEDS_HEAD, fallenIn, RESPAWN_RING, RESPAWN_STAY, respawnChoices, STAY_SAID, STONES_HEAD, tilesBetween, tilesSaid, type Fallen,
} from '../../src/game/respawn';
import { RUNESTONES, START_RING, stoneCentre, stonePoint } from '../../src/game/runestones';
import { Island } from '../../src/net/island';
import { supabase } from '../../src/net/supabase';
import type { Driven, Shown } from './respawnpick-page';

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

/* ---- the island ------------------------------------------------------------ */

const N = 1024;
const SPAWN = 5;
const ME = '5e5b0000-0000-4000-8000-000000000001';
const CIT = '5e5b0000-0000-4000-8000-000000000002';
const STR = '5e5b0000-0000-4000-8000-000000000003';
/** Where the body falls, and the three settlements: its own, the one it is a citizen of, and a stranger's. */
const FALL = { x: 400.5, y: 650.5 };
const OWN = { x: 300, y: 300, name: 'Ashford', level: 3 };
const MEMBER = { x: 600, y: 200, name: 'Brightwater', level: 1 };
const FOREIGN = { x: 800, y: 500, name: 'Coldharbour', level: 2 };
const SPAWN_AT = `${SPAWN + 0.5},${SPAWN + 0.5}`;

const out = psql(`
begin;
create temp table said (k text, v text);
-- As somebody, with nothing paced against them yet.
create function pg_temp.as_(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from caller where uid = u;
end $f$;
-- Fall at FALL, carrying a hatchet.
create function pg_temp.die(w uuid, u uuid) returns void language plpgsql as $f$
begin
  update player set x = ${FALL.x}, y = ${FALL.y}, level = 0 where world_id = w and uid = u;
  perform give(w, u, 'hatchet', 1, 50, null, null, null, null, null);
  perform player_die(w, u);
end $f$;
-- The beat's offer.
create function pg_temp.offer(w uuid, u uuid) returns text language plpgsql as $f$
begin
  perform pg_temp.as_(u);
  return coalesce(rpc_settle(null, w, null, false, null)->'fallen', 'null'::jsonb)::text;
end $f$;
-- A pick: the answer, then where the body is.
create function pg_temp.pick(w uuid, u uuid, p_at text) returns text language plpgsql as $f$
declare j jsonb;
begin
  perform pg_temp.as_(u);
  j := rpc_respawn(w, p_at);
  return coalesce(j->>'why', (j->>'x') || ',' || (j->>'y')) || '|' || (select p.x || ',' || p.y from player p where p.world_id = w and p.uid = u);
exception when others then
  return 'ERR ' || sqlerrm || '|' || (select p.x || ',' || p.y from player p where p.world_id = w and p.uid = u);
end $f$;
insert into said select 'RING', string_agg(k || ':' || dx || ',' || dy, ' ' order by k) from respawn_ring();
do $t$
declare w uuid; s record; me uuid := '${ME}'; cit uuid := '${CIT}'; str uuid := '${STR}'; k int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Wakeful', 4248, ${N}, ${SPAWN}, ${SPAWN}, true) returning id into w;
  perform land_blank(w, ${N});
  -- Dry and level west of x 1000, where every stone stands on a world this size; the sea east of it.
  update land_corner set heights = decode(repeat('0a00', 1000) || repeat('d8ff', ${N + 1 - 1000}), 'hex') where world_id = w;
  perform pg_temp.as_(cit); perform rpc_join(w, 'Cyne');
  perform pg_temp.as_(str); perform rpc_join(w, 'Stray');
  perform pg_temp.as_(me); perform rpc_join(w, 'Mearh');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values
    (w, '${OWN.name}', ${OWN.x}, ${OWN.y}, 5, ${OWN.level}, me),
    (w, '${MEMBER.name}', ${MEMBER.x}, ${MEMBER.y}, 5, ${MEMBER.level}, cit),
    (w, '${FOREIGN.name}', ${FOREIGN.x}, ${FOREIGN.y}, 5, ${FOREIGN.level}, str);
  insert into deed_member (world_id, founder, uid, role) values (w, cit, me, 'guest');

  -- 1. Never died: no offer, and a pick is refused.
  insert into said values ('LIVE_OFFER', pg_temp.offer(w, me));
  insert into said values ('LIVE_PICK', pg_temp.pick(w, me, 'crownstone'));

  -- 2. A death: where the body is, its health, the grave, the line, and the offer.
  perform pg_temp.die(w, me);
  insert into said values ('DEAD_AT', (select x || ',' || y || ',' || level || ',' || (stats->>'health') || ',' || jsonb_array_length(wounds) from player where world_id = w and uid = me));
  insert into said values ('GRAVE', (select count(*) || ',' || min(x) || ',' || min(y) from placed where world_id = w and made_by = me and crumbles_at is not null));
  insert into said values ('LINE', (select text from event where world_id = w and uid = me order by n desc limit 1));
  insert into said values ('OFFER', pg_temp.offer(w, me));
  insert into said values ('OFFER_AGAIN', pg_temp.offer(w, me));

  -- 3. A settlement it neither founded nor belongs to: refused, and the offer stands.
  insert into said values ('FOREIGN', pg_temp.pick(w, me, '${DEED_AT}' || str));
  insert into said values ('FOREIGN_OFFER', (pg_temp.offer(w, me) <> 'null')::text);

  -- 4. Each stone, a death before each.
  for s in select * from runestones() order by ord loop
    if s.ord > 0 then perform pg_temp.die(w, me); end if;
    insert into said values ('STONE:' || s.ord, pg_temp.pick(w, me, s.id));
    insert into said values ('STONE_OFFER:' || s.ord, pg_temp.offer(w, me));
  end loop;

  -- 5. Its own settlement, the one it is a citizen of, and its own with the first tile round the token built on.
  perform pg_temp.die(w, me);
  insert into said values ('OWN', pg_temp.pick(w, me, '${DEED_AT}' || me));
  perform pg_temp.die(w, me);
  insert into said values ('MEMBER', pg_temp.pick(w, me, '${DEED_AT}' || cit));
  insert into building (world_id, id, name) values (w, 9501, 'Hut');
  insert into building_tile (world_id, building, x, y) values (w, 9501, ${OWN.x + RESPAWN_RING[0][0]}, ${OWN.y + RESPAWN_RING[0][1]});
  perform pg_temp.die(w, me);
  insert into said values ('OWN_BUILT', pg_temp.pick(w, me, '${DEED_AT}' || me));

  -- 6. Stay: on the spawn, and the offer gone.
  perform pg_temp.die(w, me);
  insert into said values ('STAY', pg_temp.pick(w, me, '${RESPAWN_STAY}'));
  insert into said values ('STAY_OFFER', pg_temp.offer(w, me));

  -- 7. Never picking, and a step off the spawn: the offer goes, and does not come back on the tile.
  perform pg_temp.die(w, me);
  update player set x = ${SPAWN + 1.5} where world_id = w and uid = me;
  insert into said values ('STEPPED', pg_temp.offer(w, me));
  update player set x = ${SPAWN + 0.5} where world_id = w and uid = me;
  insert into said values ('BACK', pg_temp.offer(w, me));
  insert into said values ('BACK_PICK', pg_temp.pick(w, me, 'mossmere'));

  -- 8. Not a stone, a settlement or stay: refused at the door.
  perform pg_temp.die(w, me);
  insert into said values ('WRONG', pg_temp.pick(w, me, 'atlantis'));
  insert into said values ('WRONG_DEED', pg_temp.pick(w, me, 'deed:somebody'));

  -- 9. A death by a blow.
  perform pg_temp.pick(w, me, '${RESPAWN_STAY}');
  update player set x = ${FALL.x}, y = ${FALL.y} where world_id = w and uid = me;
  k := 0;
  while k < 40 and not exists (select 1 from private.fallen f where f.world_id = w and f.uid = me) loop
    update player set stats = jsonb_set(stats, '{health}', '0.001') where world_id = w and uid = me;
    perform hurt_player(w, me, 500, 'a test', 'bite');
    k := k + 1;
  end loop;
  insert into said values ('BLOW', pg_temp.offer(w, me));
end $t$;
select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) said.set(line.slice(0, i), line.slice(i + 1));
}

const ringWant = RESPAWN_RING.map(([dx, dy], k) => `${k}:${dx},${dy}`).join(' ');
check(`the tiles a body may wake on round a token, in order, are the browser's: ${RESPAWN_RING.length}`, said.get('RING') === ringWant, said.get('RING') === ringWant ? '' : said.get('RING'));
check('the first of them is next to the token', Math.max(Math.abs(RESPAWN_RING[0][0]), Math.abs(RESPAWN_RING[0][1])) === 1, RESPAWN_RING[0].join(','));

const NOT_DEAD = 'Respawn: only after a death, before moving.';
check('never died: no offer on the beat', said.get('LIVE_OFFER') === 'null', said.get('LIVE_OFFER'));
check('never died: a pick is refused, and the body stays', said.get('LIVE_PICK') === `${NOT_DEAD}|${SPAWN_AT}`, said.get('LIVE_PICK'));
check('a death, as before: on the spawn, whole (health 1, no wounds), on the ground floor', said.get('DEAD_AT') === `${SPAWN_AT},0,1,0`, said.get('DEAD_AT'));
check('what it carried in a grave where it fell', said.get('GRAVE') === `1,${Math.floor(FALL.x)},${Math.floor(FALL.y)}`, said.get('GRAVE'));
check('and said in the same line', /^You have died\. What you carried is in a grave where you fell/.test(said.get('LINE') ?? ''), said.get('LINE'));

const offer = fallenIn(JSON.parse(said.get('OFFER') ?? 'null'));
const deedsSaid = offer?.deeds.map((d) => `${d.id}|${d.name}|${d.x},${d.y}|${d.level}|${d.own}`).join(' ');
check('the beat carries where the body fell', !!offer && offer.x === FALL.x && offer.y === FALL.y, said.get('OFFER'));
check('and its own settlement then the one it is a citizen of, with token and level; not the stranger\'s', deedsSaid
  === `${ME}|${OWN.name}|${OWN.x},${OWN.y}|${OWN.level}|true ${CIT}|${MEMBER.name}|${MEMBER.x},${MEMBER.y}|${MEMBER.level}|false`, deedsSaid);
check('and again on the next beat', said.get('OFFER_AGAIN') === said.get('OFFER'));
check('a settlement it neither founded nor belongs to is refused, the body stays', said.get('FOREIGN') === `Respawn: not your settlement.|${SPAWN_AT}`, said.get('FOREIGN'));
check('  and the offer stands', said.get('FOREIGN_OFFER') === 'true', said.get('FOREIGN_OFFER'));

RUNESTONES.forEach((s, i) => {
  const c = stoneCentre(s, N);
  const want = `${c.x + START_RING[0][0] + 0.5},${c.y + START_RING[0][1] + 0.5}`;
  check(`picking ${s.name} wakes on the first tile of a first join's ring round it, ${want}`, said.get(`STONE:${i}`) === `${want}|${want}`, said.get(`STONE:${i}`));
  check('  and the offer goes', said.get(`STONE_OFFER:${i}`) === 'null', said.get(`STONE_OFFER:${i}`));
});
const tok = (d: { x: number; y: number }, k: number): string => `${d.x + RESPAWN_RING[k][0] + 0.5},${d.y + RESPAWN_RING[k][1] + 0.5}`;
check(`its own settlement: next to the token, ${tok(OWN, 0)}`, said.get('OWN') === `${tok(OWN, 0)}|${tok(OWN, 0)}`, said.get('OWN'));
check(`the one it is a citizen of: next to that token, ${tok(MEMBER, 0)}`, said.get('MEMBER') === `${tok(MEMBER, 0)}|${tok(MEMBER, 0)}`, said.get('MEMBER'));
check(`that tile built on: the next, ${tok(OWN, 1)}`, said.get('OWN_BUILT') === `${tok(OWN, 1)}|${tok(OWN, 1)}`, said.get('OWN_BUILT'));
check('stay: on the spawn', said.get('STAY') === `${SPAWN_AT}|${SPAWN_AT}`, said.get('STAY'));
check('  and the offer gone', said.get('STAY_OFFER') === 'null', said.get('STAY_OFFER'));
check('never picking, a step off the spawn: no offer', said.get('STEPPED') === 'null', said.get('STEPPED'));
check('  nor back on it, and a pick is refused', said.get('BACK') === 'null' && said.get('BACK_PICK') === `${NOT_DEAD}|${SPAWN_AT}`, `${said.get('BACK')} ${said.get('BACK_PICK')}`);
check('a pick that is no stone is refused at the door',
  said.get('WRONG') === `ERR Bad request: rpc_respawn p_at: not a Runestone, a settlement or stay.|${SPAWN_AT}`, said.get('WRONG'));
check('nor a settlement named by no founder', (said.get('WRONG_DEED') ?? '').startsWith('ERR Bad request: rpc_respawn p_at'), said.get('WRONG_DEED'));
const blow = fallenIn(JSON.parse(said.get('BLOW') ?? 'null'));
check('a death by a blow makes the offer too', !!blow && blow.x === FALL.x && blow.y === FALL.y && blow.deeds.length === 2, said.get('BLOW'));

/* ---- the browser ------------------------------------------------------------ */

const choices = offer ? respawnChoices(offer, N) : [];
const wantCards = offer ? [
  ...RUNESTONES.map((s) => `${s.id}|${s.name}|${s.place}|${tilesSaid(tilesBetween(offer, stonePoint(s, N)))}`),
  `${DEED_AT}${ME}|${OWN.name}|Founder|${tilesSaid(tilesBetween(offer, { x: OWN.x + 0.5, y: OWN.y + 0.5 }))}`,
  `${DEED_AT}${CIT}|${MEMBER.name}|Member|${tilesSaid(tilesBetween(offer, { x: MEMBER.x + 0.5, y: MEMBER.y + 0.5 }))}`,
] : [];
const gotCards = choices.map((c) => `${c.at}|${c.name}|${c.place}|${tilesSaid(c.tiles)}`);
check('respawnChoices: the five stones, then its settlements, each with its distance from where it fell',
  JSON.stringify(gotCards) === JSON.stringify(wantCards), gotCards.join('; '));
check('  the Crownstone, by hand', choices[0]?.tiles === Math.round(Math.hypot(538.5 - FALL.x, 737.5 - FALL.y)), String(choices[0]?.tiles));
check('respawnChoices: no stones on a test\'s world, the settlements still', respawnChoices({ x: 1, y: 1, deeds: offer?.deeds ?? [] }, 256).length === 2);
check('tilesSaid: one tile, two tiles', tilesSaid(1) === '1 tile' && tilesSaid(2) === '2 tiles');
check('fallenIn: none, and not one', fallenIn(null) === null && fallenIn({ x: 'a' }) === null && fallenIn({ x: 1, y: 2 })?.deeds.length === 0);

{
  // `Island` over a stand-in keeper: the beat's offer to the hook, and the pick to the door.
  const asked: Array<[string, unknown]> = [];
  let answer: { data: unknown; error: unknown } = { data: null, error: null };
  const sb = supabase() as unknown as Record<string, unknown> & { auth: Record<string, unknown> };
  sb.rpc = async (door: string, args: unknown) => {
    asked.push([door, args]);
    return door === 'rpc_settle' ? { data: { settled: 0, fallen: offer }, error: null } : answer;
  };
  let heard: Fallen | null | undefined;
  const moved: string[] = [];
  const isl = new Island({ say: () => {}, ground: () => {}, people: () => {}, pack: () => {}, fallen: (f) => { heard = f; }, moved: (x, y, l) => moved.push(`${x},${y},${l}`) });
  (isl as unknown as { info: unknown }).info = { id: 'w', size: N };
  await (isl as unknown as { pulse: () => Promise<boolean> }).pulse();
  check('Island: the beat\'s offer goes to the hook', JSON.stringify(heard) === JSON.stringify(offer), JSON.stringify(heard));
  answer = { data: { x: 539.5, y: 740.5, level: 0 }, error: null };
  const no = await isl.respawn('crownstone');
  const knock = asked.find(([d]) => d === 'rpc_respawn');
  check('Island.respawn knocks at rpc_respawn with the pick, and the body goes where the island put it',
    no === null && JSON.stringify(knock?.[1]) === JSON.stringify({ p_world: 'w', p_at: 'crownstone' }) && moved.join(' ') === '539.5,740.5,0', `${no} ${JSON.stringify(knock)} ${moved.join(' ')}`);
  answer = { data: { why: 'Respawn: not your settlement.' }, error: null };
  check('  a refusal is said, and the body stays', await isl.respawn(`${DEED_AT}${STR}`) === 'Respawn: not your settlement.' && moved.length === 1);
  // The next beat each armed, which would keep this process up.
  clearTimeout((isl as unknown as { beat: ReturnType<typeof setTimeout> }).beat);
}

/* ---- the chooser, drawn ----------------------------------------------------- */

function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return {};
}

const shots = process.env.RESPAWN_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const options = browserOptions();
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
try {
  browser = options && offer ? await chromium.launch(options) : null;
} catch {
  browser = null;
}
const drive = <T>(tab: Page, fn: (c: Driven, arg: unknown) => T, arg?: unknown): Promise<T> =>
  tab.evaluate(([f, a]) => (new Function('c', 'a', `return (${f})(c, a)`))((window as unknown as { respawnpick: Driven }).respawnpick, a), [fn.toString(), arg] as const) as Promise<T>;

if (!browser || !offer) {
  console.log('respawnpick: no Chromium here (set CHROME_PATH); the chooser is not drawn.');
  if (process.env.RESPAWN_STRICT) bad.push('FAIL drawn: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/respawnpick-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const script = bundled.outputFiles[0].text;
  const css = ['src/style.css', 'src/phone.css'].map((f) => readFileSync(resolve(f), 'utf8')).join('\n');
  const page = async (phone: boolean): Promise<{ tab: Page; thrown: string[]; close: () => Promise<void> }> => {
    const ctx = await browser!.newContext(phone
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addStyleTag({ content: css });
    await tab.addScriptTag({ content: script });
    return { tab, thrown, close: () => ctx.close() };
  };
  try {
    const { tab, thrown, close } = await page(false);
    await drive(tab, (c, a) => c.offer((a as [Fallen, number])[0], (a as [Fallen, number])[1]), [offer, N]);
    let shown: Shown = await drive(tab, (c) => c.read());
    const wantN = respawnChoices(offer, N).map((c) => `${c.at}|${c.name}|${c.place}|${tilesSaid(c.tiles)}`);
    check(`drawn: over the world, the ${RUNESTONES.length} stones and the two settlements, by name, place and distance`,
      JSON.stringify(shown.cards) === JSON.stringify(wantN), shown.cards.join('; '));
    check('drawn: headed, a row each', JSON.stringify(shown.heads) === JSON.stringify([STONES_HEAD, DEEDS_HEAD]) && shown.title === 'Respawn', `${shown.title} ${shown.heads.join(' / ')}`);
    check('drawn: a way to stay, with how far the spawn is', shown.stay === `${STAY_SAID}: ${tilesSaid(tilesBetween(offer, shown.spawn))}`, shown.stay ?? '');
    check('drawn: the first card has the keys', shown.focus === RUNESTONES[0].id, shown.focus ?? '');
    const pics = await drive(tab, (c) => c.pictures());
    const shares = pics.painted.map((p) => Number(p.split('|')[1]));
    check('drawn: each card with its picture, a stone or a token on its grass, no two alike',
      pics.painted.length === RUNESTONES.length + 2 && shares.every((k) => k >= 0.01 && k < 0.9) && pics.distinct, `${pics.painted.join('; ')} distinct ${pics.distinct}`);
    if (shots) await tab.screenshot({ path: `${shots}/respawn-desktop.png` });
    const keys = await drive(tab, (c) => [c.key('ArrowRight'), c.key('ArrowRight'), c.key('ArrowLeft'), c.key('End'), c.key('Tab'), c.key('Tab', true), c.key('w')]);
    check('drawn: the arrows go between the cards, Tab goes round, and nothing reaches the game',
      keys.map((k) => k.focus).join(',') === `mossmere,harrowmark,mossmere,${RESPAWN_STAY},crownstone,${RESPAWN_STAY},${RESPAWN_STAY}` && keys.every((k) => k.game === 0),
      keys.map((k) => `${k.focus}:${k.game}`).join(','));
    await drive(tab, (c) => c.answer('Respawn: no free tile at Ashford.'));
    await drive(tab, (c, a) => c.click(a as string), `${DEED_AT}${ME}`);
    shown = await drive(tab, (c) => c.read());
    check('drawn: a card clicked is what is sent; refused, it is shown again with why',
      shown.sent.join(',') === `${DEED_AT}${ME}` && shown.open && shown.why === 'Respawn: no free tile at Ashford.', `${shown.sent.join(',')} ${shown.open} ${shown.why}`);
    await drive(tab, (c, a) => c.click(a as string), 'harrowmark');
    shown = await drive(tab, (c) => c.read());
    check('drawn: taken, the chooser goes', shown.sent.join(',') === `${DEED_AT}${ME},harrowmark` && !shown.open, `${shown.sent.join(',')} ${shown.open}`);
    await drive(tab, (c, a) => c.offer((a as [Fallen, number])[0], (a as [Fallen, number])[1]), [offer, N]);
    await drive(tab, (c) => c.offer(null, 0));
    shown = await drive(tab, (c) => c.read());
    check('drawn: an offer withdrawn takes the chooser away', !shown.open);
    await drive(tab, (c, a) => c.offer((a as [Fallen, number])[0], (a as [Fallen, number])[1]), [offer, N]);
    await drive(tab, (c) => c.click('stay'));
    shown = await drive(tab, (c) => c.read());
    check('drawn: stay is sent as stay', shown.sent.at(-1) === RESPAWN_STAY && !shown.open, shown.sent.join(','));
    check('drawn: nothing thrown', thrown.length === 0, thrown.join('; '));
    await close();

    const p = await page(true);
    await drive(p.tab, (c, a) => c.offer((a as [Fallen, number])[0], (a as [Fallen, number])[1]), [offer, N]);
    await drive(p.tab, (c) => c.pictures());
    const lay = await drive(p.tab, (c) => c.read());
    check('on a phone: all seven cards and the way to stay, nothing off the side of the screen',
      lay.cards.length === RUNESTONES.length + 2 && lay.outside.length === 0 && !!lay.stay, lay.outside.join(', '));
    if (shots) await p.tab.screenshot({ path: `${shots}/respawn-phone.png` });
    check('on a phone: nothing thrown', p.thrown.length === 0, p.thrown.join('; '));
    await p.close();
  } finally {
    await browser.close();
  }
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\non death, where to wake — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
