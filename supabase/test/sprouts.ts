/**
 * Sprouts: none off a sapling, and one pick a tree an hour.
 *
 * Reported: "players can pick sprouts from saplings. Saplings should only be
 * able to be picked from trees hourly."
 *
 *   * a stage with no timber in it (a sapling, or one clipped to a shrub) has
 *     no sprouts, on the island and in the browser's menu;
 *   * a pick marks the tree (`foraged`, kind `sprout`) for `sprout_cooldown`,
 *     the browser's `SPROUT_COOLDOWN`, and the tree has none till then;
 *   * and a worker sent for sprouts passes over the same trees.
 *
 * Runs against the database the suite leaves behind, in a transaction it
 * rolls back: Hoarding.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { FORAGE_COOLDOWN, Game, SPROUT_COOLDOWN } from '../../src/game/game';
import { world } from '../../src/game/pace';
import { packTreeData, TileType, TREE_AGES } from '../../src/world/tiles';

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

const age = (name: string): number => {
  const a = TREE_AGES.find((t) => t.name === name);
  if (!a) throw new Error(`no tree age ${name}`);
  return a.id;
};
const SAPLING = age('Sapling'), CLIPPED = age('Clipped'), MATURE = age('Mature');

/* ---- the browser ---- */
const game = Game.create(4242);
const pick = ACTION_BY_ID.get('pick_sprout');
if (!pick?.check) throw new Error('there is no pick_sprout any more');
const tx = game.player.tileX + 1, ty = game.player.tileY;
const target = { kind: 'tile', x: tx, y: ty, cx: tx, cy: ty } as const;
const said = (stage: number): string | null => {
  game.world.setTile(tx, ty, TileType.Tree, packTreeData(0, stage));
  return pick.check?.(target, game) ?? null;
};
const browser = { sapling: said(SAPLING), clipped: said(CLIPPED), mature: said(MATURE) };
check('in the browser, a sapling and a clipped one have no sprouts, and a grown tree has',
  browser.sapling === 'Sapling: no sprouts.' && browser.clipped === 'Clipped: no sprouts.' && browser.mature === null,
  JSON.stringify(browser));
game.markForaged(tx, ty, 'sprout');
const picked = said(MATURE);
game.time += FORAGE_COOLDOWN + 1;
const pastForage = said(MATURE);
game.time += world(SPROUT_COOLDOWN);
const pastHour = said(MATURE);
check('and a tree picked has none till the hour is up, not the three minutes a bush takes',
  picked === 'Sprout already picked. Try later.' && pastForage === picked && pastHour === null,
  `${picked} / ${pastForage} / ${pastHour}`);
check('picking it marks the tree for the next body', (() => {
  game.time += world(SPROUT_COOLDOWN) + 1;
  for (let i = 0; i < 200 && !game.isForaged(tx, ty, 'sprout'); i++) pick.perform?.(target, game);
  return game.isForaged(tx, ty, 'sprout');
})());

/* ---- the island ---- */
const out = psql(`
begin;
create temp table said (k text, v text) on commit drop;
do $$
declare w uuid; u uuid; p record; tx int; ty int; t jsonb; c creature; i int;
begin
  select id into w from world where name = 'Hoarding';
  select * into p from player where world_id = w order by uid limit 1;
  u := p.uid;
  tx := floor(p.x)::int + 1; ty := floor(p.y)::int;
  t := jsonb_build_object('kind', 'tile', 'x', tx, 'y', ty);
  perform land_set_tile(w, tx, ty, 16);
  delete from foraged where world_id = w and foraged.x = tx and foraged.y = ty;
  perform land_set_data(w, tx, ty, tree_pack(0, ${SAPLING}));
  insert into said values ('sapling', ground_refusal(w, u, 'pick_sprout', t));
  perform land_set_data(w, tx, ty, tree_pack(0, ${CLIPPED}));
  insert into said values ('clipped', ground_refusal(w, u, 'pick_sprout', t));
  select * into c from creature where world_id = w limit 1;
  insert into said values ('worker_sapling', worker_gatherable(w, tx, ty, 'sprout', c)::text);
  perform land_set_data(w, tx, ty, tree_pack(0, ${MATURE}));
  insert into said values ('mature', coalesce(ground_refusal(w, u, 'pick_sprout', t), 'null'));
  insert into said values ('worker_mature', worker_gatherable(w, tx, ty, 'sprout', c)::text);
  for i in 1..200 loop
    exit when is_foraged(w, tx, ty, 'sprout');
    perform perform_ground(w, u, 'pick_sprout', t);
  end loop;
  insert into said values ('marked', is_foraged(w, tx, ty, 'sprout')::text);
  insert into said values ('picked', coalesce(ground_refusal(w, u, 'pick_sprout', t), 'null'));
  insert into said values ('worker_picked', worker_gatherable(w, tx, ty, 'sprout', c)::text);
  update foraged set at = now() - make_interval(secs => forage_cooldown() + 1)
   where world_id = w and foraged.x = tx and foraged.y = ty and kind = 'sprout';
  insert into said values ('past_forage', coalesce(ground_refusal(w, u, 'pick_sprout', t), 'null'));
  update foraged set at = now() - make_interval(secs => sprout_cooldown() + 1)
   where world_id = w and foraged.x = tx and foraged.y = ty and kind = 'sprout';
  insert into said values ('past_hour', coalesce(ground_refusal(w, u, 'pick_sprout', t), 'null'));
  insert into said values ('cooldown', sprout_cooldown()::text);
end $$;
select string_agg(k || '=' || coalesce(v, 'null'), E'\\n' order by k) from said;
rollback;`);
const island = (k: string): string => out.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1) ?? 'unsaid';

check('on the island, a sapling and a clipped one have no sprouts, said as the browser says it',
  island('sapling') === browser.sapling && island('clipped') === browser.clipped, `${island('sapling')} / ${island('clipped')}`);
check('and a grown tree has', island('mature') === 'null', island('mature'));
check('a pick marks the tree, and it has none till the hour is up, said as the browser says it',
  island('marked') === 'true' && island('picked') === picked && island('past_forage') === picked && island('past_hour') === 'null',
  `${island('marked')} / ${island('picked')} / ${island('past_forage')} / ${island('past_hour')}`);
check('a worker passes over a sapling and a tree picked within the hour, and not a grown one',
  island('worker_sapling') === 'false' && island('worker_picked') === 'false' && island('worker_mature') !== 'false',
  `${island('worker_sapling')} / ${island('worker_mature')} / ${island('worker_picked')}`);
check('the hour is the same on both sides', island('cooldown') === String(SPROUT_COOLDOWN),
  `island ${island('cooldown')}, browser ${SPROUT_COOLDOWN}`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`sprouts: none off a sapling, one a tree an hour — ${ok.length} of ${ok.length}`);
