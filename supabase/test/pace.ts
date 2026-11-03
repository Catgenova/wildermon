/**
 * Nobody on the move is pulled back for going as fast as they can go.
 *
 * Reported as players rubberbanding when they move quickly, which was three
 * things, two of them in how other people are drawn.
 *
 * Your own body: `rpc_move` lets a body go as far as `travel_speed` allows in
 * the time since its last word, half again and a little over, and pulls it
 * back to that; a browser the island puts more than `SNAP_GAP` from where it
 * thinks it is jumps there. A hull was allowed her build's pace and sailed at
 * `hullSpeed` -- her build, the hands at her helm, her quality and, under
 * sail, the weather -- which for a fine ship on a reach in a gale is two and a
 * half times that. The island has no weather of its own, so it now allows her
 * the best the weather ever gives and everything else as it is.
 *
 * Everybody else: a word over the channel from anybody was laid as a word
 * about everybody, so everybody halfway along a walk was jumped to the end of
 * it at every word from anybody moving; and the rows read back from
 * the island, up to a second behind the channel, were laid over what it had
 * said, pulling everybody on the move back to where they had been.
 */
import { execFileSync } from 'node:child_process';
import { furnitureDef } from '../../src/game/furniture';
import { hullSpeed } from '../../src/game/game';
import { Roster, WALK_SLACK, walkSpan } from '../../src/game/roster';
import { BODY_EVERY } from '../../src/game/keep';
import { SAILING, sailingPace } from '../../src/game/travel';
import { WEATHER_MOST } from '../../src/game/wind';
import type { PeerState } from '../../src/net/protocol';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
    input: sql,
    encoding: 'utf8',
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` -- ${detail}` : ''}`);
};
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(b));

/* ---- The island holds a hull to the most she can make -------------------- */

const CONTROL = 90;
const STRENGTH = 70;
// And the helm's own Sailing, which both sides put on the hull's pace (`sailingPace`).
const SAILED_AT = 60;
const said = new Map(psql(`
begin;
create temp table said (k text, v text);
do $b$
declare w uuid; me uuid; v_boat bigint;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Crowd2';
  update placed set driver = null where world_id = w and driver = me;
  insert into skill (world_id, uid, id, value) values (w, me, 'body_control', ${CONTROL}), (w, me, 'body_strength', ${STRENGTH}),
      (w, me, '${SAILING}', ${SAILED_AT})
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'caravel', 40, 40, 0, 0, 40.5, 40.5, 95, me) returning id into v_boat;
  update placed set driver = me where id = v_boat;
  insert into said values ('caravel', travel_speed(w, me)::text);
  update placed set sub = 'rowing_boat', ql = 60 where id = v_boat;
  insert into said values ('rowing', travel_speed(w, me)::text);
  insert into said values ('weather', weather_most()::text);
end $b$;
select string_agg(k || '=' || v, E'\\n' order by k) from said;
rollback;`).split('\n').map((l) => [l.slice(0, l.indexOf('=')), Number(l.slice(l.indexOf('=') + 1))] as const));

check('the island takes the weather at its best as the browser does', near(said.get('weather') ?? NaN, WEATHER_MOST),
  `${said.get('weather')} against ${WEATHER_MOST}`);
const caravel = furnitureDef('caravel').boat;
const rower = furnitureDef('rowing_boat').boat;
const sailed = caravel ? hullSpeed(caravel, 95, CONTROL, WEATHER_MOST, 0) * sailingPace(SAILED_AT) : NaN;
const rowed = rower ? hullSpeed(rower, 60, STRENGTH, 1, 0) * sailingPace(SAILED_AT) : NaN;
check(`a caravel of 95 under a helm of ${CONTROL} body control and ${SAILED_AT} sailing is allowed what she makes on a reach in a gale`,
  near(said.get('caravel') ?? NaN, sailed), `${said.get('caravel')} tiles a second, and she makes ${sailed.toFixed(3)}`);
check(`which is past what her build's pace used to allow her in a second, and would have been pulled back`,
  sailed > (caravel?.speed ?? 0) * 1.6 + 1.5, `${sailed.toFixed(2)} against ${((caravel?.speed ?? 0) * 1.6 + 1.5).toFixed(2)}`);
check(`a rowing boat of 60 pulled by ${STRENGTH} body strength and ${SAILED_AT} sailing is allowed what she makes at the oars`,
  near(said.get('rowing') ?? NaN, rowed), `${said.get('rowing')} against ${rowed.toFixed(3)}`);

/* ---- Other people are drawn walking on, not jumped about ------------------ */

let now = 1000;
Object.defineProperty(globalThis.performance, 'now', { value: () => now * 1000, configurable: true, writable: true });
const peer = (x: number): PeerState => ({ id: 7, name: 'Quick', x, y: 0, dirX: 1, dirY: 0, level: 0, moving: true, swimming: false, working: false });
const roster = new Roster();
const drawn = (): number => roster.get(7)?.fromX ?? NaN;
roster.saw(peer(0));
now += BODY_EVERY;
roster.saw(peer(1));
const span = walkSpan(BODY_EVERY);
now += span / 2;
roster.ease(span / 2);
const half = drawn();
// Somebody else moved, and everybody's last word was laid again with theirs.
roster.saw(peer(1));
const after = drawn();
check('told again where somebody already is, they walk on from where they had got to', near(half, 0.5) && near(after, half),
  `halfway at ${half.toFixed(2)}, then ${after.toFixed(2)}`);
now += span / 2;
roster.ease(span / 2);
check('and arrive where they were going when they would have', near(drawn(), 1), `${drawn()}`);

/*
 * Twice a second (`BODY_EVERY`), a word apart on a link that is a little late
 * now and then: walked at one pace, never stood still between words, never
 * walked backwards, and never more than a word and a half behind.
 */
{
  const r = new Roster();
  const at = (): number => r.get(8)?.fromX ?? NaN;
  const PACE = 4;
  const fast = (x: number): PeerState => ({ ...peer(x), id: 8 });
  let x = 0;
  r.saw(fast(x));
  let next = now + BODY_EVERY;
  let stopped = 0;
  let back = 0;
  let behind = 0;
  let was = at();
  const FRAME = 1 / 60;
  for (let f = 0; f < 60 * 10; f++) {
    now += FRAME;
    x += PACE * FRAME;
    if (now >= next) {
      r.saw(fast(x));
      // Every fourth word a fifth of a send late on the wire.
      next = now + BODY_EVERY * (f % 4 === 0 ? 1.2 : 1);
    }
    r.ease(FRAME);
    const d = at();
    if (f > 60) {
      if (d - was < 1e-9) stopped += 1;
      if (d < was - 1e-9) back += 1;
      behind = Math.max(behind, x - d);
    }
    was = d;
  }
  check(`walking ${PACE} tiles a second, told every ${BODY_EVERY} s: drawn moving every frame`, stopped === 0, `${stopped} frames stood still`);
  check('and never drawn going backwards', back === 0, `${back} frames back`);
  check('and never more than a word and a half behind', behind <= PACE * BODY_EVERY * 1.5 * WALK_SLACK, `${behind.toFixed(2)} tiles behind`);
  // Stopped: the last word is walked to, and they stand on it.
  r.saw(fast(x));
  now += 2;
  r.ease(2);
  check('and when they stop, drawn standing on their last word', near(at(), x), `${at()} against ${x}`);
  // A rune gate: a jump, not a walk.
  r.saw(fast(x + 200));
  r.ease(FRAME);
  check('somebody gone through a rune gate is drawn there at once', near(at(), x + 200), `${at()}`);
  // A word lost on the way at a gallop is walked over, not jumped.
  r.saw(fast(x + 200 + 2 * 5 * BODY_EVERY));
  r.ease(FRAME);
  check('a word lost at a gallop is walked over, not jumped', at() < x + 200 + 1, `${at()}`);
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(bad.length ? `\n${bad.length} wrong` : '\nall as they should be');
process.exit(bad.length ? 1 : 0);
