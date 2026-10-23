/**
 * Every door paced, and a walk held to its pace.
 *
 * Asked for: a per-player rate limit on every `rpc_*` door, one shared and
 * cheap mechanism, with budgets the browser's own calls never meet; and a
 * check in `rpc_move` over time as well as a word at a time, so a browser
 * that claims 1.3 or 1.6 times its pace in steady tenth-of-a-second steps
 * ends up no further than its pace and a small slack, while a walk at its
 * pace is never pulled.
 *
 *   * every door starts with `private.pace` under the class `pace_class`
 *     gives it, nothing is left for `pace_doors` to do, and every door is
 *     VOLATILE (a STABLE one runs read-only under PostgREST);
 *   * each class's rate is three times what the browser sends of it at
 *     most, worked out from the browser's own constants, and its burst ten
 *     seconds of it;
 *   * a class gives exactly its burst at once and then "Too many requests:
 *     wait 1 s.", gives its rate again a second later, and one class empty
 *     leaves the others alone;
 *   * a door refused does nothing: `rpc_say` over its class's budget writes
 *     no line;
 *   * nobody signed in is not counted (`rpc_name_free` is open to anon);
 *   * a walk at its pace in tenth-of-a-second steps, at the browser's one
 *     word a second with the link's lag going up and down, with a word a
 *     second late, and with three seconds of nothing, is never pulled;
 *   * 1.3 and 1.6 times its pace in tenth-of-a-second steps end at most the
 *     pace and the slack along, where the old rule let both through;
 *   * on stone slabs, 1.3 times `travel_speed` is the browser's own pace
 *     there and is let through, and 1.6 is held to 1.3;
 *   * the browser's own walk through a wood, a word every one, three and five
 *     seconds with the turns of its path since the last (`p_via`), walks to
 *     its end and is never held short, where the same words as straight
 *     lines were held at a tree and put back;
 *   * turns are held to the pace along them, and more than `walk_via_max`
 *     (the browser's `VIA_MAX`) of them in a word are refused.
 *
 * Against the database the suite leaves behind, in transactions that are
 * rolled back.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  FOG_EVERY, GATE_FOLK_EVERY, GROUND_EVERY, GUIDE_EVERY, MOBS_EVERY, RECONCILE_EVERY, SNAP_GAP, SPRINGS_EVERY, SWIRLS_EVERY,
} from '../../src/game/keep';
import { MOVE_EVERY, STAIRS_AGAIN, turnsOf, VIA_MAX } from '../../src/net/island';
import { Game } from '../../src/game/game';
import { clockSteps } from '../../src/engine/loop';
import { TILE_DEFS, TileType } from '../../src/world/tiles';

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
const kv = (out: string): Map<string, string> =>
  new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

/* ---- every door ------------------------------------------------------------------------- */

const doors = psql(`
select p.proname || '|' || l.lanname || '|' || p.provolatile::text || '|' || private.pace_class(p.proname) || '|'
    || case when l.lanname = 'sql'
            then (pg_get_functiondef(p.oid) like E'%AS $function$\\n  select private.pace(auth.uid(), '''
                  || private.pace_class(p.proname) || E''');\\n%')::text
            else (pg_get_functiondef(p.oid) ~ (E'AS \\\\$function\\\\$\\n(declare\\\\M[^\\n]*\\n([^\\n]*\\n)*?)?begin\\n'
                  || E'  perform private\\\\.pace\\\\((auth\\\\.uid\\\\(\\\\)|me), '''
                  || private.pace_class(p.proname) || E'''\\\\);\\n'))::text end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
where n.nspname = 'public' and p.proname like 'rpc\\_%' and p.prokind = 'f'
order by 1;`).split('\n').map((l) => l.split('|'));
const unpaced = doors.filter((d) => d[4] !== 'true').map((d) => d[0]);
check(`every one of the ${doors.length} doors knocks first, under its class`, doors.length > 100 && unpaced.length === 0,
  unpaced.length ? `not: ${unpaced.join(', ')}` : '');
const stable = doors.filter((d) => d[2] !== 'v').map((d) => d[0]);
check('and every door is VOLATILE, so PostgREST gives it a transaction the bucket can be written in', stable.length === 0,
  stable.join(', '));
const classes = new Map<string, number>();
for (const d of doors) classes.set(d[3], (classes.get(d[3]) ?? 0) + 1);
check('the doors by class', classes.get('move') === 1 && (classes.get('look') ?? 0) > 20 && (classes.get('act') ?? 0) > 20
  && (classes.get('deal') ?? 0) > 20 && classes.get('land') === 2, [...classes].map(([c, n]) => `${c} ${n}`).join(', '));
check('and nothing is left for `pace_doors` to put in', psql('select private.pace_doors();') === '0');

/* ---- budgets against the browser's own pace ------------------------------------------------- */

const budget = new Map(psql(`select c || '=' || private.pace_rate(c) || ',' || private.pace_burst(c)
  from unnest(array['move', 'look', 'act', 'deal', 'land']) c;`).split('\n')
  .map((l) => { const [c, v] = l.split('='); const [r, b] = v.split(',').map(Number); return [c, { rate: r, burst: b }] as const; }));
const rate = (c: string): number => budget.get(c)?.rate ?? NaN;
const burst = (c: string): number => budget.get(c)?.burst ?? NaN;

// `armBeat` never sets the beat closer than half a second.
const island = readFileSync('src/net/island.ts', 'utf8');
const BEAT_FLOOR = 0.5;
check('the beat is never armed closer than half a second, which the look budget counts on',
  island.includes(`Math.max(${BEAT_FLOOR}, seconds) * 1000`));
const moveRate = 1 / MOVE_EVERY;
// At a cellar's stairs: the word on the stairs up to STAIRS_AGAIN times, the change of storey said again, and the word itself.
const stairWords = STAIRS_AGAIN + 2;
const lookRate = 1 / MOBS_EVERY + 1 / GROUND_EVERY + 1 / BEAT_FLOOR + 1 / SPRINGS_EVERY + 3 / RECONCILE_EVERY + 1 / GUIDE_EVERY
  + 1 / FOG_EVERY + 1 / SWIRLS_EVERY + 1 / GATE_FOLK_EVERY;
check(`move: ${rate('move')} a second, three times the browser's one a MOVE_EVERY (${moveRate})`, rate('move') >= 3 * moveRate);
check(`move: ${burst('move')} at once, three times the ${stairWords} words a change of storey can take`,
  burst('move') >= 3 * stairWords);
check(`look: ${rate('look')} a second, three times every poll the browser runs at once (${lookRate.toFixed(2)})`,
  rate('look') >= 3 * lookRate);
check(`act: ${rate('act')} a second, three times a click a second`, rate('act') >= 3);
check(`deal: ${rate('deal')} a second, twice a click a second`, rate('deal') >= 2);
for (const c of budget.keys()) {
  check(`${c}: ${burst(c)} at once, ten seconds of its rate or more`, burst(c) >= 10 * rate(c));
}

/* ---- the bucket ----------------------------------------------------------------------------- */

const U = '99999999-0000-4000-8000-0000000000a1';
const bucket = kv(psql(`
begin;
create temp table said (k text, v text);
delete from caller where uid = '${U}';
do $$
declare c text; n int; v_why text; i int;
begin
  foreach c in array array['move', 'look', 'act', 'deal', 'land'] loop
    n := 0; v_why := null;
    for i in 1 .. private.pace_burst(c) + 5 loop
      begin
        perform private.pace('${U}', c);
        n := n + 1;
      exception when others then v_why := sqlerrm; exit;
      end;
    end loop;
    insert into said values (c || '.burst', n::text), (c || '.why', v_why);
    -- A second later.
    update caller set paced[private.pace_slot(c)] = paced[private.pace_slot(c)] - interval '1 second' where uid = '${U}';
    n := 0;
    for i in 1 .. private.pace_burst(c) loop
      begin
        perform private.pace('${U}', c);
        n := n + 1;
      exception when others then exit;
      end;
    end loop;
    insert into said values (c || '.later', n::text);
  end loop;
  -- Every class empty but move, and move still goes.
  update caller set paced[1] = null where uid = '${U}';
  begin
    perform private.pace('${U}', 'move');
    insert into said values ('alone', 'through');
  exception when others then insert into said values ('alone', sqlerrm);
  end;
end $$;
select k || '=' || coalesce(v, 'nothing') from said order by k;
rollback;`));
for (const c of budget.keys()) {
  check(`${c}: ${burst(c)} at once and then refused`, bucket.get(`${c}.burst`) === String(burst(c)), bucket.get(`${c}.burst`));
  check(`${c}: refused in one line`, bucket.get(`${c}.why`) === 'Too many requests: wait 1 s.', bucket.get(`${c}.why`));
  check(`${c}: a second later, ${Math.floor(rate(c))} more`, bucket.get(`${c}.later`) === String(Math.floor(rate(c))),
    bucket.get(`${c}.later`));
}
check('one class empty leaves the others alone', bucket.get('alone') === 'through', bucket.get('alone'));

/* ---- a door refused does nothing ------------------------------------------------------------ */

const W = '99999999-0000-4000-8000-0000000000f1';
const flat = (tiles: string): string => `
insert into world (id, name, seed, size, spawn_x, spawn_y, ready) values ('${W}', 'Paced', 5, 256, 128, 128, true);
insert into land_corner (world_id, y, heights, dirt)
  select '${W}', g, repeat('\\000', 257 * 2)::bytea, repeat('\\000', 257)::bytea from generate_series(0, 256) g;
insert into land_tile (world_id, y, tiles, data, rock)
  select '${W}', g, ${tiles}, repeat('\\000', 256)::bytea, repeat('\\000', 256)::bytea from generate_series(0, 255) g;
insert into player (world_id, uid, name, x, y, stats)
  values ('${W}', '${U}', 'Pacer', 10.5, 100.5, '{"health":1,"stamina":1,"hunger":1,"thirst":1}');
select set_config('request.jwt.claims', json_build_object('sub', '${U}')::text, true) \\g /dev/null
delete from caller where uid = '${U}';`;

const refused = kv(psql(`
begin;
${flat("repeat('\\000', 256)::bytea")}
create temp table said (k text, v text);
do $$
declare i int; v_from bigint;
begin
  perform rpc_say('${W}', 'one');
  insert into said values ('said', (select count(*)::text from event where world_id = '${W}' and kind = 'chat'));
  for i in 1 .. private.pace_burst('deal') loop
    begin perform private.pace('${U}', 'deal'); exception when others then exit; end;
  end loop;
  begin
    perform rpc_say('${W}', 'two');
    insert into said values ('why', 'through');
  exception when others then insert into said values ('why', sqlerrm);
  end;
  insert into said values ('after', (select count(*)::text from event where world_id = '${W}' and kind = 'chat'));
  -- Nobody signed in: rpc_name_free, three times its class's burst, all of them answered.
  perform set_config('request.jwt.claims', '', true);
  delete from private.name_free_ask;
  v_from := 0;
  -- Each from an address of its own: the door's own count is 20 a minute per client IP (\`name_free_most\`), not this.
  for i in 1 .. 3 * private.pace_burst('look') loop
    perform set_config('request.headers', json_build_object('cf-connecting-ip', '10.9.' || (i / 256) || '.' || (i % 256))::text, true);
    perform rpc_name_free('nobody in particular');
    v_from := v_from + 1;
  end loop;
  insert into said values ('anon', v_from::text);
end $$;
select k || '=' || coalesce(v, 'nothing') from said order by k;
rollback;`));
check('rpc_say over its class\'s budget: refused in one line', refused.get('why') === 'Too many requests: wait 1 s.', refused.get('why'));
check('and no line was said', refused.get('said') === '1' && refused.get('after') === '1',
  `${refused.get('said')} line before, ${refused.get('after')} after`);
check('nobody signed in is not counted: rpc_name_free answered every time', refused.get('anon') === String(3 * burst('look')),
  refused.get('anon'));

/* ---- a walk held to its pace ---------------------------------------------------------------- */

/**
 * Words to `rpc_move` along a flat row, each claiming where a browser walking at `mul` times
 * `travel_speed` would be after `t` seconds of its own clock, `gaps` the seconds the island counts
 * between one word and the next. Answers how far along the island has the body, how far was claimed,
 * and how many words it pulled.
 */
type Walk = { mul: number; gaps: number[]; client?: number[] };
const walks = (tiles: string, list: Walk[]): Array<{ got: number; claimed: number; pulls: number; pace: number; slack: number; old: number }> => {
  const out = psql(`
begin;
${flat(tiles)}
create temp table said (n int, v text);
create function pg_temp.walk(p_mul double precision, p_gaps double precision[], p_client double precision[]) returns text
  language plpgsql as $f$
declare v0 double precision; v double precision; s double precision; i int; t double precision := 0; a jsonb;
        pulls int := 0; old int := 0; x0 double precision := 10.5; claim double precision; was double precision := 10.5;
begin
  update player set body_at = now(), x = x0, y = 100.5, level = 0, walk_ahead = null where world_id = '${W}' and uid = '${U}';
  -- The pace: travel_speed, on the ground's own pace (1 on grass).
  v0 := travel_speed('${W}', '${U}');
  v := v0 * walk_ground('${W}', x0, 100.5);
  s := v * walk_slack_secs() + walk_slack_tiles();
  for i in 1 .. array_length(p_gaps, 1) loop
    t := t + p_client[i];
    claim := x0 + p_mul * v * t;
    update player set moved_at = now() - make_interval(secs => p_gaps[i]) where world_id = '${W}' and uid = '${U}';
    delete from caller where uid = '${U}';
    -- What the rule before this allowed the same word, which let the last one stand: 60% over the pace and a tile and a half.
    if claim - was > v0 * least(greatest(p_gaps[i], 0.05), 10) * 1.6 + 1.5 then old := old + 1; end if;
    was := claim;
    a := rpc_move('${W}', claim, 100.5, 0);
    if (a->>'pulled')::boolean then pulls := pulls + 1; end if;
  end loop;
  return ((a->>'x')::double precision - x0) || ',' || (claim - x0) || ',' || pulls || ',' || v || ',' || s || ',' || old;
end $f$;
${list.map((w, i) => `insert into said values (${i}, pg_temp.walk(${w.mul}, array[${w.gaps.join(',')}]::double precision[], array[${(w.client ?? w.gaps).join(',')}]::double precision[]));`).join('\n')}
select n || '=' || v from said order by n;
rollback;`);
  return [...kv(out).values()].map((v) => {
    const [got, claimed, pulls, pace, slack, old] = v.split(',').map(Number);
    return { got, claimed, pulls, pace, slack, old };
  });
};

const tenths = (secs: number): number[] => Array.from({ length: Math.round(secs * 10) }, () => 0.1);
const seconds = (n: number): number[] => Array.from({ length: n }, () => MOVE_EVERY);
// Server gaps for a word a second whose lag goes up and down by `jitter` seconds.
const jittered = (n: number, jitter: number): number[] => Array.from({ length: n }, (_, i) => MOVE_EVERY + (i % 2 ? -jitter : jitter));
// One word arriving `late` seconds late: its gap is longer by that and the next one's shorter.
const late = (n: number, at: number, by: number): number[] => seconds(n).map((g, i) => (i === at ? g + by : i === at + 1 ? g - by : g));

const grass = "repeat('\\000', 256)::bytea";
const [steady, jitter, oneLate, hole, quick, quicker] = walks(grass, [
  { mul: 1, gaps: tenths(20) },
  { mul: 1, gaps: jittered(30, 0.4), client: seconds(30) },
  { mul: 1, gaps: late(30, 10, 1), client: seconds(30) },
  { mul: 1, gaps: [...seconds(5), 3, ...seconds(5)] },
  { mul: 1.3, gaps: tenths(20) },
  { mul: 1.6, gaps: tenths(20) },
]);
const v = steady.pace;
const S = steady.slack;
check(`a walk at its pace, ${v.toFixed(3)} tiles a second, in tenth-of-a-second steps for 20 s: never pulled, and all of it`,
  steady.pulls === 0 && Math.abs(steady.got - 20 * v) < 1e-6, `${steady.pulls} pulls, ${steady.got.toFixed(3)} of ${steady.claimed.toFixed(3)}`);
check('a word a second for 30 s, the link\'s lag going up and down 0.4 s: never pulled',
  jitter.pulls === 0 && Math.abs(jitter.got - jitter.claimed) < 1e-6, `${jitter.pulls} pulls`);
check('a word a second for 30 s with one a whole second late: never pulled',
  oneLate.pulls === 0 && Math.abs(oneLate.got - oneLate.claimed) < 1e-6, `${oneLate.pulls} pulls`);
check('three seconds of nothing and then the three seconds of walking in one word: never pulled',
  hole.pulls === 0 && Math.abs(hole.got - hole.claimed) < 1e-6, `${hole.pulls} pulls`);
for (const [w, mul] of [[quick, 1.3], [quicker, 1.6]] as const) {
  check(`${mul} times its pace in tenth-of-a-second steps for 20 s: claimed ${w.claimed.toFixed(2)}, held to ${w.got.toFixed(2)}, `
    + `no further than the pace (${(20 * v).toFixed(2)}) and the slack (${S.toFixed(2)})`,
  w.got <= 20 * v + S + 1e-6 && w.got >= 20 * v - 1e-6, `${w.pulls} words pulled`);
  check(`and the rule before this pulled none of those words`, w.old === 0, `${w.old}`);
}

const slabs = `repeat('\\${TileType.Slabs.toString(8).padStart(3, '0')}', 256)::bytea`;
const ground = TILE_DEFS[TileType.Slabs].speed;
const [onSlabs, pastSlabs] = walks(slabs, [
  { mul: 1, gaps: tenths(20) },
  { mul: 1.6 / ground, gaps: tenths(20) },
]);
check(`on stone slabs the browser walks at ${ground} times travel_speed, and that is never pulled`,
  onSlabs.pulls === 0 && Math.abs(onSlabs.pace - v * ground) < 1e-6 && Math.abs(onSlabs.got - onSlabs.claimed) < 1e-6, `${onSlabs.pulls} pulls, ${onSlabs.got.toFixed(2)}`);
check(`and 1.6 times travel_speed there is held to ${ground} and the slack`,
  pastSlabs.got <= 20 * pastSlabs.pace + pastSlabs.slack + 1e-6 && pastSlabs.pulls > 0,
  `${pastSlabs.got.toFixed(2)} of ${pastSlabs.claimed.toFixed(2)}, against ${(20 * pastSlabs.pace).toFixed(2)} and ${pastSlabs.slack.toFixed(2)}`);

/* ---- a long walk through a wood ------------------------------------------------------------- */

/*
 * Reported: "pathfinding on longer/more complicated routes, especially while zoomed out, tends to move me part
 * of the way there then rubber band back ... and then cancels the movement." The island walked each word as a
 * straight line from where it last had the body (`walk_share`), and a straight line across a bend in a path
 * through a wood goes through the trees the path went round: held at the first tree, and every word after it
 * measured from there, until the browser was further off than `SNAP_GAP` and was put back and stopped. A word
 * a second at a walk is under a tile and seldom cuts a tree; but a word waits for the answer to the one before
 * (`tellWhere`, up to `MOVE_LOST`), so a slow round trip -- a busy island, a poor link, a page whose frames are
 * a fifth of a second apart zoomed out -- makes the words seconds apart, and five seconds apart they cut trees.
 *
 * The browser's own walk, by its own pathfinder, through the same wood here and there: 80 tiles on a side, a
 * third of it trees, round its edge a ring of them. Walked on frames a quarter of a second apart, told every
 * one, three and five seconds; each word as the browser said it before (where it is) and now (and the turns of
 * the path since the last, `turnsOf`).
 */
const X0 = 10;
const Y0 = 60;
const SIDE = 80;
const woodGame = Game.create(4242);
{
  const w = woodGame.world;
  let seed = 7;
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let y = Y0; y <= Y0 + SIDE; y++) for (let x = X0; x <= X0 + SIDE; x++) w.setHeight(x, y, 60);
  for (let y = Y0; y < Y0 + SIDE; y++) {
    for (let x = X0; x < X0 + SIDE; x++) {
      const edge = x === X0 || y === Y0 || x === X0 + SIDE - 1 || y === Y0 + SIDE - 1;
      const clear = (x < X0 + 5 && y < Y0 + 5) || (x > X0 + SIDE - 6 && y > Y0 + SIDE - 6);
      w.setTile(x, y, edge || (!clear && rnd() < 0.33) ? TileType.Tree : TileType.Grass, 0);
    }
  }
  for (const c of [...woodGame.creatures.list.values()]) woodGame.creatures.remove(c.id);
}
type Word = { x: number; y: number; via: number[][] };
const woodWalk = (every: number): { words: Word[]; plain: Word[]; tiles: number } => {
  const g = woodGame;
  g.putBody(X0 + 2.5, Y0 + 2.5, 0);
  g.player.stats.stamina = 1;
  if (!g.moveTo(X0 + SIDE - 3, Y0 + SIDE - 3)) throw new Error('no way through the wood');
  const tiles = g.player.path?.length ?? 0;
  const words: Word[] = [];
  let told = { x: g.player.x, y: g.player.y };
  let since = 0;
  for (let i = 0; i < 4000 && (g.player.path || since > 0); i++) {
    for (const step of clockSteps(0.25)) g.update(step);
    since += 0.25;
    if (since >= every - 1e-9 || !g.player.path) {
      since = 0;
      const at = { x: g.player.x, y: g.player.y };
      words.push({ ...at, via: turnsOf(told, g.player.takeTurns(), at).map((p) => [p.x, p.y]) });
      told = at;
    }
  }
  return { words, plain: words.map((w) => ({ ...w, via: [] })), tiles };
};
const rowsOf = (): string => {
  const rows: string[] = [];
  for (let y = 0; y < 256; y++) {
    const b = Buffer.alloc(256, TileType.Grass);
    if (y >= Y0 && y < Y0 + SIDE) for (let x = X0; x < X0 + SIDE; x++) b[x] = woodGame.world.getTile(x, y);
    rows.push(`decode('${b.toString('hex')}', 'hex')`);
  }
  return `(array[${rows.join(',')}])[g + 1]`;
};
/** Each walk's words to `rpc_move`, `every` seconds apart by the island's clock: how many held short, how far behind at most, and the first word put back. */
const replay = (walks: Array<{ every: number; words: Word[] }>): Array<{ short: number; blocked: number; behind: number; back: number; end: number }> => {
  const out = psql(`
begin;
${flat(rowsOf())}
update player set body_at = now(), x = ${X0 + 2.5}, y = ${Y0 + 2.5}, level = 0 where world_id = '${W}' and uid = '${U}';
create temp table said (n int, v text);
create function pg_temp.walk(p_every double precision, p_words jsonb) returns text language plpgsql as $f$
declare w jsonb; a jsonb; short int := 0; blocked int := 0; behind double precision := 0; back int := 0; i int := 0; d double precision;
begin
  update player set body_at = now(), x = ${X0 + 2.5}, y = ${Y0 + 2.5}, level = 0, walk_ahead = null where world_id = '${W}' and uid = '${U}';
  for w in select * from jsonb_array_elements(p_words) loop
    i := i + 1;
    update player set moved_at = now() - make_interval(secs => p_every) where world_id = '${W}' and uid = '${U}';
    delete from caller where uid = '${U}';
    a := rpc_move('${W}', (w->>'x')::double precision, (w->>'y')::double precision, 0,
                  case when jsonb_array_length(w->'via') > 0 then w->'via' end);
    d := sqrt(power((a->>'x')::double precision - (w->>'x')::double precision, 2) + power((a->>'y')::double precision - (w->>'y')::double precision, 2));
    if d > 1e-6 then short := short + 1; end if;
    if (a->>'blocked')::boolean then blocked := blocked + 1; end if;
    behind := greatest(behind, d);
    if d > ${SNAP_GAP} and back = 0 then back := i; end if;
  end loop;
  return short || ',' || blocked || ',' || behind || ',' || back || ',' || d;
end $f$;
${walks.map((w, i) => `insert into said values (${i}, pg_temp.walk(${w.every}, '${JSON.stringify(w.words)}'::jsonb));`).join('\n')}
select n || '=' || v from said order by n;
rollback;`);
  return [...kv(out).values()].map((v) => {
    const [short, blocked, behind, back, end] = v.split(',').map(Number);
    return { short, blocked, behind, back, end };
  });
};
const woodWalks = [1, 3, 5].map((every) => ({ every, ...woodWalk(every) }));
const woodSaid = replay([...woodWalks.map((w) => ({ every: w.every, words: w.plain })), ...woodWalks.map((w) => ({ every: w.every, words: w.words }))]);
for (const [i, w] of woodWalks.entries()) {
  const before = woodSaid[i];
  const now = woodSaid[woodWalks.length + i];
  const turns = w.words.reduce((n, x) => n + x.via.length, 0);
  const straight = `as straight lines ${before.blocked} of ${w.words.length} words blocked, ${before.behind.toFixed(2)} tiles behind at most`
    + `${before.back ? `, put back at word ${before.back}` : ''}`;
  check(`through the wood (${w.tiles} steps), a word every ${w.every} s with ${turns} turns between them: walked to its end, never held short`,
    now.short === 0 && now.blocked === 0 && now.end < 1e-6,
    `${now.short} held short, ${now.blocked} blocked, ${now.behind.toFixed(2)} tiles behind at most; ${straight}`);
  if (w.every === 5) {
    check('and as straight lines from the last word, as it was walked before: held at a tree and put back',
      before.blocked > 0 && before.back > 0, straight);
  }
}

/*
 * And the turns are no way round the pace: a word whose turns go further than the pace allows is held to the
 * pace along them, and more than `VIA_MAX` of them is refused.
 */
const viaPace = kv(psql(`
begin;
${flat(grass)}
create temp table said (k text, v text);
do $$
declare a jsonb; v double precision; v_why text;
begin
  update player set x = 10.5, y = 100.5, level = 0, walk_ahead = null, moved_at = now() - interval '1 second'
   where world_id = '${W}' and uid = '${U}';
  v := travel_speed('${W}', '${U}');
  -- Ten tiles east and ten back, in one second: where it ends is where it began, the walk is twenty tiles.
  a := rpc_move('${W}', 10.5, 100.5, 0, '[[20.5, 100.5]]'::jsonb);
  insert into said values ('x', a->>'x'), ('pulled', a->>'pulled'), ('room', (v * 1.6 + 1.5)::text), ('max', walk_via_max()::text);
  delete from caller where uid = '${U}';
  begin
    perform rpc_move('${W}', 11.5, 100.5, 0, (select jsonb_agg(jsonb_build_array(10.5 + g * 0.01, 100.5)) from generate_series(1, ${VIA_MAX + 1}) g));
    insert into said values ('many', 'through');
  exception when others then insert into said values ('many', sqlerrm);
  end;
end $$;
select k || '=' || coalesce(v, 'nothing') from said order by k;
rollback;`));
check('ten tiles out and ten back in a second: held to the pace along the turns, not let off as no distance at all',
  viaPace.get('pulled') === 'true' && Math.abs(Number(viaPace.get('x')) - (10.5 + Number(viaPace.get('room')))) < 1e-6,
  `at ${viaPace.get('x')}, ${viaPace.get('room')} tiles of room`);
check(`the island takes the browser's ${VIA_MAX} turns a word`, viaPace.get('max') === String(VIA_MAX), viaPace.get('max'));
check(`more than ${VIA_MAX} turns in a word: refused`, viaPace.get('many') !== 'through', viaPace.get('many'));

for (const l of [...ok, ...bad]) console.log(l);
console.log(bad.length ? `\n${bad.length} wrong` : '\nall as they should be');
process.exit(bad.length ? 1 : 0);
