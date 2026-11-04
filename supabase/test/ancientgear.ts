/**
 * An ancient helm and an ancient short sword, restored, and nothing improves or repairs them.
 *
 * Asked for: "Implement that ancient Helms and ancient short swords cant be
 * improved or repaired, even with ancient whetstones. Ancient Helms provide +3
 * tile sight radius. Ancient swords swing 25% faster." This asks, of both
 * sides, in the same words:
 *
 *   * that the relics 'ancient helm' and 'old blade' restore into an ancient
 *     helm and an ancient short sword, worn and wielded as a helm and a short
 *     sword are, at the same armour, damage and reach;
 *   * that Improve, Repair, a repair kit, Mend and an ancient whetstone refuse
 *     either ("Ancient helm: cannot be improved or repaired."), none of them
 *     offered on one in the browser, and the thing as it was after; that a
 *     worker mending the stores passes them by; and that a plain helm and short
 *     sword are improved and repaired as ever;
 *   * that an ancient helm worn adds `ANCIENT_HELM_SIGHT` tiles to the sight
 *     radius, and carried adds nothing;
 *   * that an ancient short sword swings in `ANCIENT_SWORD_SWING` a short
 *     sword's time, and a short sword as before;
 *   * and that both describe themselves with those numbers.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game, type DeedStore } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { RELICS } from '../../src/game/archaeology';
import { CAST_BY_ID, castReason } from '../../src/game/faith';
import { fightBase } from '../../src/game/fight';
import { ANCIENT_HELM, ANCIENT_HELM_SIGHT, ANCIENT_SWORD, ANCIENT_SWORD_SWING, ARMOUR_BY_ID, reachOf, WEAPON_BY_ID } from '../../src/game/gear';
import { canImprove } from '../../src/game/improve';
import { itemDef, UNMENDABLE, unmendableSays, type Item } from '../../src/game/items';

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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));

/** The two relics, what each restores into, and the plain thing a smith makes that it is otherwise. */
const GEAR: Array<{ relic: string; id: string; plain: string }> = [
  { relic: 'ancient helm', id: ANCIENT_HELM, plain: 'helm' },
  { relic: 'old blade', id: ANCIENT_SWORD, plain: 'short_sword' },
];
/** Every thing that might take damage off one or better it, by the action's id and what the test calls it. */
const ACTS: Array<[string, string]> = [['improve_item', 'Improve'], ['repair_item', 'Repair'], ['mend_kit', 'A repair kit'], ['hone_whetstone', 'An ancient whetstone']];
/** What each piece carries when it is asked about: damaged, and under what Improve refuses for (`IMPROVE_DAMAGE`). */
const DMG = 5;
const QL = 30;
const U = 'a9c1e000-0000-4000-8000-0000000000a9';

/* ---- on the island ----------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v bigint; i int; r record; p jsonb; ids jsonb := '{}'; box int; ah bigint; h bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Ancient gear', 977, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Delver');
  update player set favour = 120, favour_at = now() where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value)
    values (w, u, 'restoration', 100), (w, u, faith_skill(), 90), (w, u, 'repair', 50), (w, u, 'platesmithing', 60), (w, u, 'weaponsmithing', 60)
    on conflict (world_id, uid, id) do update set value = excluded.value;

  insert into said select 'RELICS', string_agg(name || ':' || result, ',' order by name) from relic_def where name in ('ancient helm', 'old blade');
  insert into said select 'KINDS', string_agg(d, ',' order by d) from unnest(array['ancient_helm', 'ancient_short_sword', 'helm', 'short_sword']) d where unmendable(d);
  insert into said select 'SAYS:' || d, unmendable_says(d) from unnest(array['ancient_helm', 'ancient_short_sword']) d;
  insert into said select 'DESC:' || d.id, d.description from item_def d where d.id in ('ancient_helm', 'ancient_short_sword');
  insert into said select 'IMPROVABLE', coalesce(string_agg(item, ',' order by item), '-') from improvable_def
    where item in ('ancient_helm', 'ancient_short_sword', 'helm', 'short_sword');
  insert into said select 'ARMOUR:' || a.id, a.slot || ':' || a.cls from armour_def a where a.id in ('ancient_helm', 'helm');
  insert into said select 'WEAPON:' || x.id, x.kind || ':' || x.damage || ':' || x.swing || ':' || coalesce(x.two_handed, false) || ':' || weapon_reach(x.id)
    from weapon_def x where x.id in ('ancient_short_sword', 'short_sword');

  -- Each relic, its every piece in the pack, restored, with the brush restoring takes.
  perform give(w, u, 'brush', 1, 60);
  for r in select * from relic_def where name in ('ancient helm', 'old blade') loop
    for i in 1 .. r.parts loop v := give(w, u, 'fragment', 1, 60, r.name || ' ' || i || '/' || r.parts); end loop;
    i := 0;
    while not exists (select 1 from item where world_id = w and holder = 'player' and holder_uid = u and def = r.result) and i < 30 loop
      i := i + 1;
      perform perform_dig(w, u, 'restore_relic', jsonb_build_object('kind', 'item', 'uid', v));
    end loop;
    insert into said select 'RESTORED:' || r.name, coalesce((select string_agg(def, ',') from item where world_id = w and holder = 'player'
      and holder_uid = u and def in ('ancient_helm', 'ancient_short_sword', 'helm', 'short_sword')), 'nothing')
      || '|' || coalesce((select tally->>('restored:' || r.result) from player where world_id = w and uid = u), 'none');
    delete from item where world_id = w and holder = 'player' and holder_uid = u and def = r.result;
  end loop;

  -- One of each, knocked about a little, and what every one of the five wants in the pack.
  for r in select d from unnest(array['ancient_helm', 'ancient_short_sword', 'helm', 'short_sword']) d loop
    v := give(w, u, r.d, 1, ${QL});
    update item set dmg = ${DMG} where id = v;
    ids := ids || jsonb_build_object(r.d, v);
  end loop;
  perform give(w, u, 'file', 1, 50);
  perform give(w, u, 'whetstone', 1, 50);
  perform give(w, u, 'iron_lump', 5, 50);
  perform give(w, u, 'repair_kit', 2, 50);
  perform give(w, u, 'ancient_whetstone', 1, 30);

  for r in select d, a from unnest(array['ancient_helm', 'ancient_short_sword', 'helm', 'short_sword']) d,
                              unnest(array['improve_item', 'repair_item', 'mend_kit', 'hone_whetstone']) a loop
    insert into said values ('NO:' || r.a || ':' || r.d,
      coalesce(act_refusal(w, u, r.a, jsonb_build_object('kind', 'item', 'uid', (ids->>r.d)::bigint)), 'ALLOWED'));
  end loop;
  for r in select d from unnest(array['ancient_helm', 'ancient_short_sword', 'helm', 'short_sword']) d loop
    insert into said values ('NO:mend:' || r.d, coalesce(cast_reason(w, u, 'mend', (ids->>r.d)::bigint), 'ALLOWED'));
  end loop;

  -- Asked through the door every browser asks by, and the whetstone done, which asks again: refused, and as it was.
  for r in select d, a from unnest(array['ancient_helm', 'ancient_short_sword']) d,
                              unnest(array['improve_item', 'repair_item', 'mend_kit', 'hone_whetstone']) a loop
    update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null,
           act_goes = null, act_queue = '[]' where world_id = w and uid = u;
    p := rpc_act(w, r.a, jsonb_build_object('kind', 'item', 'uid', (ids->>r.d)::bigint));
    insert into said values ('ACT:' || r.a || ':' || r.d, coalesce(p->>'why', '-') || '|'
      || coalesce((select act from player where world_id = w and uid = u), 'idle'));
  end loop;
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null,
         act_goes = null, act_queue = '[]' where world_id = w and uid = u;
  perform act_perform(w, u, 'hone_whetstone', jsonb_build_object('kind', 'item', 'uid', (ids->>'ancient_helm')::bigint));
  perform act_perform(w, u, 'hone_whetstone', jsonb_build_object('kind', 'item', 'uid', (ids->>'ancient_short_sword')::bigint));
  insert into said select 'AS_WAS', string_agg(def || ':' || dmg || ':' || ql, ',' order by def) || '|' || pack_count(w, u, 'ancient_whetstone')
    from item where id in ((ids->>'ancient_helm')::bigint, (ids->>'ancient_short_sword')::bigint);

  -- A plain helm repaired, and a plain short sword honed.
  perform act_perform(w, u, 'repair_item', jsonb_build_object('kind', 'item', 'uid', (ids->>'helm')::bigint));
  perform act_perform(w, u, 'hone_whetstone', jsonb_build_object('kind', 'item', 'uid', (ids->>'short_sword')::bigint));
  insert into said select 'PLAIN', string_agg(def || ':' || (dmg < ${DMG}), ',' order by def) || '|' || pack_count(w, u, 'ancient_whetstone')
    from item where id in ((ids->>'helm')::bigint, (ids->>'short_sword')::bigint);

  -- A worker mending the stores: the ancient helm the worst in the crate, and passed by.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Home', 16, 16, 3, 1, u);
  select coalesce(max(id), 0) + 1 into box from crate where world_id = w;
  insert into crate (world_id, id, kind, x, y, sx, sy, deed) values (w, box, 'plank', 16, 16, 0, 0, true);
  ah := give(w, u, 'ancient_helm', 1, ${QL});
  h := give(w, u, 'helm', 1, ${QL});
  update item set dmg = 60 where id = ah;
  update item set dmg = 20 where id = h;
  update item set holder = 'crate', crate = box, holder_uid = null where id in (ah, h);
  insert into said values ('STORES', coalesce((damaged_in_stores(w, u)).def, 'nothing'));
  update item set dmg = 0 where id = h;
  insert into said values ('STORES:ancient', coalesce((damaged_in_stores(w, u)).def, 'nothing'));
  insert into said values ('ERRAND', (pg_get_functiondef('errand_do'::regproc) like '%not unrestored(i.def) and not unmendable(i.def)%')::text);

  -- A swing of each, in a fresh body's hands.
  for r in select d from unnest(array['ancient_short_sword', 'short_sword']) d loop
    update player set equipped = jsonb_build_object('weapon', (ids->>r.d)::bigint) where world_id = w and uid = u;
    insert into said values ('SWING:' || r.d, act_base(w, u, 'attack_creature', 1)::text);
  end loop;
end $t$;
select k || '=' || coalesce(v, 'null') from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(977);
g.inventory.items.splice(0);
g.skills.values.set('restoration', 100);
g.skills.values.set('prayer', 90);
g.skills.values.set('platesmithing', 60);
g.skills.values.set('weaponsmithing', 60);
g.player.favour = 120;
const on = (it: Item): Target => ({ kind: 'item', uid: it.uid });
const restore = ACTION_BY_ID.get('restore_relic')!;
const mend = CAST_BY_ID.get('mend')!;

/* ---- both ---------------------------------------------------------------------------- */

// What each relic restores into, and what that is.
check('the two relics restore into the ancient helm and the ancient short sword, the same on both sides',
  GEAR.every(({ relic, id }) => RELICS.some((r) => r.name === relic && r.result === id))
    && at('RELICS') === GEAR.map(({ relic, id }) => `${relic}:${id}`).sort().join(','), at('RELICS'));
g.inventory.add('brush', { ql: 60 });
for (const { relic, id } of GEAR) {
  const r = RELICS.find((x) => x.name === relic)!;
  for (let i = 1; i <= r.parts; i++) g.inventory.add('fragment', { ql: 60, extra: `${relic} ${i}/${r.parts}` });
  const first = g.inventory.items.find((it) => it.extra === `${relic} 1/${r.parts}`)!;
  for (let i = 0; i < 30 && !g.inventory.find(id); i++) if (!restore.check?.(on(first), g)) restore.perform(on(first), g);
  check(`restoring ${relic === 'ancient helm' ? 'an ancient helm' : 'an old blade'} gives ${itemDef(id).name.toLowerCase()} on both sides, counted so`,
    !!g.inventory.find(id) && at(`RESTORED:${relic}`) === `${id}|1`, at(`RESTORED:${relic}`));
  const made = g.inventory.find(id);
  if (made) g.inventory.remove(made.uid, 1);
}
check('worn and wielded as a helm and a short sword are: slot, armour, damage, reach and hands the same',
  ARMOUR_BY_ID.get(ANCIENT_HELM)?.slot === ARMOUR_BY_ID.get('helm')?.slot && ARMOUR_BY_ID.get(ANCIENT_HELM)?.cls === ARMOUR_BY_ID.get('helm')?.cls
    && at(`ARMOUR:${ANCIENT_HELM}`) === at('ARMOUR:helm') && at('ARMOUR:helm') === 'head:plate'
    && WEAPON_BY_ID.get(ANCIENT_SWORD)?.damage === WEAPON_BY_ID.get('short_sword')?.damage
    && reachOf(WEAPON_BY_ID.get(ANCIENT_SWORD)!) === reachOf(WEAPON_BY_ID.get('short_sword')!)
    && !WEAPON_BY_ID.get(ANCIENT_SWORD)?.twoHanded && itemDef(ANCIENT_SWORD).weight === itemDef('short_sword').weight
    && itemDef(ANCIENT_HELM).weight === itemDef('helm').weight,
  `${at(`ARMOUR:${ANCIENT_HELM}`)} / ${at(`WEAPON:${ANCIENT_SWORD}`)} / ${at('WEAPON:short_sword')}`);
check(`a weapon row of its own on the island: a short sword's but its swing, ×${ANCIENT_SWORD_SWING}`,
  at(`WEAPON:${ANCIENT_SWORD}`) === `swords:8:${2 * ANCIENT_SWORD_SWING}:false:2.6` && at('WEAPON:short_sword') === 'swords:8:2:false:2.6'
    && near(WEAPON_BY_ID.get(ANCIENT_SWORD)!.swing, WEAPON_BY_ID.get('short_sword')!.swing * ANCIENT_SWORD_SWING),
  `${at(`WEAPON:${ANCIENT_SWORD}`)} / ${at('WEAPON:short_sword')}`);

// Nothing improves or repairs one.
check('the two sides count the same things as gear nothing mends', at('KINDS') === [...UNMENDABLE].sort().join(','), at('KINDS'));
for (const { id } of GEAR) {
  check(`and say why in the same words: ${unmendableSays({ id })}`,
    at(`SAYS:${id}`) === unmendableSays({ id }) && unmendableSays({ id }) === `${itemDef(id).name}: cannot be improved or repaired.`, at(`SAYS:${id}`));
}
check('neither is improvable on the island, and the plain ones are', at('IMPROVABLE') === 'helm,short_sword', at('IMPROVABLE'));

const pieces: Record<string, Item> = {};
for (const id of [ANCIENT_HELM, ANCIENT_SWORD, 'helm', 'short_sword']) {
  pieces[id] = g.inventory.add(id, { ql: QL });
  pieces[id].dmg = DMG;
}
g.inventory.add('file', { ql: 50 });
g.inventory.add('whetstone', { ql: 50 });
g.inventory.add('iron_lump', { ql: 50, count: 5 });
g.inventory.add('repair_kit', { ql: 50, count: 2 });
g.inventory.add('ancient_whetstone', { ql: 30 });

for (const [act, what] of ACTS) {
  const def = ACTION_BY_ID.get(act)!;
  for (const { id, plain } of GEAR) {
    const says = unmendableSays({ id });
    check(`${what} refuses ${itemDef(id).name.toLowerCase()} on both sides, in the same words, and the browser does not offer it`,
      def.check?.(on(pieces[id]), g) === says && at(`NO:${act}:${id}`) === says && !def.applies(on(pieces[id]), g),
      `${def.check?.(on(pieces[id]), g)} | ${at(`NO:${act}:${id}`)}`);
    check(`and the island turns it away at the door, nothing started`, at(`ACT:${act}:${id}`) === `${says}|idle`, at(`ACT:${act}:${id}`));
    check(`${what} still goes on a plain ${itemDef(plain).name.toLowerCase()} on both sides`,
      (def.check?.(on(pieces[plain]), g) ?? null) === null && at(`NO:${act}:${plain}`) === 'ALLOWED' && def.applies(on(pieces[plain]), g),
      `${def.check?.(on(pieces[plain]), g)} | ${at(`NO:${act}:${plain}`)}`);
  }
}
for (const { id, plain } of GEAR) {
  check(`Mend refuses ${itemDef(id).name.toLowerCase()} on both sides, in the same words`,
    castReason(g, mend, pieces[id]) === unmendableSays({ id }) && at(`NO:mend:${id}`) === unmendableSays({ id }), at(`NO:mend:${id}`));
  check(`and goes on a plain ${itemDef(plain).name.toLowerCase()}`, castReason(g, mend, pieces[plain]) === null && at(`NO:mend:${plain}`) === 'ALLOWED', at(`NO:mend:${plain}`));
}
check('neither is improvable in the browser, and the plain ones are',
  !canImprove(ANCIENT_HELM) && !canImprove(ANCIENT_SWORD) && canImprove('helm') && canImprove('short_sword'));

// The whetstone asks again as it is used: done anyway, it leaves both as they were and is kept.
const hone = ACTION_BY_ID.get('hone_whetstone')!;
hone.perform(on(pieces[ANCIENT_HELM]), g);
hone.perform(on(pieces[ANCIENT_SWORD]), g);
check('an ancient whetstone used on either anyway leaves it as it was and is kept, on both sides',
  pieces[ANCIENT_HELM].dmg === DMG && pieces[ANCIENT_SWORD].dmg === DMG && pieces[ANCIENT_HELM].ql === QL && g.inventory.countAll('ancient_whetstone') === 1
    && at('AS_WAS') === `${ANCIENT_HELM}:${DMG}:${QL},${ANCIENT_SWORD}:${DMG}:${QL}|1`, at('AS_WAS'));
ACTION_BY_ID.get('repair_item')!.perform(on(pieces.helm), g);
hone.perform(on(pieces.short_sword), g);
check('a plain helm is repaired and a plain short sword honed, the whetstone used up, on both sides',
  pieces.helm.dmg < DMG && pieces.short_sword.dmg === 0 && g.inventory.countAll('ancient_whetstone') === 0
    && at('PLAIN') === 'helm:true,short_sword:true|0', at('PLAIN'));

// A worker mending the stores.
{
  const ah = g.inventory.add(ANCIENT_HELM, { ql: QL });
  const h = g.inventory.add('helm', { ql: QL });
  ah.dmg = 60;
  h.dmg = 20;
  const store = { x: 16, y: 16, centre: [16.5, 16.5], items: [ah, h], name: 'Home', deed: true } as unknown as DeedStore;
  (g as unknown as { deedStores: () => DeedStore[] }).deedStores = () => [store];
  check('a worker mending the stores passes an ancient helm by for the worst of the rest, on both sides',
    g.damagedInStores()?.item.id === 'helm' && at('STORES') === 'helm', `${g.damagedInStores()?.item.id} | ${at('STORES')}`);
  h.dmg = 0;
  check('and finds nothing when it is all there is, on both sides', g.damagedInStores() === undefined && at('STORES:ancient') === 'nothing', at('STORES:ancient'));
  check('and mends none in the go it is sent on (`errand_do`)', at('ERRAND') === 'true', at('ERRAND'));
}

// Sight.
{
  const bare = g.vision.sightRange();
  const helm = g.inventory.add(ANCIENT_HELM, { ql: QL });
  const carried = g.vision.sightRange();
  g.equip('head', helm.uid);
  const worn = g.vision.sightRange();
  g.equip('head', pieces.helm.uid);
  const plain = g.vision.sightRange();
  check(`an ancient helm worn: sight radius +${ANCIENT_HELM_SIGHT} tiles`, near(worn - bare, ANCIENT_HELM_SIGHT), `${bare.toFixed(2)} → ${worn.toFixed(2)}`);
  check('carried and not worn, nothing; a plain helm worn, nothing', near(carried, bare) && near(plain, bare), `${carried.toFixed(2)} / ${plain.toFixed(2)}`);
  g.equip('head', null);
}

// Swing.
{
  const attack = ACTION_BY_ID.get('attack_creature')!;
  g.equip('weapon', pieces[ANCIENT_SWORD].uid);
  const ancient = fightBase(g, attack) ?? 0;
  g.equip('weapon', pieces.short_sword.uid);
  const plain = fightBase(g, attack) ?? 0;
  check(`an ancient short sword swings in ×${ANCIENT_SWORD_SWING} a short sword's time, on both sides`,
    near(ancient, plain * ANCIENT_SWORD_SWING) && near(Number(at(`SWING:${ANCIENT_SWORD}`)), Number(at('SWING:short_sword')) * ANCIENT_SWORD_SWING)
      && near(ancient, Number(at(`SWING:${ANCIENT_SWORD}`))), `${ancient} / ${at(`SWING:${ANCIENT_SWORD}`)}`);
  check('a short sword as before, on both sides', near(plain, WEAPON_BY_ID.get('short_sword')!.swing) && near(Number(at('SWING:short_sword')), plain),
    `${plain} / ${at('SWING:short_sword')}`);
}

// What each says of itself.
{
  const helmSays = itemDef(ANCIENT_HELM).description ?? '';
  const swordSays = itemDef(ANCIENT_SWORD).description ?? '';
  const sword = WEAPON_BY_ID.get(ANCIENT_SWORD)!;
  check('the ancient helm says its sight, from the rule, the same on both sides',
    helmSays === `Worn: sight radius +${ANCIENT_HELM_SIGHT} tiles. Cannot be improved or repaired.` && at(`DESC:${ANCIENT_HELM}`) === helmSays, at(`DESC:${ANCIENT_HELM}`));
  check('the ancient short sword says its swing, from the rule, the same on both sides',
    swordSays.includes(`a blow every ${sword.swing} seconds`) && swordSays.includes(`Swing time −${Math.round((1 - ANCIENT_SWORD_SWING) * 100)}% against a short sword.`)
      && swordSays.endsWith('Cannot be improved or repaired.') && !swordSays.includes('{') && at(`DESC:${ANCIENT_SWORD}`) === swordSays, at(`DESC:${ANCIENT_SWORD}`));
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`an ancient helm and an ancient short sword — ${ok.length} of ${ok.length}`);
