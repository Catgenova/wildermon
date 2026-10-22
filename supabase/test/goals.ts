/**
 * Goals done show as done, once the island's record of them has come.
 *
 * Reported: "completed goals don't show sometimes", and lately almost always;
 * then, from the player and the island's keeper: goals done never show now,
 * not after logging in and refreshing either, where they used to appear a
 * minute or so after coming ashore.
 *
 * The record is the island's (`player.ticked`), handed to the browser on the
 * first beat (`rpc_settle` with `p_book`), up to `HEARTBEAT` seconds after
 * coming ashore. The Goals page was drawn when the journal was built, when its
 * window opened and when a goal was ticked here -- and not when the record
 * landed, nor when its tab was turned to. The journal opens by itself at What's
 * new on coming ashore whenever the site has news this browser has not shown,
 * which lately is nearly every time; so the page was drawn with nothing done,
 * a minute before the record came, and turning to Goals showed that drawing.
 *
 * The browser: the record landing redraws the page, a tab turned to Goals is
 * drawn as it stands, neither says a line or rings the goal chime, and a beat
 * the island refused keeps its ticks for the next one.
 *
 * The island: a tick handed over on a beat is kept, and the first beat of a
 * fresh page hands every tick back.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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

/* ---- a page to draw on --------------------------------------------------- */

/** As much of the DOM as the journal's panels touch, and no more. */
class FakeEl {
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  attrs = new Map<string, string>();
  private classes = new Set<string>();
  private own = '';
  hidden = false;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  value = '';
  constructor(readonly tagName: string) {}
  get className(): string {
    return [...this.classes].join(' ');
  }
  set className(v: string) {
    this.classes = new Set(v.split(/\s+/).filter(Boolean));
  }
  readonly classList = {
    add: (...c: string[]): void => c.forEach((x) => this.classes.add(x)),
    remove: (...c: string[]): void => c.forEach((x) => this.classes.delete(x)),
    contains: (c: string): boolean => this.classes.has(c),
    toggle: (c: string, on?: boolean): boolean => {
      const want = on ?? !this.classes.has(c);
      if (want) this.classes.add(c);
      else this.classes.delete(c);
      return want;
    },
  };
  get textContent(): string {
    return this.own + this.children.map((c) => c.textContent).join('');
  }
  set textContent(v: string) {
    this.children = [];
    this.own = v;
  }
  get firstElementChild(): FakeEl | null {
    return this.children[0] ?? null;
  }
  append(...nodes: Array<FakeEl | string>): void {
    for (const n of nodes) {
      const el = typeof n === 'string' ? Object.assign(new FakeEl('#text'), { own: n }) : n;
      el.parent = this;
      this.children.push(el);
    }
  }
  replaceChildren(...nodes: Array<FakeEl | string>): void {
    this.children = [];
    this.own = '';
    this.append(...nodes);
  }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  querySelectorAll(): FakeEl[] {
    return [];
  }
  querySelector(): FakeEl | null {
    return null;
  }
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
  }
}
const stored = new Map<string, string>();
Object.assign(globalThis, {
  document: { createElement: (tag: string) => new FakeEl(tag) },
  localStorage: {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, String(v)),
    removeItem: (k: string) => void stored.delete(k),
  },
});

const { Game } = await import('../../src/game/game');
const { ALL_GOALS } = await import('../../src/game/journal');
const { JournalPanel } = await import('../../src/ui/panels/journal');

/* ---- the browser --------------------------------------------------------- */

const game = Game.create(4242);
// As an island game starts (`startIsland`): nothing read until the island has sent its record.
game.journalReady = false;
const said: string[] = [];
let chimes = 0;
let redraws = 0;
game.events.on('log', (e) => said.push(e.text));
game.events.on('journal', () => chimes++);
game.events.on('goals', () => redraws++);

const body = new FakeEl('div');
const win = {
  body, isOpen: false, onOpen: null as null | (() => void),
  open(): void {
    this.isOpen = true;
    this.onOpen?.();
  },
  close(): void {
    this.isOpen = false;
  },
};
const panel = new JournalPanel(win as never, game);
// Coming ashore with news this browser has not shown: the journal opens at What's new (`UI`).
panel.open('news');

/** Every goal row on the Goals page, by its words, with its tick. */
const rows = (): Map<string, string> => {
  const goals = body.children.find((c) => c.className.includes('skills-body'));
  const out = new Map<string, string>();
  for (const row of goals?.children ?? []) {
    if (!row.className.includes('goal-row')) continue;
    out.set(row.children[1].textContent, row.children[0].textContent);
  }
  return out;
};
const ticks = (): number => [...rows().values()].filter((t) => t === '✔').length;
const counted = (): string => body.children.find((c) => c.className.includes('skills-body'))?.children[0]?.children[0]?.textContent ?? '';

check('before the record: nothing drawn as done', ticks() === 0, `${ticks()}`);

// The first beat, up to a heartbeat later, with the island's record of what is done (`hooks.mine`).
const DONE = ['tree', 'plank', 'fire'];
game.heardTicked(DONE);
check('the record is read: the goals are done here', DONE.every((id) => game.ticked.has(id)) && game.journalReady, [...game.ticked].join(','));
check('the record landing redraws the Goals page while another tab shows', ticks() === DONE.length && counted().startsWith(`${DONE.length}/${ALL_GOALS.length}`),
  `${ticks()} ticked, "${counted()}"`);
panel.show('goals');
check('and turning to Goals shows them done', ticks() === DONE.length, `${ticks()} of ${DONE.length}`);
check('the record is not news: no line and no goal chime', said.length === 0 && chimes === 0, `${said.length} lines, ${chimes} chimes`);

// Every later beat that carries the record (whenever a count moved) changes nothing that is drawn.
const before = redraws;
game.heardTicked(DONE);
check('the same record again redraws nothing', redraws === before, `${redraws - before}`);
game.heardTicked([...DONE, 'ore']);
check('a record holding one more draws that one', redraws === before + 1 && ticks() === DONE.length + 1, `${ticks()}`);

// A tab turned to after a goal was ticked with the page out of sight is drawn as it stands.
panel.show('ledger');
game.ticked.add('cook');
panel.show('goals');
check('a tab turned to Goals is drawn as the journal stands', ticks() === DONE.length + 2, `${ticks()}`);

// The way `startIsland` reads the record is this one.
const play = readFileSync('src/net/play.ts', 'utf8');
check('the beat\'s record goes through heardTicked', /if \(what\.ticked\) game\.heardTicked\(what\.ticked\);/.test(play));

// A beat the island refused (`{ error }`, not a throw) kept nothing, so its ticks go on the next one.
const island = readFileSync('src/net/island.ts', 'utf8');
check('a refused beat keeps its ticks for the next', /if \(ticking && !error\) this\.ticked = this\.ticked\.slice\(ticking\.length\);/.test(island));

/* ---- the island ---------------------------------------------------------- */

const MERI = 'fa70e000-0000-4000-8000-0000000000b7';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MERI}'; r jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Goals', 261, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Meri');
  -- The first beat of a page, and then a beat handing over three ticks.
  perform rpc_settle(p_world => w, p_book => true);
  r := rpc_settle(p_world => w, p_ticked => '["tree","plank","fire"]'::jsonb);
  insert into said values ('TICKED_BEAT', coalesce(r->'ticked', 'null'::jsonb)::text);
  insert into said values ('KEPT', (select ticked::text from player where world_id = w and uid = u));
  -- A quiet beat after it says nothing of them, and a fresh page's first beat says them all.
  r := rpc_settle(p_world => w);
  insert into said values ('QUIET', coalesce(r->'ticked', 'null'::jsonb)::text);
  r := rpc_settle(p_world => w, p_book => true);
  insert into said values ('FRESH', coalesce(r->'ticked', 'null'::jsonb)::text);
  -- The same ticks again change nothing.
  r := rpc_settle(p_world => w, p_ticked => '["tree"]'::jsonb);
  insert into said values ('AGAIN', (select jsonb_array_length(ticked)::text from player where world_id = w and uid = u));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const ids = (k: string): string[] => {
  try {
    const v = JSON.parse(isle.get(k) ?? 'null') as unknown;
    return Array.isArray(v) ? (v as string[]).slice().sort() : [];
  } catch {
    return [];
  }
};
check('a tick handed over on a beat is kept', ids('KEPT').join() === 'fire,plank,tree', isle.get('KEPT') ?? '');
check('and the beat that took it says the record back', ids('TICKED_BEAT').join() === 'fire,plank,tree', isle.get('TICKED_BEAT') ?? '');
check('a quiet beat leaves it out', isle.get('QUIET') === 'null', isle.get('QUIET') ?? '');
check('a fresh page\'s first beat hands every tick back', ids('FRESH').join() === 'fire,plank,tree', isle.get('FRESH') ?? '');
check('a tick handed over twice is kept once', isle.get('AGAIN') === '3', isle.get('AGAIN') ?? '');

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\ngoals done show as done — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
