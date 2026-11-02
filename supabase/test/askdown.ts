/**
 * A page opened before the island's migrations asks the new way again once the island has them.
 *
 * Seen on the live island: every `rpc_creatures` call in the old form for half an hour after the migration with the
 * new one went live. The site goes out before the migrations, a page opened in between was told "no such function"
 * (`PGRST202`) once, and asked the old way until it was reloaded. Measured here on the browser's own `Island`, its
 * calls answered by a stand-in island through `fetch`:
 *
 *   * an island without the new forms: the page tries the one round trip (`rpc_near`), the packed creatures, the
 *     creatures with a cursor and the ground with a cursor, is told each is missing, and is answered the old way;
 *   * asked again soon after, it asks only the old way: no request spent on what was just found missing;
 *   * the island takes its migrations; `RETRY_NEWER` seconds on, the page asks the new way again, the cursor and all,
 *     in one round trip, and the next ask hands back the cursor it was given;
 *   * and the creatures and the ground, out of step to begin with, come into step and go in one round trip.
 *
 * No database: nothing here reaches past the stand-in.
 */
import { Island } from '../../src/net/island';
import { RETRY_NEWER } from '../../src/net/askdown';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/* ---- the stand-in island ----------------------------------------------------------------------------------------- */

let upgraded = false;
const asked: Array<{ door: string; args: Record<string, unknown> }> = [];
const answer = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const missing = (door: string): Response =>
  answer(404, { code: 'PGRST202', message: `Could not find the function public.${door} in the schema cache`, details: null, hint: null });
const creatures = (args: Record<string, unknown>): unknown =>
  'p_since' in args ? { at: 'v1:1:1:1:', rows: [], gone: [], full: true, ...(args.p_pack ? { cols: ['id'] } : {}) } : [];
const ground = (since: unknown): unknown => ({
  placed: [], crates: [], lying: [], cellarLying: [],
  ...(since === undefined ? {} : { at: 'g1:100.5:100.5:40:0:v1:1:1:1:', full: true }),
});
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const door = /\/rest\/v1\/rpc\/(\w+)/.exec(url.pathname)?.[1];
  if (!door) return answer(200, null);
  const args = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  asked.push({ door, args });
  const newer = door === 'rpc_near' || 'p_since' in args || 'p_pack' in args;
  if (newer && !upgraded) return missing(door);
  if (door === 'rpc_near') return answer(200, { creatures: creatures(args), ground: ground(args.p_ground_since) });
  if (door === 'rpc_creatures') return answer(200, creatures(args));
  if (door === 'rpc_ground') return answer(200, ground(args.p_since));
  return answer(200, null);
}) as typeof fetch;

// The page's clock, moved on by hand.
let clock = 1000;
Object.defineProperty(globalThis.performance, 'now', { configurable: true, value: () => clock * 1000 });

/* ---- the page --------------------------------------------------------------------------------------------------- */

let mobsLaid = 0;
let groundLaid = 0;
const island = new Island({ mobs: () => void mobsLaid++, built: () => void groundLaid++ } as unknown as ConstructorParameters<typeof Island>[0]);
(island as unknown as { info: unknown }).info = { id: '00000000-0000-4000-8000-0000000000aa', size: 4096 };
const doors = (): string => asked.map((a) => `${a.door}(${Object.keys(a.args).filter((k) => k !== 'p_world').join(',')})`).join(' ');
const round = async (secs: number): Promise<string> => {
  clock += secs;
  asked.length = 0;
  await island.refreshNear(clock);
  return doors();
};

const first = await round(0);
check('an island without the new forms: each is tried, found missing, and the old way answers',
  asked.length === 6 && asked[0].door === 'rpc_near' && asked.filter((a) => !('p_since' in a.args) && a.door !== 'rpc_near').length === 2
    && mobsLaid === 1 && groundLaid === 1, first);

const soon = await round(4);
check('asked again soon after, only the old way: nothing spent on what was just found missing',
  asked.length === 2 && asked.every((a) => !('p_since' in a.args) && !('p_pack' in a.args) && a.door !== 'rpc_near') && mobsLaid === 2,
  soon);

upgraded = true;
const stillSoon = await round(4);
check(`the island takes its migrations; within ${RETRY_NEWER} s the page still asks the old way`,
  asked.every((a) => !('p_since' in a.args)), stillSoon);

const later = await round(RETRY_NEWER);
const near = asked[0];
check(`${RETRY_NEWER} s on, the page asks the new way again: both in one round trip, with a cursor, packed`,
  asked.length === 1 && near?.door === 'rpc_near' && near.args.p_since === '' && near.args.p_ground_since === '' && near.args.p_pack === true,
  later);

const next = await round(4);
check('and the next ask hands back the cursors it was given', asked.length === 1 && asked[0].door === 'rpc_near'
  && asked[0].args.p_since === 'v1:1:1:1:' && String(asked[0].args.p_ground_since).startsWith('g1:'), next);

// Asked every tenth of a second, as the page's frames ask, with the two reads out of step to begin with: they come
// into step and go together, the creatures once a second and the ground with them while the body is busy.
(island as unknown as { lastGround: number }).lastGround = clock - 0.65;
asked.length = 0;
for (let i = 0; i < 100; i++) {
  clock += 0.1;
  (island as unknown as { stirred: boolean }).stirred = true;
  await island.refreshNear(clock);
}
const byDoor = (door: string): number => asked.filter((a) => a.door === door).length;
check('ten seconds busy, out of step at first: the two come into step, and go in one round trip after',
  byDoor('rpc_near') >= 9 && byDoor('rpc_creatures') + byDoor('rpc_near') <= 11 && byDoor('rpc_ground') <= 1,
  `rpc_near ${byDoor('rpc_near')}, rpc_creatures ${byDoor('rpc_creatures')}, rpc_ground ${byDoor('rpc_ground')}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe new forms asked again once the island has them — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
