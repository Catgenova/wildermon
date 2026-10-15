/**
 * A team is not your companion, and a team is put together out of its crates.
 *
 * Reported: "to hitch a mon i have to let it out of the cage to follow me, but
 * then once it's hitched it still counts as following me and i can't bring
 * out the next mon to hitch". Asked as well: the vehicle's Hitch list takes a
 * wildermon straight out of a crate. So this asks, the same on both sides and
 * in the same words:
 *
 *   * one in the traces is not the one that follows you, so the next comes out
 *     of its crate to follow you without the first going in in its place;
 *   * one in a crate in your pack goes straight into a yoke, and its crate is
 *     empty after;
 *   * a team comes out of the traces with one of yours following you and the
 *     rest into the empty crates in your pack, and with too few there it stays
 *     in and says how many it wants.
 *
 * The island half runs against the database the suite leaves behind, in one
 * transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Game } from '../../src/game/game';
import { CREATURE_ACTION_BY_ID } from '../../src/game/creatureActions';
import { CREATURE_CRATE_ACTIONS, shutIn } from '../../src/game/creaturecrate';
import { PLACEABLE_ACTION_BY_ID } from '../../src/game/placeables';
import { teamOf, type PlacedFurniture } from '../../src/game/furniture';
import type { Target } from '../../src/game/actions';

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

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7ea70000-0000-4000-8000-0000000000a1';
const beast = (v: string): string => `jsonb_build_object('kind', 'creature', 'id', ${v})`;
const crate = (v: string): string => `jsonb_build_object('kind', 'item', 'uid', ${v})`;
const wagon = "jsonb_build_object('kind', 'furniture', 'id', v_wagon)";
const said = (k: string, v: string): string => `insert into said values ('${k}', coalesce((${v})::text, 'none'));`;
const told = (k: string): string =>
  `insert into said select '${k}', coalesce(string_agg(text, ' / ' order by n), 'nothing') from event where world_id = w and uid = u and kind in ('event', 'error', 'system'); delete from event where world_id = w and uid = u;`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_it bigint; v_wagon bigint; v_ash int; v_bea int; v_cob int; v_cb bigint; v_cc bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Teams', 166, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 20.5, y = 20.5, body_at = now(), stats = jsonb_build_object('health', 1, 'hunger', 1, 'thirst', 1, 'stamina', 1)
   where world_id = w and uid = u;
  perform give(w, u, 'wagon', 1, 50, 'Pine');
  select id into v_it from item where world_id = w and holder_uid = u and def = 'wagon';
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'item', 'uid', v_it, 'x', 21, 'y', 20, 'sx', 0, 'sy', 0));
  select id into v_wagon from placed where world_id = w and sub = 'wagon';

  v_ash := creature_spawn(w, 'orse', 20.8, 21.2, 'active', now() - interval '1 day', u);
  v_bea := creature_spawn(w, 'orse', 20.5, 20.5, 'active', now() - interval '1 day', u);
  v_cob := creature_spawn(w, 'orse', 20.5, 20.5, 'active', now() - interval '1 day', u);
  update creature set hunger = 0.9, name = case id when v_ash then 'Ash' when v_bea then 'Bea' else 'Cob' end,
      settled_at = now(), until = now(), leg_at = now(), leg_ends = now(), from_x = to_x, from_y = to_y
    where world_id = w and id in (v_ash, v_bea, v_cob);
  v_cb := give(w, u, 'creature_crate', 1, 30);
  perform crate_shut_in(w, v_bea, v_cb, null);
  v_cc := give(w, u, 'creature_crate', 1, 30);
  perform crate_shut_in(w, v_cob, v_cc, null);
  delete from event where world_id = w and uid = u;
  insert into said values ('WAGON', coalesce(v_wagon::text, 'none'));

  -- Ash, following, into the traces.
  perform act_perform(w, u, 'hitch_creature', ${beast('v_ash')});
  ${told('T:hitch')}
  ${said('FOLLOWS:after-hitch', 'companion_of(w, u)')}
  -- Bea out of her crate to follow: nobody goes in in her place.
  ${said('R:let-out', "act_refusal(w, u, 'crate_follow', " + crate('v_cb') + ')')}
  perform act_perform(w, u, 'crate_follow', ${crate('v_cb')});
  ${told('T:let-out')}
  ${said('FOLLOWS:after-let-out', "(select name from creature where world_id = w and id = companion_of(w, u))")}
  ${said('ASH', "(select coalesce(hitched_to::text, 'free') || '|' || mode from creature where world_id = w and id = v_ash)")}
  -- Cob straight out of his crate into a yoke.
  ${said('R:crated', "act_refusal(w, u, 'hitch_creature', " + beast('v_cob') + ')')}
  perform act_perform(w, u, 'hitch_creature', ${beast('v_cob')});
  ${told('T:crated')}
  ${said('COB', "(select coalesce(hitched_to::text, 'free') || '|' || mode from creature where world_id = w and id = v_cob)")}
  ${said('COB-CRATE', "(select coalesce(creature::text, 'empty') from item where world_id = w and id = v_cc)")}
  ${said('TEAM', 'team_size(w, v_wagon)')}

  -- With Bea following and no empty crate, neither the team nor Ash alone comes out.
  delete from item where world_id = w and def = 'creature_crate' and creature is null;
  ${said('R:team', "act_refusal(w, u, 'unhitch_team', " + wagon + ')')}
  ${said('R:one', "act_refusal(w, u, 'unhitch_creature', " + beast('v_ash') + ')')}
  perform act_perform(w, u, 'unhitch_creature', ${beast('v_ash')});
  ${said('ASH-STAYS', "(select coalesce(hitched_to::text, 'free') from creature where world_id = w and id = v_ash)")}
  -- With one empty crate, Ash comes out into it.
  perform give(w, u, 'creature_crate', 1, 30);
  ${said('R:one-crate', "act_refusal(w, u, 'unhitch_creature', " + beast('v_ash') + ')')}
  perform act_perform(w, u, 'unhitch_creature', ${beast('v_ash')});
  ${told('T:one')}
  ${said('ASH-OUT', "(select mode from creature where world_id = w and id = v_ash)")}
  -- And Bea put away, the team of one comes out to follow.
  perform crate_shut_in(w, v_bea, give(w, u, 'creature_crate', 1, 30), null);
  ${said('R:last', "act_refusal(w, u, 'unhitch_team', " + wagon + ')')}
  perform act_perform(w, u, 'unhitch_team', ${wagon});
  ${told('T:last')}
  ${said('FOLLOWS:last', "(select name from creature where world_id = w and id = companion_of(w, u))")}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('a wagon to hitch to', at('WAGON') !== 'none', at('WAGON'));
check('on the island, one put in the traces is no longer the one that follows you', at('FOLLOWS:after-hitch') === 'none', at('FOLLOWS:after-hitch'));
check('so the next comes out of its crate to follow you', at('R:let-out') === 'none' && at('FOLLOWS:after-let-out') === 'Bea', `${at('R:let-out')} / ${at('FOLLOWS:after-let-out')}`);
check('and the one in the traces stays in them, not put in the crate in its place', at('ASH').startsWith(at('WAGON')), at('ASH'));
check('one in a crate in your pack goes straight into a yoke', at('R:crated') === 'none' && at('COB').startsWith(at('WAGON')) && at('TEAM') === '2',
  `${at('R:crated')} / ${at('COB')} / ${at('TEAM')}`);
check('and its crate is empty after', at('COB-CRATE') === 'empty', at('COB-CRATE'));
check('and it says so', at('T:crated').startsWith('Cob comes out of the crate. You back Cob into a yoke'), at('T:crated'));
check('with one following and no empty crate, one stays in the traces', at('ASH-STAYS') === at('WAGON'), at('ASH-STAYS'));
check('with one empty crate, it comes out into the crate', at('R:one-crate') === 'none' && at('ASH-OUT') === 'stored'
  && at('T:one').endsWith('Ash goes into a creature crate in your pack: Bea follows you.'), `${at('ASH-OUT')} / ${at('T:one')}`);
check('and the last of a team comes out to follow you when nothing else does', at('R:last') === 'none' && at('FOLLOWS:last') === 'Cob', `${at('R:last')} / ${at('FOLLOWS:last')}`);

/* ---- in the browser, the same, in the same words ------------------------------------------ */

const g = Game.create(4244);
let spot: [number, number] | null = null;
for (let r = 0; r < 200 && !spot; r++) {
  for (let dx = -r; dx <= r && !spot; dx++) {
    for (const dy of [-r, r]) {
      let clear = true;
      for (let y = 96 + dy - 3; y <= 96 + dy + 3 && clear; y++) {
        for (let x = 96 + dx - 3; x <= 96 + dx + 3 && clear; x++) {
          if (!g.world.isPassable(x, y) || g.world.hasWater(x, y) || g.world.slope(x, y) >= 12) clear = false;
        }
      }
      if (clear) {
        spot = [96 + dx, 96 + dy];
        break;
      }
    }
  }
}
const [px, py] = spot ?? [96, 96];
for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
for (const c of [...g.creatures.list.values()]) if (c.mode !== 'wild') g.creatures.list.delete(c.id);
for (const it of [...g.inventory.items]) g.inventory.remove(it.uid, it.count);
g.player.x = px + 0.5;
g.player.y = py + 0.5;
const wg: PlacedFurniture = g.addFurniture('wagon', px + 1, py, 0, 0, 50, [], 'Pine');
const mk = (name: string): ReturnType<typeof g.creatures.spawn> => {
  const c = g.creatures.spawn('orse', px + 0.8, py + 1.2, 'active', g.rand, g.time - 3600 * 24);
  c.name = name;
  c.hunger = 0.9;
  return c;
};
const ash = mk('Ash');
const bea = mk('Bea');
const cob = mk('Cob');
const cb = g.inventory.add('creature_crate', { ql: 30 });
shutIn(g, bea, cb);
const cc = g.inventory.add('creature_crate', { ql: 30 });
shutIn(g, cob, cc);

const hitch = CREATURE_ACTION_BY_ID.get('hitch_creature');
const unhitch = CREATURE_ACTION_BY_ID.get('unhitch_creature');
const team = PLACEABLE_ACTION_BY_ID.get('unhitch_team');
const follow = CREATURE_CRATE_ACTIONS.find((a) => a.id === 'crate_follow');
const asked = (def: typeof hitch, t: Target): string => def?.check?.(t, g) ?? 'none';
const lastSaid = (): string => g.log.at(-1)?.text ?? '';
const of = (c: typeof ash): Target => ({ kind: 'creature', id: c.id });
const wt: Target = { kind: 'furniture', id: wg.id };

hitch?.perform(of(ash), g);
check('in the browser, one put in the traces is no longer the one that follows you', g.creatures.active() === undefined, g.creatures.active()?.name ?? 'none');
const letOut = asked(follow, { kind: 'item', uid: cb.uid });
follow?.perform({ kind: 'item', uid: cb.uid }, g);
check('so the next comes out of its crate to follow you, and the first stays in the traces',
  letOut === 'none' && g.creatures.active() === bea && ash.hitchedTo === wg.id, `${letOut} / ${g.creatures.active()?.name} / ${ash.hitchedTo}`);
check('one in a crate in your pack is offered for the traces', !!hitch?.applies(of(cob), g) && asked(hitch, of(cob)) === 'none', asked(hitch, of(cob)));
hitch?.perform(of(cob), g);
check('and goes straight into a yoke, in the island\'s words', cob.hitchedTo === wg.id && cc.creature === undefined && teamOf(wg).length === 2
  && lastSaid() === at('T:crated'), `${lastSaid()} / ${at('T:crated')}`);
for (const it of g.inventory.items.filter((i) => i.id === 'creature_crate' && i.creature === undefined)) g.inventory.remove(it.uid, it.count);
check('with one following and no empty crate, the team stays in, in the island\'s words', asked(team, wt) === at('R:team'), `${asked(team, wt)} / ${at('R:team')}`);
check('and so does one alone, in the island\'s words', asked(unhitch, of(ash)) === at('R:one'), `${asked(unhitch, of(ash))} / ${at('R:one')}`);
g.inventory.add('creature_crate', { ql: 30 });
unhitch?.perform(of(ash), g);
check('with one empty crate, it comes out into the crate, in the island\'s words', ash.mode === 'stored' && lastSaid() === at('T:one'), `${lastSaid()} / ${at('T:one')}`);
shutIn(g, bea, g.inventory.add('creature_crate', { ql: 30 }));
team?.perform(wt, g);
check('and the last of a team comes out to follow you when nothing else does, in the island\'s words',
  g.creatures.active() === cob && lastSaid() === at('T:last'), `${lastSaid()} / ${at('T:last')}`);

/* ---- and on the vehicle's menu ---------------------------------------------------------- */

const ui = readFileSync('src/ui/ui.ts', 'utf8');
const menu = ui.slice(ui.indexOf("const hitchDef = ACTION_BY_ID.get('hitch_creature');"), ui.indexOf('entries.push(...lampEntries(g, f));'));
check('the vehicle\'s Hitch list takes the ones in crates as the beast\'s own entry does', menu.includes('vehicleFor(g, c) === f') && menu.includes("'in a crate'"));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na team is not your companion — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
