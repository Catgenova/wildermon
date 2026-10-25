/**
 * Coming ashore in phases, and coming back after a cut.
 *
 * The boot bar (`BootProgress`, src/ui/bootsteps.ts): its phases add to the
 * whole bar, each fills its own share and no more, it only grows, a phase that
 * is over cannot pull it back, a count towards nobody knows what is a count
 * and not a share, and each phase's time is written down. The near trees
 * (`nearFirst`) are the near ones, nearest first, in parts.
 *
 * Coming back (`Island.comeBack`), against a stand-in for the keeper and for
 * Phoenix, which keeps a socket the far end closed until its own backoff and
 * does nothing on `connect` until then: the socket opened at once rather than
 * after the backoff, every channel joined again, the history read only past
 * the cursor and only once the channels are back, the tile missed while cut
 * laid, and no join. And `watchReturn`: a cut seen while in front is come
 * back from within `CUT_POLL_MS`, with no notice for a cut mended inside
 * `CUT_QUIET_MS`; the network back while a coming back is under way is not
 * lost, and the notice is up while there is no network.
 */
import { BOOT_PHASES, BootProgress, NEAR_REACH } from '../../src/ui/bootsteps';
import { NEAR_PARTS, nearFirst } from '../../src/render/preload';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/* ---- The boot bar ---------------------------------------------------------- */
console.log('--- the boot bar');
{
  const total = BOOT_PHASES.reduce((s, p) => s + p.share, 0);
  check('the phases\' shares add to the whole bar', near(total, 1), String(total));
  check('every phase has a share and a label', BOOT_PHASES.every((p) => p.share > 0 && p.label.length > 0));
  check('the phases are auth, join, world, land, pack, trees and the first frame, in that order',
    BOOT_PHASES.map((p) => p.id).join() === 'auth,join,world,land,pack,trees,frame', BOOT_PHASES.map((p) => p.id).join());

  let t = 0;
  const steps = new BootProgress(() => t);
  check('nothing begun is an empty bar and no line', steps.fraction === 0 && steps.line === '');
  steps.at('auth');
  check('the first phase begun is still an empty bar', steps.fraction === 0 && steps.line === 'Signing in', steps.line);
  t = 100;
  steps.at('join');
  const share = (n: number): number => BOOT_PHASES.slice(0, n).reduce((s, p) => s + p.share, 0);
  check('a phase begun fills the ones before it', near(steps.fraction, share(1)), String(steps.fraction));
  check('and writes down how long the last took', steps.done.length === 1 && steps.done[0].id === 'auth' && steps.done[0].ms === 100,
    JSON.stringify(steps.done));
  t = 150;
  steps.at('land', 'near', 0, 2);
  check('a phase passed over is filled when a later one begins', near(steps.fraction, share(3)), String(steps.fraction));
  check('and has no time of its own', !steps.done.some((d) => d.id === 'world'), JSON.stringify(steps.done));
  steps.at('land', 'since', 1, 2);
  const land = BOOT_PHASES.find((p) => p.id === 'land')?.share ?? 0;
  check('a counted phase fills its own share by its count', near(steps.fraction, share(3) + land / 2), String(steps.fraction));
  check('and says what it is on', steps.line === 'Land: since', steps.line);
  const was = steps.fraction;
  steps.at('join', 'late');
  check('a phase that is over does not pull it back', steps.fraction === was && steps.line === 'Land: since', `${steps.fraction} ${steps.line}`);
  steps.at('land', 'again', 0, 2);
  check('nor does a count that goes down', steps.fraction === was, String(steps.fraction));
  steps.at('land', 'changes', 1234, 0);
  check('a count towards nobody knows what is a count, not a share', steps.fraction === was && steps.line === 'Land: changes 1,234', steps.line);
  steps.at('land', 'in', 9, 2);
  check('a count past its total fills its share and no more', near(steps.fraction, share(4)), String(steps.fraction));
  t = 400;
  steps.at('trees');
  steps.at('frame');
  let rising = true;
  let last = steps.fraction;
  for (const p of BOOT_PHASES) {
    steps.at(p.id, 'x', 1, 3);
    if (steps.fraction < last) rising = false;
    last = steps.fraction;
  }
  check('it only grows', rising);
  t = 500;
  steps.finish();
  check('finished is a full bar and no line', steps.fraction === 1 && steps.line === '' && steps.current === null);
  const times = steps.timings();
  check('each phase done has its time', times.auth === 100 && times.join === 50 && times.land === 250 && times.trees === 0 && times.frame === 100,
    JSON.stringify(times));
}

/* ---- The near trees -------------------------------------------------------- */
console.log('--- the near trees');
{
  const tiles = [];
  for (let d = 0; d <= 40; d++) tiles.push({ d: d * d, id: d });
  tiles.reverse();
  const { near: parts, far } = nearFirst(tiles);
  const flat = parts.flat();
  check(`the near ones are those within ${NEAR_REACH} tiles`, flat.every((t) => t.d <= NEAR_REACH ** 2) && flat.length === NEAR_REACH + 1, String(flat.length));
  check('nearest first', flat.every((t, i) => i === 0 || t.d >= flat[i - 1].d));
  check(`in ${NEAR_PARTS} parts of about the same count`, parts.length === NEAR_PARTS && Math.max(...parts.map((p) => p.length)) - Math.min(...parts.map((p) => p.length)) <= 1,
    parts.map((p) => p.length).join());
  check('the rest after, nearest first', far.length === tiles.length - flat.length && far.every((t) => t.d > NEAR_REACH ** 2) && far.every((t, i) => i === 0 || t.d >= far[i - 1].d));
  check('no trees is no parts', nearFirst([]).near.length === 0);
}

/* ---- Coming back ----------------------------------------------------------- */
console.log('--- coming back');

/*
 * A browser's worth of globals, for the parts of the client that look at them: enough for `supabase-js` to be
 * made and for `watchReturn` to put its notice up.
 */
type Listener = (e: { persisted?: boolean }) => void;
const listeners = new Map<string, Listener[]>();
const on = (type: string, fn: Listener): void => void listeners.set(type, [...(listeners.get(type) ?? []), fn]);
const fire = (type: string, e: { persisted?: boolean } = {}): void => { for (const fn of listeners.get(type) ?? []) fn(e); };
const store = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
const el = (): Record<string, unknown> => ({
  hidden: false, style: {}, textContent: '', className: '', offsetWidth: 800, offsetTop: 0, offsetLeft: 0, offsetHeight: 0,
  setAttribute() {}, append() {}, querySelectorAll: () => [],
});
let online = true;
g.document = { hidden: false, addEventListener: on, createElement: el, visibilityState: 'visible' };
g.window = Object.assign(globalThis, { addEventListener: on });
Object.defineProperty(globalThis, 'navigator', { value: { get onLine() { return online; } }, configurable: true });

const { supabase } = await import('../../src/net/supabase');
const { Island, REJOIN_WAIT_MS } = await import('../../src/net/island');
const { blankWorld } = await import('../../src/net/landpack');
const { CUT_POLL_MS, CUT_QUIET_MS, RECONNECTING, watchReturn } = await import('../../src/ui/phone');

/** What was asked, in order: `rpc:<door>` and `get:<table>`, and when the channels were joined. */
const asked: string[] = [];
let missed: Array<{ n: number; x: number; y: number; tile: number; data: number; corners: null; soil: null }> = [];

/** A stand-in Phoenix: a socket the far end closed is held, and `connect` does nothing until it is torn down. */
const rt = {
  state: 'open' as 'open' | 'closed' | 'connecting',
  held: false,
  connects: 0,
  backoff: 0 as ReturnType<typeof setTimeout> | 0,
  channels: [] as Array<{ state: string }>,
  isConnected() { return this.state === 'open'; },
  isConnecting() { return this.state === 'connecting'; },
  async disconnect() { clearTimeout(this.backoff); this.held = false; this.state = 'closed'; return 'ok'; },
  /** The client's own `connect`, which adds its handlers again on every call: not the one to use for waking. */
  clientConnects: 0,
  connect() { this.clientConnects++; this.open(); },
  socketAdapter: { connect: () => rt.open() },
  open() {
    if (this.held || this.state !== 'closed') return;
    this.connects++;
    this.state = 'connecting';
    setTimeout(() => {
      if (!online) { this.state = 'closed'; return; }
      this.state = 'open';
      asked.push('joined');
      // Every channel that errored joins again as the socket opens.
      for (const ch of this.channels) if (ch.state === 'errored') ch.state = 'joined';
    }, 20);
  },
  /** The far end closes the socket: every channel errored, and the socket held until a backoff of five seconds. */
  cut() {
    this.state = 'closed';
    this.held = true;
    for (const ch of this.channels) ch.state = 'errored';
    this.backoff = setTimeout(() => { this.held = false; this.open(); }, 5000);
  },
  async setAuth() {},
};

/** A query that answers every method with itself, and its read when awaited. */
function query(table: string): unknown {
  let after = 0;
  const q: Record<string, unknown> = {};
  const self = new Proxy(q, {
    get(_, key) {
      if (key === 'then') {
        asked.push(`get:${table}`);
        const rows = table === 'tile_change' ? missed.filter((c) => c.n > after) : [];
        return (done: (v: unknown) => void) => done(online ? { data: rows, error: null } : { data: null, error: { message: 'offline' } });
      }
      if (key === 'gt') return (_c: string, v: number) => { after = v; return self; };
      return () => self;
    },
  });
  return self;
}

const sb = supabase() as unknown as Record<string, unknown> & { auth: Record<string, unknown> };
sb.realtime = rt;
sb.from = (table: string) => query(table);
sb.rpc = async (door: string) => {
  asked.push(`rpc:${door}`);
  return online ? { data: {}, error: null } : { data: null, error: { message: 'offline' } };
};
sb.channel = () => { throw new Error('no new channel should be made coming back'); };
sb.removeChannel = async () => 'ok';
sb.auth.getSession = async () => ({ data: { session: { access_token: 't' } }, error: null });

const said: string[] = [];
const island = new Island({ say: (text) => said.push(text), ground: () => {}, people: () => {}, pack: () => {} });
const inner = island as unknown as {
  info: unknown; me: unknown; uid: string; world: unknown; hears: boolean; heard: Map<string, { state: string }>;
  bodies: { state: string } | null; blocksAround(x: number, y: number): number[]; arming: boolean;
};
const WORLD = 'w';
inner.info = { id: WORLD, size: 64, seed: 1, name: 'Stand-in', spawn_x: 10, spawn_y: 10, epoch: '2026-01-01T00:00:00Z' };
inner.me = { uid: 'u', name: 'Tester', x: 10.5, y: 10.5, level: 0 };
inner.uid = 'u';
inner.world = blankWorld(64, 1);
inner.hears = true;
inner.arming = false;
for (const topic of [`own:${WORLD}:u`, `said:${WORLD}`, ...inner.blocksAround(10.5, 10.5).map((b) => `land:${WORLD}:${b}`)]) {
  const ch = { state: 'joined' };
  inner.heard.set(topic, ch);
  rt.channels.push(ch);
}
inner.bodies = { state: 'joined' };
rt.channels.push(inner.bodies);
const world = island.world as unknown as { getTile(x: number, y: number): number };

check('listening, the island is not deaf', !island.deaf() && !island.cut() && island.armed());
{
  // A channel still joining (the next block's, walked into) is deaf for a round trip and not cut.
  const joining = [...inner.heard.values()][2];
  joining.state = 'joining';
  check('a channel still joining is deaf but not cut', island.deaf() && !island.cut());
  joining.state = 'joined';
}
{
  rt.cut();
  missed = [{ n: 1, x: 12, y: 10, tile: 4, data: 0, corners: null, soil: null }];
  asked.length = 0;
  check('the far end closing the socket is deaf and cut', island.deaf() && island.cut());
  const from = performance.now();
  const answered = await island.comeBack();
  const took = performance.now() - from;
  check('coming back answers', answered === true);
  check('well inside the socket\'s own backoff', took < 1000, `${Math.round(took)} ms`);
  check('with the socket opened once, by the coming back', rt.connects === 1, String(rt.connects));
  check('on the socket itself, not through the client\'s connect', rt.clientConnects === 0, String(rt.clientConnects));
  check('and every channel joined again', !island.deaf() && rt.channels.every((c) => c.state === 'joined'));
  check('the tile changed while cut is laid', world.getTile(12, 10) === 4, String(world.getTile(12, 10)));
  const joinedAt = asked.indexOf('joined');
  const firstGet = asked.findIndex((a) => a.startsWith('get:'));
  check('nothing read with GET before the channels are back', joinedAt >= 0 && firstGet > joinedAt, asked.join(' '));
  check('the settle, the history, the pack and the roster read', ['rpc:rpc_settle', 'get:tile_change', 'get:item', 'get:player'].every((a) => asked.includes(a)), asked.join(' '));
  check('and no join', !asked.includes('rpc:rpc_join') && !asked.includes('rpc:rpc_build_check'), asked.join(' '));
}
{
  // Nothing cut: a coming back reads, and opens nothing.
  asked.length = 0;
  rt.connects = 0;
  const answered = await island.comeBack();
  check('with nothing cut, a coming back reads and opens nothing', answered && rt.connects === 0 && asked.includes('rpc:rpc_settle'), asked.join(' '));
}
{
  // Cut with no network: false, inside `REJOIN_WAIT_MS`, and the socket tried again meanwhile.
  online = false;
  rt.cut();
  const from = performance.now();
  const answered = await island.comeBack();
  const took = performance.now() - from;
  check('cut with no network, a coming back says so', answered === false);
  check(`within ${REJOIN_WAIT_MS} ms`, took < REJOIN_WAIT_MS + 500, `${Math.round(took)} ms`);
  check('having tried the socket more than once', rt.connects > 1, String(rt.connects));
  online = true;
  clearTimeout(rt.backoff);
}

/* ---- The notice ------------------------------------------------------------ */
console.log('--- the notice');
{
  const kids: Array<Record<string, unknown>> = [];
  const root = { ...el(), append: (k: Record<string, unknown>) => kids.push(k) } as unknown as HTMLElement;
  let calls = 0;
  let answer: () => Promise<boolean> = async () => true;
  let cut = false;
  const stand = { deaf: () => cut, cut: () => cut, armed: () => true, comeBack: () => { calls++; return answer(); } };
  watchReturn(stand, root);
  const banner = kids[0];
  check('the notice says what it is', banner?.textContent === RECONNECTING && banner.hidden === true, String(banner?.textContent));

  // A cut mended at once: come back from, and nothing said.
  cut = true;
  answer = async () => { cut = false; return true; };
  await sleep(CUT_POLL_MS * 2 + 50);
  check(`a cut seen while in front is come back from within ${CUT_POLL_MS} ms`, calls === 1, String(calls));
  check(`and one mended inside ${CUT_QUIET_MS} ms says nothing`, banner.hidden === true);

  // A cut that takes a while: the notice after `CUT_QUIET_MS`, until it answers.
  calls = 0;
  let release: (v: boolean) => void = () => {};
  answer = () => new Promise<boolean>((done) => (release = done));
  cut = true;
  await sleep(CUT_POLL_MS + CUT_QUIET_MS + 100);
  check(`one that is not mended in ${CUT_QUIET_MS} ms puts the notice up`, banner.hidden === false && calls === 1, `${banner.hidden} ${calls}`);
  // The network back while it is under way: not lost.
  answer = async () => { cut = false; return true; };
  fire('online');
  release(false);
  await sleep(50);
  check('the network back while a coming back is under way is come back from as it ends', calls === 2, String(calls));
  check('and the notice goes once it answers', banner.hidden === true);

  // No network at all: the notice, and nothing asked until it is back.
  calls = 0;
  online = false;
  cut = true;
  fire('online');
  await sleep(CUT_POLL_MS * 2);
  check('with no network the notice is up and nothing is asked', banner.hidden === false && calls === 0, `${banner.hidden} ${calls}`);
  online = true;
  fire('online');
  await sleep(50);
  check('and the network back is come back from at once', calls === 1 && banner.hidden === true, `${calls} ${banner.hidden}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
