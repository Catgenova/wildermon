/**
 * Bodies go to the blocks round you, not to the whole island.
 *
 * A body (and a wave, a cast, a spell's after-effect) goes out on the topic of
 * the block its sender stands in, `near:<island>:<block>`, and each browser
 * listens on the nine round it (`blocksAround`). So a body reaches whoever is
 * within a block of it and nobody farther: the messages a second are the
 * people near you, not the square of everybody on the island.
 *
 * Checked here, with two `Island`s in one page sharing their channels as two
 * browsers share a topic, and a message handed to a channel's own bindings as
 * Realtime would hand it over:
 *   * nine topics held in the middle of an island, four in its corner;
 *   * the one sent on is the block stood in;
 *   * a body in the next block is heard, one two blocks off is not held at all;
 *   * walking into the next block leaves three and joins three, keeping six;
 *   * a body on a topic let go of is not heard, though another still holds it;
 *   * nothing goes on the island's old shared topic.
 */
import { Island } from '../../src/net/island';
import { REGION } from '../../src/game/keep';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

type Bind = { filter: { event?: string }; callback: (m: unknown) => void };
type Ch = { topic: string; state: string; bindings: Record<string, Bind[] | undefined>; subscribe(): unknown };
type Inner = {
  info: unknown; me: unknown; uid: string;
  nearby: Map<string, Ch>; bodies: Ch | null;
  holdBodies(world: string, x: number, y: number): void;
};

const WORLD = 'w';
const SIZE = 16 * REGION;
const seen: Record<string, string[]> = { a: [], b: [] };
const make = (uid: string, x: number, y: number): { island: Island; inner: Inner } => {
  const island = new Island({
    say: () => {}, ground: () => {}, pack: () => {},
    people: (rows) => { seen[uid] = rows.map((r) => r.uid); },
  });
  const inner = island as unknown as Inner;
  inner.info = { id: WORLD, size: SIZE, seed: 1, name: 'Stand-in', spawn_x: 0, spawn_y: 0, epoch: '2026-01-01T00:00:00Z' };
  inner.me = { uid, name: uid, x, y, level: 0 };
  inner.uid = uid;
  inner.holdBodies(WORLD, x, y);
  return { island, inner };
};
const blockOf = (x: number, y: number): number => Math.floor(y / REGION) * 1024 + Math.floor(x / REGION);
const topic = (x: number, y: number): string => `near:${WORLD}:${blockOf(x, y)}`;
/** Hand a broadcast to a channel's bindings, as Realtime does with one that came in. */
const arrive = (ch: Ch, event: string, payload: unknown): void => {
  for (const b of ch.bindings.broadcast ?? []) if (b.filter.event === event) b.callback({ type: 'broadcast', event, payload });
};

const mid = 5.5 * REGION;
const a = make('a', mid, mid);
check('nine topics held in the middle of an island', a.inner.nearby.size === 9, String(a.inner.nearby.size));
check('every one of them a block round you', [...a.inner.nearby.keys()].every((t) => {
  const b = Number(t.split(':')[2]);
  return Math.abs((b % 1024) - 5) <= 1 && Math.abs(Math.floor(b / 1024) - 5) <= 1;
}), [...a.inner.nearby.keys()].join(' '));
check('the one sent on is the block stood in', a.inner.bodies?.topic === `realtime:${topic(mid, mid)}`, a.inner.bodies?.topic ?? 'none');
check('nothing on the island\'s old shared topic', ![...a.inner.nearby.values()].some((ch) => ch.topic.includes(`island:${WORLD}`)));

const corner = make('c', 10, 10);
check('four in the corner of the island', corner.inner.nearby.size === 4, String(corner.inner.nearby.size));

// Somebody one block east: heard.
const b = make('b', mid + REGION, mid);
arrive(b.inner.bodies as Ch, 'body', { uid: 'b', name: 'b', x: mid + REGION, y: mid, level: 0 });
check('a body in the next block is heard', seen.a.includes('b'), seen.a.join());
check('and not by its own sender', !seen.b.includes('b'), seen.b.join());
check('and the sender\'s topic is one the hearer holds', a.inner.nearby.has(topic(mid + REGION, mid)));

// Somebody two blocks east: not held at all.
check('a block two off is not held', !a.inner.nearby.has(topic(mid + 2 * REGION, mid)));

// Walking a block west: three left, three joined, six kept.
const before = new Map(a.inner.nearby);
a.inner.holdBodies(WORLD, mid - REGION, mid);
const kept = [...a.inner.nearby].filter(([t, ch]) => before.get(t) === ch).length;
const left = [...before.keys()].filter((t) => !a.inner.nearby.has(t)).length;
check('a walk into the next block keeps six, leaves three and joins three',
  a.inner.nearby.size === 9 && kept === 6 && left === 3, `${a.inner.nearby.size} held, ${kept} kept, ${left} left`);
check('and sends on the new block', a.inner.bodies?.topic === `realtime:${topic(mid - REGION, mid)}`, a.inner.bodies?.topic ?? 'none');

// The block east of where we were is let go of; b still holds it and speaks on it.
seen.a = [];
arrive(b.inner.bodies as Ch, 'body', { uid: 'b', name: 'b', x: mid + REGION + 1, y: mid, level: 0 });
check('a body on a topic let go of is not heard, though another still holds it', !seen.a.includes('b'), seen.a.join());

// A wave goes the same way.
let waved = '';
const w = make('w', mid - REGION, mid);
(a.island as unknown as { hooks: { emote?: (uid: string, name: string, e: string) => void } }).hooks.emote = (uid) => { waved = uid; };
arrive(w.inner.bodies as Ch, 'emote', { uid: 'w', name: 'w', emote: 'wave' });
check('a wave in the same block is seen', waved === 'w', waved);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nbodies to the blocks round you — ${ok.length} of ${ok.length + bad.length}`);
process.exit(bad.length ? 1 : 0);
