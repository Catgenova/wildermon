/**
 * The safe ring round the spawn and every Runestone (`SAFE_RING`, the island's `safe_ring`).
 *
 * What this asks:
 *
 *   * both sides measure the ring the same: `inSafeRing` and the island's `safe_ring_on` agree on every point asked,
 *     just inside and just outside each ring point on three sizes of world, and on scattered ones; `in_safe_ring` on
 *     the island under test agrees with `inSafeRing` off its own size and spawn; and they keep out the same kinds
 *     (`ringKeepsOut`, `ring_keeps_out`);
 *   * stocking: a roll of the wild inside the ring is never a kind it keeps out, where one outside can be, and a block
 *     stocked over the spawn's ring puts none of them out inside it, and can outside it;
 *   * hunting: a hunter does not start on somebody inside the ring (round a stone and round the spawn), nor while it
 *     stands in it, where one outside does; a hunt of its own that comes into the ring lets go, turns for home and
 *     rests; a fight somebody started by striking runs on there.
 *
 * Deterministic: `setseed` first, and the whole island half rolled back. Runs against the database the suite leaves
 * behind.
 */
import { execFileSync } from 'node:child_process';
// `game` first: the root of the module graph, so nothing below comes out half-built.
import '../../src/game/game';
import { ringKeepsOut, SPECIES } from '../../src/game/creatures';
import { inSafeRing, SAFE_RING, safeRingPoints } from '../../src/game/runestones';

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

/* ---- The same ring, the same kinds -------------------------------------------------------------- */

check('both sides have the same ring', SAFE_RING === Number(psql('select safe_ring()')), `${SAFE_RING} here, ${psql('select safe_ring()')} there`);
check('and the beach\'s old name is the same number', SAFE_RING === Number(psql('select peace_reach()')), psql('select peace_reach()'));

// Points on worlds of three sizes: either side of every ring point's edge in eight directions, and a scatter.
let seed = 7;
const rand = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const asked: Array<[number, number, number, number, number]> = [];
for (const [size, sx, sy] of [[4096, 2048, 2048], [1024, 512, 512], [64, 32, 32], [4096, 300, 3900]] as const) {
  for (const p of safeRingPoints(size, sx, sy)) {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + 0.1;
      for (const r of [SAFE_RING - 0.01, SAFE_RING + 0.01, SAFE_RING / 2]) asked.push([size, sx, sy, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r]);
    }
  }
  for (let i = 0; i < 400; i++) asked.push([size, sx, sy, rand() * size, rand() * size]);
}
const theirs = psql(`select string_agg(safe_ring_on(s, a, b, x, y)::text, ',' order by i) from (values ${
  asked.map(([s, a, b, x, y], i) => `(${i}, ${s}, ${a}, ${b}, ${x}::double precision, ${y}::double precision)`).join(', ')}) v(i, s, a, b, x, y)`).split(',');
const differ = asked.filter(([s, a, b, x, y], i) => inSafeRing(s, a, b, x, y) !== (theirs[i] === 'true'));
const inside = asked.filter(([s, a, b, x, y]) => inSafeRing(s, a, b, x, y)).length;
check(`the browser's ring and the island's agree on all ${asked.length} points asked`, !differ.length && theirs.length === asked.length,
  differ.slice(0, 3).map((d) => d.join(',')).join('; '));
check('and the points asked fall both sides of it', inside > 100 && asked.length - inside > 100, `${inside} inside, ${asked.length - inside} outside`);
const centres = psql(`select string_agg(x + 0.5 || ',' || y + 0.5, ';' order by ord) from runestone_centres(4096)`);
check('and the island measures from the stones its own `runestone_centres` puts down',
  centres === safeRingPoints(4096, 2048, 2048).slice(1).map((p) => `${p.x},${p.y}`).join(';'), centres);
check('a test\'s world of 64 has the spawn\'s ring and no stone\'s', safeRingPoints(64, 32, 32).length === 1);

const keptHere = Object.values(SPECIES).filter(ringKeepsOut).map((d) => d.id).sort();
const keptThere = psql('select string_agg(id, \',\' order by id) from species_def where ring_keeps_out(id)').split(',');
check('both sides keep the same kinds out of the ring: every monster, hunter and aggressive kind',
  keptHere.join(',') === keptThere.join(','), `${keptHere.join(',')} here, ${keptThere.join(',')} there`);
check('which takes in a kind of the open wild as well as the monsters', keptHere.some((id) => !SPECIES[id].monster) && keptHere.some((id) => SPECIES[id].monster),
  keptHere.join(', '));

/* ---- The island ---------------------------------------------------------------------------------- */

const out = psql(`
begin;
select setseed(0.4242);
create temp table said (k text, v text);
do $b$
declare w record; s record; v_x double precision; v_y double precision; i int; n int; got text; g int; v_far double precision;
        v_in int := 0; v_in_bad int := 0; v_out int := 0; v_out_bad int := 0; v_bx int; v_by int; tx int; ty int; c creature;
        v_pts text := '';
begin
  -- The biggest island with land, which the stones stand on.
  select p.world_id, p.uid, wd.size, wd.spawn_x, wd.spawn_y into w
    from player p join world wd on wd.id = p.world_id
   where exists (select 1 from land_tile t where t.world_id = wd.id)
   order by wd.size desc, p.world_id, p.uid limit 1;
  select * into s from runestone_centres(w.size) where id = 'crownstone';
  insert into said values ('WORLD', w.size || ',' || w.spawn_x || ',' || w.spawn_y || ',' || s.x || ',' || s.y);
  -- Everybody else a long way off, so the one nearest a hunter is the one put there.
  update player set x = 5.5, y = 5.5 where world_id = w.world_id and uid <> w.uid;
  update creature set hunting = null where world_id = w.world_id and hunting = w.uid;

  -- The island's ring on this island, at points either side of the crownstone's edge and the spawn's.
  for i in 0 .. 15 loop
    v_far := case when i % 2 = 0 then safe_ring() - 0.05 else safe_ring() + 0.05 end;
    v_x := s.x + 0.5 + cos(i * 0.4) * v_far; v_y := s.y + 0.5 + sin(i * 0.4) * v_far;
    v_pts := v_pts || v_x || ',' || v_y || ',' || in_safe_ring(w.world_id, v_x, v_y) || ';';
    v_x := w.spawn_x + 0.5 + cos(i * 0.4) * v_far; v_y := w.spawn_y + 0.5 + sin(i * 0.4) * v_far;
    v_pts := v_pts || v_x || ',' || v_y || ',' || at_peace(w.world_id, v_x, v_y) || ';';
  end loop;
  insert into said values ('POINTS', v_pts);

  -- ---- Stocking -------------------------------------------------------------------------------------------------
  -- The roll, three thousand times inside the crownstone's ring and three thousand a hundred tiles north of it.
  for i in 1 .. 3000 loop
    v_far := (safe_ring() - 1) * sqrt(random()); v_x := random() * 2 * pi();
    got := pick_wild(w.world_id, floor(s.x + 0.5 + cos(v_x) * v_far)::int, floor(s.y + 0.5 + sin(v_x) * v_far)::int);
    if got is not null then v_in := v_in + 1; if ring_keeps_out(got) then v_in_bad := v_in_bad + 1; end if; end if;
    got := pick_wild(w.world_id, s.x - 30 + floor(random() * 60)::int, s.y - 130 + floor(random() * 60)::int);
    if got is not null then v_out := v_out + 1; if ring_keeps_out(got) then v_out_bad := v_out_bad + 1; end if; end if;
  end loop;
  insert into said values ('ROLL', v_in || ',' || v_in_bad || ',' || v_out || ',' || v_out_bad);

  -- The block the spawn stands in, stocked afresh twenty times over: the island under test has land round its spawn,
  -- and a quarter of the spawn's ring lies in it.
  v_bx := floor(w.spawn_x / stock_block())::int; v_by := floor(w.spawn_y / stock_block())::int;
  v_in := 0; v_in_bad := 0; v_out := 0; v_out_bad := 0;
  for i in 1 .. 20 loop
    delete from creature where world_id = w.world_id and mode = 'wild'
      and to_x >= v_bx * stock_block() and to_x < (v_bx + 1) * stock_block()
      and to_y >= v_by * stock_block() and to_y < (v_by + 1) * stock_block();
    delete from world_stocked where world_id = w.world_id and bx = v_bx and by = v_by;
    perform creature_stock_block(w.world_id, v_bx, v_by);
    for c in select * from creature where world_id = w.world_id and mode = 'wild'
      and to_x >= v_bx * stock_block() and to_x < (v_bx + 1) * stock_block()
      and to_y >= v_by * stock_block() and to_y < (v_by + 1) * stock_block() loop
      if in_safe_ring(w.world_id, c.to_x, c.to_y) then
        v_in := v_in + 1; if ring_keeps_out(c.species) then v_in_bad := v_in_bad + 1; end if;
      else
        v_out := v_out + 1; if ring_keeps_out(c.species) then v_out_bad := v_out_bad + 1; end if;
      end if;
    end loop;
  end loop;
  insert into said values ('BLOCK', v_in || ',' || v_in_bad || ',' || v_out || ',' || v_out_bad);
  delete from creature where world_id = w.world_id and mode = 'wild'
    and to_x >= v_bx * stock_block() and to_x < (v_bx + 1) * stock_block()
    and to_y >= v_by * stock_block() and to_y < (v_by + 1) * stock_block();

  -- ---- Hunting ---------------------------------------------------------------------------------------------------
  -- Grass at one height round each place a hunter is put, so the ground says nothing.
  for v_x, v_y in values (s.x + 0.5 + 30, s.y + 0.5), (s.x + 0.5 + 58, s.y + 0.5), (s.x + 0.5, s.y + 0.5 - 100),
                         (w.spawn_x + 0.5 + 30, w.spawn_y + 0.5) loop
    for tx in floor(v_x)::int - 8 .. floor(v_x)::int + 8 loop
      for ty in floor(v_y)::int - 8 .. floor(v_y)::int + 8 loop
        perform land_set_height(w.world_id, tx, ty, 4); perform land_set_dirt(w.world_id, tx, ty, 5);
        perform land_set_tile(w.world_id, tx, ty, tile_id('Grass'));
      end loop;
    end loop;
  end loop;
  update player set act = null, act_target = null, act_ends = null, act_left = null, act_goes = null,
         act_queue = '[]'::jsonb, equipped = '{}'::jsonb, level = 0, wounds = '[]'::jsonb, away = false, blessings = '{}'::jsonb,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1, 'aegis', 1000)
    where world_id = w.world_id and uid = w.uid;

  -- One goblin three tiles east of a body, at each of: inside the crownstone's ring; outside every ring; the body
  -- outside and the goblin inside; the body inside and the goblin outside; inside the spawn's ring, past the old beach.
  for v_x, v_y, v_far, n in values (s.x + 0.5 + 30, s.y + 0.5, 3.0, 1), (s.x + 0.5, s.y + 0.5 - 100, 3.0, 2),
                                   (s.x + 0.5 + 62, s.y + 0.5, -4.0, 3), (s.x + 0.5 + 57, s.y + 0.5, 4.0, 4),
                                   (w.spawn_x + 0.5 + 30, w.spawn_y + 0.5, 3.0, 5) loop
    update player set x = v_x, y = v_y, moved_at = now() - interval '1 minute' where world_id = w.world_id and uid = w.uid;
    g := creature_spawn(w.world_id, 'goblin', v_x + v_far, v_y, 'wild', now() - interval '2 hours');
    update creature set traits = '{}', health = 500, hunting = null, hunt_again = null, threat_at = now() - interval '1 hour',
        until = now() - interval '1 second', settled_at = now() - interval '1 second'
      where world_id = w.world_id and id = g;
    delete from event where uid = w.uid;
    perform creature_settle(w.world_id, g);
    insert into said select 'START:' || n, coalesce((hunting = w.uid)::text, 'none') || ',' || (threat_at is null)
      || ',' || in_safe_ring(w.world_id, v_x, v_y) || ',' || in_safe_ring(w.world_id, v_x + v_far, v_y)
      || ',' || (select count(*) from event where uid = w.uid and text like 'Goblin hunting you%')
      from creature where world_id = w.world_id and id = g;
    delete from creature where world_id = w.world_id and id = g;
  end loop;

  -- A hunt of its own that has followed somebody into the ring: home lies outside it, to the east.
  update player set x = s.x + 0.5 + 30, y = s.y + 0.5 where world_id = w.world_id and uid = w.uid;
  g := creature_spawn(w.world_id, 'goblin', s.x + 0.5 + 33, s.y + 0.5, 'wild', now() - interval '2 hours');
  update creature set traits = '{}', health = 500, hunting = w.uid, hunt_x = to_x, hunt_y = to_y, hunt_again = null,
      threat_at = null, home_x = s.x + 0.5 + 75, home_y = s.y + 0.5,
      until = now() - interval '1 second', settled_at = now() - interval '1 second'
    where world_id = w.world_id and id = g;
  perform creature_settle(w.world_id, g);
  insert into said select 'CHASED', coalesce(hunting::text, 'none') || ',' || (hunt_again > now() + make_interval(secs => hunt_rest() - 5))
    || ',' || (to_x > s.x + 0.5 + 33) || ',' || round(to_x::numeric, 1)
    from creature where world_id = w.world_id and id = g;
  delete from creature where world_id = w.world_id and id = g;

  -- One the body struck there first: its fight runs on.
  g := creature_spawn(w.world_id, 'goblin', s.x + 0.5 + 33, s.y + 0.5, 'wild', now() - interval '2 hours');
  update creature set traits = '{}', health = 500, hunting = null, hunt_again = null, threat_at = null,
      until = now() - interval '1 second', settled_at = now() - interval '1 second'
    where world_id = w.world_id and id = g;
  perform engage_beast(w.world_id, g, w.uid);
  update creature set until = now() - interval '1 second', settled_at = now() - interval '1 second' where world_id = w.world_id and id = g;
  perform creature_settle(w.world_id, g);
  insert into said select 'STRUCK', coalesce((hunting = w.uid)::text, 'none') || ',' || (threat_at is not null)
    from creature where world_id = w.world_id and id = g;
  delete from creature where world_id = w.world_id and id = g;
end $b$;
select k || '|' || v from said;
rollback;`);

const said = new Map(out.split('\n').map((l) => { const i = l.indexOf('|'); return [l.slice(0, i), l.slice(i + 1)] as const; }));
const [size, sx, sy, cx] = (said.get('WORLD') ?? '').split(',').map(Number);
check('the island under test is one the stones stand on', size >= 1024 && Number.isFinite(cx), said.get('WORLD'));

const pts = (said.get('POINTS') ?? '').split(';').filter(Boolean).map((p) => p.split(','));
const offIsland = pts.filter(([x, y, v]) => inSafeRing(size, sx, sy, Number(x), Number(y)) !== (v === 'true'));
check(`the island's in_safe_ring and at_peace agree with the browser's ring at ${pts.length} points either side of its edge, round a stone and the spawn`,
  pts.length === 32 && !offIsland.length && pts.filter(([, , v]) => v === 'true').length === 16, offIsland.slice(0, 3).map((p) => p.join(',')).join('; '));

const [rIn, rInBad, rOut, rOutBad] = (said.get('ROLL') ?? '').split(',').map(Number);
check('a roll of the wild inside the ring is never a kind it keeps out', rIn > 2000 && rInBad === 0, `${rInBad} of ${rIn}`);
check('where one outside it can be', rOut > 2000 && rOutBad > 0, `${rOutBad} of ${rOut}`);

const [bIn, bInBad, bOut, bOutBad] = (said.get('BLOCK') ?? '').split(',').map(Number);
check('a block stocked over the spawn\'s ring puts none of them out inside it', bIn > 0 && bInBad === 0, `${bInBad} of ${bIn} inside`);
check('and can outside it, in the same block', bOutBad > 0, `${bOutBad} of ${bOut} outside`);

const start = (n: number): string[] => (said.get(`START:${n}`) ?? '').split(',');
check('a hunter inside the ring does not start on somebody inside it', start(1)[0] === 'none' && start(1)[2] === 'true' && start(1)[3] === 'true' && start(1)[4] === '0',
  start(1).join(','));
check('one outside every ring does, and the hunt is its own (`threat_at` cleared)', start(2)[0] === 'true' && start(2)[1] === 'true' && start(2)[2] === 'false' && start(2)[4] === '1',
  start(2).join(','));
check('nor does one standing in the ring start on somebody just outside it', start(3)[0] === 'none' && start(3)[2] === 'false' && start(3)[3] === 'true', start(3).join(','));
check('nor one just outside on somebody just inside', start(4)[0] === 'none' && start(4)[2] === 'true' && start(4)[3] === 'false', start(4).join(','));
check(`nor round the spawn, past where the beach ended`, start(5)[0] === 'none' && start(5)[2] === 'true', start(5).join(','));

const chased = (said.get('CHASED') ?? '').split(',');
check('a hunt of its own that comes into the ring: lets go, rests, and turns for home', chased[0] === 'none' && chased[1] === 'true' && chased[2] === 'true', chased.join(','));
const struck = (said.get('STRUCK') ?? '').split(',');
check('one the body struck first fights on inside the ring', struck[0] === 'true' && struck[1] === 'true', struck.join(','));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`the safe ring — ${ok.length} of ${ok.length}`);
