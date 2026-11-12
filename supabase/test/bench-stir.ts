/**
 * What the clock spends moving creatures, on an island built like the live one.
 *
 * Not a test and not a CI step: a measurement, to be re-run when the stir is changed.
 *
 *   npx esbuild supabase/test/bench-stir.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/bench-stir.mjs
 *   createdb -T ci_t stir_t                            # a copy of the suite's database, never ci_t itself
 *   PGDATABASE=stir_t node bench-stir.mjs setup        # builds the island (a minute or two)
 *   createdb -T stir_t stir_run                        # a fresh copy for each measurement, migrations under test on it
 *   PGDATABASE=stir_run node bench-stir.mjs run [rounds] [warm]
 *
 * The island: a generated 2048-tile world stocked the island's own way (`creature_stock_block` on every block, about
 * two thousand wild ones of eighty kinds), eight people awake and spread out, two of them five tiles apart, three
 * settlements of eighteen workers each at varied trades (gatherers, errands at the stores, a hod carrier with walls
 * to fit, guards and a hunter), six stores and a crate on each holding a few hundred things, a companion for everybody,
 * a Packlet with its panniers full, fifteen hundred pieces of other people's furniture and two hundred crates about
 * the island, and the land's squares built round everybody (`land_chunk_get`). Every other island in the database is
 * put to sleep.
 *
 * A run turns `world_tick()` once a second, each round its own transaction (as `pg_cron` does), with everybody's
 * `seen_at` kept fresh as polling browsers keep it; drops the warm-up rounds; and prints the average and worst round,
 * the stir stage, how many were settled, how many were left due at the end of each round, and the functions that cost
 * the most (`track_functions = 'pl'`).
 *
 * Talks to PGDATABASE (stir_base or a copy of it). Never run it against ci_t or a live project.
 */
import { execFileSync } from 'node:child_process';
import { generateWorld } from '../../src/world/generate';
import { rowsOf, type LandRow } from '../../src/net/landpack';
import { Game } from '../../src/game/game';

const DB = process.env.PGDATABASE ?? '';
if (!DB || DB === 'ci_t' || DB === 'postgres') {
  console.error('bench-stir: point PGDATABASE at a copy (stir_base, stir_run), never ci_t');
  process.exit(2);
}
const psql = (sql: string, who = OWNER): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
    },
    input: `select set_config('request.jwt.claims', '{"sub":"${who}"}', false) \\g /dev/null\n${sql}\n`,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  }).trim();

const NAME = 'Stir bench';
const SIZE = Number(process.env.SIZE ?? 2048);
const SEED = Number(process.env.SEED ?? 7311);
const OWNER = 'b0000000-0000-4000-8000-000000000000';
const uidOf = (i: number): string => `b0000000-0000-4000-8000-00000000000${i}`;
const PEOPLE = 8;
const FOUNDERS = [0, 2, 5];

/** A settlement's trades: the species set to it. Gatherers, errands at the stores, a hod carrier, guards, a hunter. */
const WORKERS = ['bevere', 'rabba', 'grazza', 'sedra', 'mola', 'wadd', 'magga', 'whispet', 'stona', 'rowl',
  'cobbe', 'rippa', 'mudda', 'chissa', 'simma', 'awla', 'tanna', 'tinka'];
/** What a settlement's stores hold: each piece, where it stands off the token, and what is in it, within its room. */
const STORES: { sub: string; dx: number; dy: number; items: [string, number][] }[] = [
  { sub: 'chest', dx: 2, dy: 1, items: [['lye_bucket', 2], ['bucket', 2], ['ash', 10], ['sprout', 8], ['cotton', 10], ['rope', 4], ['shaft', 10], ['candle', 6]] },
  { sub: 'chest', dx: 3, dy: 1, items: [['log', 20], ['reed', 30], ['dough', 6]] },
  { sub: 'bulk_bin', dx: 4, dy: 1, items: [['clay', 60], ['sand', 60], ['rock_shards', 60], ['iron_ore', 40], ['coal', 30]] },
  { sub: 'craft_bin', dx: 2, dy: 3, items: [['plank', 60], ['stone_brick', 80], ['clay_brick', 40], ['mortar', 30]] },
  { sub: 'larder', dx: 3, dy: 3, items: [['meat', 12], ['wheat', 20], ['potato', 15], ['onion', 15], ['apple', 20]] },
  { sub: 'cupboard', dx: 4, dy: 3, items: [['wool', 20], ['wemp', 24], ['hide', 6], ['feather', 12], ['arrow_head', 12]] },
];
/** Elsewhere on the island, other people's furniture and crates, as the live one has. */
const CLUTTER = 1500;
const CRATES = 200;

/** The land's 64-tile squares round everybody, as walking about and the browser's fetches leave them built (`land_chunk_get`). */
const chunks = (id: string): void => {
  psql(`select count(land_chunk_get('${id}', k.cx + dx, k.cy + dy))
          from (select distinct floor(x / chunk_size())::int as cx, floor(y / chunk_size())::int as cy from player
                 where world_id = '${id}' and not away) k
          cross join generate_series(-1, 1) dx cross join generate_series(-1, 1) dy
         where k.cx + dx >= 0 and k.cy + dy >= 0 and (k.cx + dx) * chunk_size() < ${SIZE} and (k.cy + dy) * chunk_size() < ${SIZE}`);
};

const clutter = (id: string): void => {
  // Other people's furniture and crates about the island, off the settlements, a few things in each store.
  psql(`do $c$
    declare w uuid := '${id}'; v_x int; v_y int; v_p bigint; i int := 0; v_sub text; tries int := 0;
    begin
      while i < ${CLUTTER} and tries < ${CLUTTER * 20} loop
        tries := tries + 1;
        v_x := 40 + floor(random() * (${SIZE} - 80))::int; v_y := 40 + floor(random() * (${SIZE} - 80))::int;
        if not creature_tile_ok(w, v_x, v_y) or on_deed(w, v_x, v_y) then continue; end if;
        i := i + 1;
        v_sub := (array['chest', 'chest', 'table', 'barrel', 'bed', 'cupboard', 'bulk_bin', 'chair', 'larder', 'craft_bin'])[1 + i % 10];
        insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
          values (w, 'furniture', v_sub, v_x, v_y, 0, 0, v_x + 0.375, v_y + 0.375, 30, ('b0000000-0000-4000-8000-00000000000' || (3 + i % 5))::uuid) returning id into v_p;
        if v_sub in ('chest', 'cupboard', 'bulk_bin', 'larder', 'craft_bin') then
          insert into item (world_id, holder, placed, def, ql, count)
            values (w, 'furniture', v_p, (array['log', 'clay', 'meat', 'plank', 'wool'])[1 + i % 5], 25, 1 + i % 12);
        end if;
        if i <= ${CRATES} then
          insert into crate (world_id, id, kind, x, y, sx, sy) values (w, 20000 + i, 'plank', v_x + 1, v_y, 0, 0);
          insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 20000 + i, 'plank', 25, 1 + i % 20);
        end if;
      end loop;
    end $c$`);
};

const setup = (): void => {
  const t0 = Date.now();
  let id = psql(`select id from world where name = '${NAME}'`);
  const spots: [number, number][] = [];
  if (id && psql(`select count(*) from deed where world_id = '${id}'`) !== '0') {
    console.error(`bench-stir: ${DB} already holds ${NAME}, settled`);
    process.exit(2);
  }
  if (id) {
    // Land, people and wild already there from a setup that stopped short: the settlements are what is left.
    for (let i = 0; i < PEOPLE; i++) {
      spots.push(psql(`select floor(x) || '|' || floor(y) from player where world_id = '${id}' and uid = '${uidOf(i)}'`).split('|').map(Number) as [number, number]);
    }
  } else {
    const gen = generateWorld(SEED, SIZE);
    console.log(`generated ${SIZE} in ${Date.now() - t0} ms, spawn ${gen.spawn.x},${gen.spawn.y}`);
    id = psql(`select rpc_found('${NAME}', ${SEED}, ${SIZE}, ${gen.spawn.x}, ${gen.spawn.y})`);
    for (let y = 0; y <= gen.world.h; y += 32) {
      const batch: LandRow[] = rowsOf(gen.world, y, Math.min(gen.world.h, y + 31));
      psql(`select rpc_put_land('${id}', $j$${JSON.stringify(batch)}$j$::jsonb)`);
    }
    psql(`select rpc_ready('${id}')`);
    console.log(`land in ${Date.now() - t0} ms`);
    // Every other island asleep, so a round serves this one alone.
    psql(`update player set away = true where world_id <> '${id}'`);

    /** The standable tile above sea nearest (x, y), within 60. */
    const near = (x: number, y: number): [number, number] | null => {
      const at = psql(`select tx || '|' || ty from generate_series(${x - 60}, ${x + 60}, 3) tx, generate_series(${y - 60}, ${y + 60}, 3) ty
        where creature_tile_ok('${id}', tx, ty) and centre_height('${id}', tx, ty) > 3
        order by (tx - ${x}) ^ 2 + (ty - ${y}) ^ 2 limit 1`);
      return at ? (at.split('|').map(Number) as [number, number]) : null;
    };
    // Spread out, a couple of hundred tiles apart, and the second five tiles from the first.
    const want: [number, number][] = [[0, 0], [5, 0], [220, 40], [-200, 120], [60, -230], [-180, -160], [300, 260], [-60, 330]];
    for (let i = 0; i < PEOPLE; i++) {
      const [dx, dy] = want[i];
      const base = i === 1 ? spots[0] : [gen.spawn.x, gen.spawn.y];
      const x = Math.max(70, Math.min(SIZE - 70, base[0] + dx));
      const y = Math.max(70, Math.min(SIZE - 70, base[1] + dy));
      const s = near(x, y) ?? near(gen.spawn.x + 30 * i, gen.spawn.y) ?? [gen.spawn.x, gen.spawn.y];
      spots.push(s);
      psql(`select rpc_join('${id}', 'Bencher${i}')`, uidOf(i));
      psql(`update player set x = ${s[0] + 0.5}, y = ${s[1] + 0.5}, away = false, seen_at = now() where world_id = '${id}' and uid = '${uidOf(i)}'`);
    }
    console.log(`people at ${spots.map((s) => s.join(',')).join(' ')}`);

    // The wild, put out the island's own way, block by block.
    const blocks = Math.ceil(SIZE / Number(psql('select stock_block()')));
    for (let by = 0; by < blocks; by++) {
      psql(`select sum(creature_stock_block('${id}', bx, ${by})) from generate_series(0, ${blocks - 1}) bx`);
    }
    console.log(`wild ${psql(`select count(*) || ' of ' || count(distinct species) || ' kinds' from creature where world_id = '${id}'`)} in ${Date.now() - t0} ms`);
  }

  // A wall's bill, from the browser's own rules.
  const g = Game.create(4243);
  const hall = g.buildings.create('Hall', 10, 10);
  const wall = g.buildings.setWall(hall, 0, 10, 10, 'n', 'solid', 'stone_brick');
  const bill = JSON.stringify(wall.needed).replace(/'/g, "''");

  // Three settlements, each with its stores, its workers and a wall or two to fit.
  FOUNDERS.forEach((f, n) => {
    const [x, y] = spots[f];
    const u = uidOf(f);
    psql(`do $s$
      declare w uuid := '${id}'; u uuid := '${u}'; v_p bigint; k int; sp text; i int := 0;
      begin
        insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Benchstead${n}', ${x}, ${y}, 15, 5, u);
        ${STORES.map((st) => `
        insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
          values (w, 'furniture', '${st.sub}', ${x + st.dx}, ${y + st.dy}, 0, 0, ${x + st.dx} + 0.375, ${y + st.dy} + 0.375, 40, u) returning id into v_p;
        insert into item (world_id, holder, placed, def, ql, count)
          select w, 'furniture', v_p, s.def, 20 + (s.n * 7) % 50, s.n
            from (values ${st.items.map(([d, c]) => `('${d}', ${c})`).join(', ')}) s(def, n)
           where exists (select 1 from item_def where id = s.def);`).join('')}
        insert into crate (world_id, id, kind, x, y, sx, sy, deed) values (w, ${9000 + n}, 'log', ${x} + 5, ${y} + 1, 0, 0, true);
        insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', ${9000 + n}, 'log', 30, 40);
        insert into building (world_id, id, name, levels, planned_by) values (w, ${n + 1}, 'Hall', 1, u);
        insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
          select w, 0, '${wall.dir}', ${x} - 4 + j, ${y} - 4, ${n + 1}, 'solid', 'stone_brick', '${bill}'::jsonb, '${bill}'::jsonb, u
            from generate_series(0, 3) j;
        foreach sp in array array[${WORKERS.map((s) => `'${s}'`).join(', ')}] loop
          i := i + 1;
          k := creature_spawn(w, sp, ${x} + 0.5 + (i % 5) - 2, ${y} + 0.5 + (i / 5) - 2, 'active', now() - interval '60 days', u);
          update creature set mode = 'deed', traits = '{}', settled_at = now(), until = now() where world_id = w and id = k;
        end loop;
      end $s$`, u);
  });

  // A companion at everybody's heel, and a Packlet with its panniers full.
  for (let i = 0; i < PEOPLE; i++) {
    const [x, y] = spots[i];
    psql(`select creature_spawn('${id}', '${i === 1 ? 'bura' : 'rabba'}', ${x + 1.5}, ${y + 0.5}, 'active', now() - interval '30 days', '${uidOf(i)}')`, uidOf(i));
  }
  psql(`insert into item (world_id, holder, pannier, def, ql, count)
    select '${id}', 'pannier', c.id, s.def, 30, s.n from creature c
      cross join (values ('log', 60), ('plank', 40), ('clay', 30), ('stone_brick', 50)) s(def, n)
     where c.world_id = '${id}' and c.species = 'bura' and c.keeper = '${uidOf(1)}'`);
  clutter(id);
  chunks(id);
  psql('analyze');
  console.log(psql(`select 'creatures ' || count(*) || ', wild ' || count(*) filter (where mode = 'wild') || ', workers ' || count(*) filter (where mode = 'deed')
    || ', at heel ' || count(*) filter (where mode = 'active') from creature where world_id = '${id}'`));
  console.log(`set up in ${Math.round((Date.now() - t0) / 1000)} s`);
};

const run = (rounds: number, warm: number): void => {
  const id = psql(`select id from world where name = '${NAME}'`);
  if (!id) { console.error(`bench-stir: no ${NAME} in ${DB}`); process.exit(2); }
  psql(`update player set away = true where world_id <> '${id}';
        update player set away = false, seen_at = now() where world_id = '${id}';
        create table if not exists bench_round (n int primary key, ms double precision, stir double precision, settled int, due int, near int, kept int);
        truncate bench_round;`);
  /*
   * Each round in a backend of its own, as `pg_cron` runs it: nothing is planned or cached from the round before.
   */
  const sleep = (ms: number): void => { if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };
  process.env.PGOPTIONS = `${process.env.PGOPTIONS ?? ''} -c track_functions=pl`;
  for (let i = 1; i <= warm + rounds; i++) {
    if (i === warm + 1) psql('select pg_stat_reset()');
    const t = Date.now();
    psql(`update player set seen_at = now() where world_id = '${id}' and not away;
      select world_tick() as r \\gset
      select ms, (stages->>'stir')::double precision as stir from tick_time order by at desc limit 1 \\gset
      -- What was left due when the round ended: near somebody awake (48 tiles), and kept by somebody awake.
      ${i > warm ? '' : '-- '}insert into bench_round select ${i - warm}, :ms, :stir, coalesce((:'r'::jsonb->>'stirred')::int, 0), count(*), count(*) filter (where c.mode = 'wild'), count(*) filter (where c.mode in ('deed', 'active')) from creature c where c.world_id = '${id}' and c.until <= now() and (c.mode in ('deed', 'active') or exists (select 1 from player p where p.world_id = c.world_id and not p.away and abs(p.x - c.to_x) <= 48 and abs(p.y - c.to_y) <= 48));`);
    sleep(1000 - (Date.now() - t));
  }
  const out = psql(`
    select pg_sleep(1.2);
    select 'rounds ' || count(*) || ': round avg ' || round(avg(ms)::numeric, 1) || ' ms, p95 ' || round(percentile_cont(0.95) within group (order by ms)::numeric, 1)
      || ', worst ' || round(max(ms)::numeric, 1) || '; stir avg ' || round(avg(stir)::numeric, 1) || ', worst ' || round(max(stir)::numeric, 1)
      || '; settled a round ' || round(avg(settled)::numeric, 1) || '; left due a round avg ' || round(avg(due)::numeric, 1)
      || ' (near ' || round(avg(near)::numeric, 1) || ', kept ' || round(avg(kept)::numeric, 1) || '), worst ' || max(due)
      from bench_round;
    select rpad(funcname, 28) || lpad(calls::text, 8) || lpad(round(total_time::numeric)::text, 9) || ' ms' || lpad(round(self_time::numeric)::text, 9) || ' self'
           || lpad(round((total_time / greatest(calls, 1))::numeric, 3)::text, 10) || ' ms a call'
      from pg_stat_user_functions order by self_time desc limit ${Number(process.env.TOP ?? 40)};`);
  console.log(out);
};

const [mode, a, b] = process.argv.slice(2);
if (mode === 'setup') setup();
else if (mode === 'chunks') { chunks(psql(`select id from world where name = '${NAME}'`)); psql('analyze'); }
else if (mode === 'clutter') { clutter(psql(`select id from world where name = '${NAME}'`)); psql('analyze'); }
else if (mode === 'run') run(Number(a ?? 200), Number(b ?? 30));
else { console.error('bench-stir: setup | run [rounds] [warm]'); process.exit(2); }
