/**
 * Packed dirt is not raised by Change tile.
 *
 * Reported: "can't flatten a tile of packed dirt ... you can still change the
 * level of packed dirt with 'Change tile'." Both Change tiles (a corner of the
 * tile pointed at, `drop_dirt`; the corner nearest your feet,
 * `drop_dirt_here`) refuse packed ground in the same words on both sides, and
 * still raise dirt.
 *
 * Runs against the database the suite leaves behind, in a transaction it
 * rolls back: Hoarding.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, PACKED_FIRST } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { TileType } from '../../src/world/tiles';

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

/* ---- the browser ---- */
const game = Game.create(4242);
const tx = game.player.tileX, ty = game.player.tileY;
game.inventory.add('dirt', { count: 3 });
const corner = ACTION_BY_ID.get('drop_dirt');
const here = ACTION_BY_ID.get('drop_dirt_here');
if (!corner?.check || !here?.check) throw new Error('there is no drop_dirt any more');
const dirt = game.inventory.items.find((i) => i.id === 'dirt');
if (!dirt) throw new Error('no dirt in the pack');
const pointed = { kind: 'tile', x: tx, y: ty, cx: tx, cy: ty } as const;
const held = { kind: 'item', uid: dirt.uid } as const;
const said = (t: TileType): [string | null, string | null] => {
  game.world.setTile(tx, ty, t);
  return [corner.check?.(pointed as never, game) ?? null, here.check?.(held as never, game) ?? null];
};
const packed = said(TileType.PackedDirt);
const loose = said(TileType.Dirt);
check('in the browser, packed dirt is not raised either way', packed[0] === PACKED_FIRST && packed[1] === PACKED_FIRST, JSON.stringify(packed));
check('and dirt still is', loose[0] !== PACKED_FIRST && loose[1] !== PACKED_FIRST, JSON.stringify(loose));

/* ---- the island ---- */
const out = psql(`
begin;
create temp table said (k text, v text) on commit drop;
do $$
declare w uuid; p record; tx int; ty int; t jsonb;
begin
  select id into w from world where name = 'Hoarding';
  select * into p from player where world_id = w order by uid limit 1;
  tx := floor(p.x)::int; ty := floor(p.y)::int;
  t := jsonb_build_object('kind', 'tile', 'x', tx, 'y', ty, 'cx', tx, 'cy', ty);
  perform give(w, p.uid, 'dirt', 3, 10, null, null, null, null, null);
  perform land_set_tile(w, tx, ty, ${TileType.PackedDirt});
  insert into said values ('corner', coalesce(ground_refusal(w, p.uid, 'drop_dirt', t), 'null'));
  insert into said values ('here', coalesce(terrain_refusal(w, p.uid, 'drop_dirt_here',
    jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = p.uid and def = 'dirt' limit 1))), 'null'));
end $$;
select string_agg(k || '=' || v, E'\\n' order by k) from said;
rollback;`);
const island = (k: string): string => out.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1) ?? 'unsaid';
check('on the island, a corner of packed dirt pointed at is refused, as the browser says it', island('corner') === PACKED_FIRST, island('corner'));
check('and the corner at your feet on packed dirt', island('here') === PACKED_FIRST, island('here'));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`packed dirt is not changed — ${ok.length} of ${ok.length}`);
