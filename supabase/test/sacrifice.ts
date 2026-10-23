/**
 * Sacrifice at the altar, and souls.
 *
 * Asked for: rare, supreme and fantastic things given up at the altar; each
 * one fills every nutrient to the top; one in a hundred leaves a soul of the
 * same rarity; a soul absorbed into an ordinary thing gives it that rarity.
 * What this asks, of both sides and in the same words:
 *
 *   * the share of sacrifices that leave a soul, and the nutrients a sacrifice
 *     fills, are the same numbers on the island as in the browser;
 *   * a sacrifice is made only kneeling at an altar, of a thing in the pack
 *     that is rare or better -- never a soul, a locked thing, a worn one or a
 *     bag with something in it -- and gives up one, of a stack one;
 *   * it fills all four nutrients to the top, and says so;
 *   * when a soul comes of it, it is of the rarity of what was given up;
 *   * a soul goes only into an ordinary thing, never another soul, a bauble or
 *     a thing that is rare already; one of a stack takes it, the rest stay as
 *     they were, and a thing on its own takes it where it is; the soul is used.
 *
 * Runs against the database the suite leaves behind, and puts it back.
 */
import { execFileSync } from 'node:child_process';
import { Game, type Deed } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { NUTRIENTS } from '../../src/game/nutrition';
import { ABSORB_SAID, alreadyRare, FED_SAID, SACRIFICE_SAID, SOUL, SOUL_CHANCE } from '../../src/game/sacrifice';
import { ITEM_DEFS, RARITIES, type Item } from '../../src/game/items';
import { STORES } from '../../src/game/furniture';
import { packLand, packWorld, unpack } from '../../src/game/save';

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

/* ---- the same numbers ------------------------------------------------------ */
check('the island leaves a soul as often as the browser', psql('select soul_chance()') === String(SOUL_CHANCE), psql('select soul_chance()'));
check('and fills the same nutrients', psql(`select array_to_string(nutrients(), ',')`) === NUTRIENTS.join(','), psql(`select array_to_string(nutrients(), ',')`));
check('and says so in the same words', psql('select fed_said()') === FED_SAID, psql('select fed_said()'));
check('a soul is called a soul on both sides, not taken for a swirl\'s mote',
  psql(`select name from item_def where id = '${SOUL}'`) === 'Soul' && ITEM_DEFS[SOUL].name === 'Soul', psql(`select name from item_def where id = '${SOUL}'`));
check('and Absorb a soul is its job, on both sides',
  psql(`select label from action_def where id = 'absorb_soul'`) === 'Absorb a soul' && ACTION_BY_ID.get('absorb_soul')?.label === 'Absorb a soul', psql(`select label from action_def where id = 'absorb_soul'`));
check('a soul is a thing both sides know, and stacks by its rarity', psql(`select stackable from item_def where id = '${SOUL}'`) === 't');
const gone = psql(`select (select count(*) from item_def where id = 'mote') || '|' || (select count(*) from action_def where id = 'absorb_mote')
  || '|' || (select count(*) from pg_proc where proname = 'mote_chance')`);
check('and nothing is a mote by id any more: no item, job or chance of that name on either side',
  gone === '0|0|0' && !('mote' in ITEM_DEFS) && !ACTION_BY_ID.has('absorb_mote') && SOUL === 'soul', gone);

/* ---- the island ------------------------------------------------------------- */
const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid; alt bigint; box bigint; axe bigint; planks bigint; plain bigint; kept bigint; worn bigint;
        bag bigint; soul bigint; stack bigint; single bigint; bauble bigint; j jsonb; v_n int;
begin
  -- The suite's own island, by name, and somebody on it.
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set body_at = now(), x = 8.5, y = 8.5, act = null, act_queue = '[]', equipped = '{}'::jsonb,
         nutrition = '{"starch": 0.2, "flesh": 0.1, "fat": 0, "greens": 0.5}'::jsonb
   where world_id = w and uid = u;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'altar', 9, 8, 0, 0, 9.5, 8.5, 50, u) returning id into alt;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', 7, 8, 0, 0, 7.5, 8.5, 50, u) returning id into box;

  axe := give(w, u, 'hatchet', 1, 40, null, 'rare');
  planks := give(w, u, 'plank', 3, 40, null, 'supreme');
  plain := give(w, u, 'plank', 5, 40);
  kept := give(w, u, 'shovel', 1, 40, null, 'rare');
  update item set locked = true where id = kept;
  worn := give(w, u, 'pickaxe', 1, 40, null, 'fantastic');
  update player set equipped = jsonb_build_object('weapon', worn) where world_id = w and uid = u;
  bag := give(w, u, 'satchel', 1, 40, null, 'rare');
  insert into item (world_id, holder, holder_uid, inside, def, ql, count) values (w, 'player', u, bag, 'nail', 20, 3);
  soul := give(w, u, 'soul', 1, 40, null, 'rare');

  -- What is refused.
  insert into said values ('NOTALTAR', coalesce(act_refusal(w, u, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', box, 'itemUid', axe)), 'null'));
  update player set body_at = now(), x = 12.5, y = 12.5 where world_id = w and uid = u;
  insert into said values ('REACH', coalesce(act_refusal(w, u, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', axe)), 'null'));
  update player set body_at = now(), x = 8.5, y = 8.5 where world_id = w and uid = u;
  insert into said values ('PICK', coalesce(act_refusal(w, u, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', alt)), 'null'));
  insert into said values ('SOUL_GIVEN', coalesce(act_refusal(w, u, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', soul)), 'null'));
  insert into said values ('PLAIN', coalesce(act_refusal(w, u, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', plain)), 'null'));
  insert into said values ('LOCKED', coalesce(act_refusal(w, u, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', kept)), 'null'));
  insert into said values ('WORN', coalesce(act_refusal(w, u, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', worn)), 'null'));
  insert into said values ('FULL', coalesce(act_refusal(w, u, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', bag)), 'null'));

  -- A rare hatchet given up: gone, and every nutrient full; no soul, whatever the dice say.
  create or replace function soul_chance() returns double precision language sql immutable as 'select 0::double precision';
  j := jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', axe);
  insert into said values ('AXE', coalesce(act_refusal(w, u, 'sacrifice', j), 'null'));
  perform act_perform(w, u, 'sacrifice', j);
  insert into said select 'AXEGONE', count(*)::text from item where id = axe;
  insert into said select 'FED', (select string_agg(k || '=' || (nutrition->>k), ',' order by o)
    from unnest(nutrients()) with ordinality n(k, o)) from player where world_id = w and uid = u;
  insert into said select 'AXESAID', e.text from event e where e.world_id = w and e.uid = u and e.kind = 'event' order by e.n desc limit 1;

  -- One of the supreme planks, and a soul left, whatever the dice say.
  create or replace function soul_chance() returns double precision language sql immutable as 'select 1::double precision';
  update player set nutrition = '{}'::jsonb where world_id = w and uid = u;
  perform act_perform(w, u, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', planks));
  insert into said select 'PLANKSLEFT', count::text from item where id = planks;
  insert into said select 'SOULS', string_agg(coalesce(rare, 'plain') || ' x' || count, ',' order by rare)
    from item where world_id = w and holder = 'player' and holder_uid = u and def = 'soul';
  insert into said select 'SOULSAID', e.text from event e where e.world_id = w and e.uid = u and e.kind = 'event' order by e.n desc limit 1;
  insert into said select 'FEDAGAIN', (select bool_and((nutrition->>k)::double precision = 1) from unnest(nutrients()) k)::text
    from player where world_id = w and uid = u;

  -- Absorbing one.
  select id into soul from item where world_id = w and holder = 'player' and holder_uid = u and def = 'soul' and rare = 'supreme';
  insert into said values ('PICKSOUL', coalesce(act_refusal(w, u, 'absorb_soul', jsonb_build_object('kind', 'item', 'uid', plain, 'soul', plain)), 'null'));
  insert into said values ('PICKITEM', coalesce(act_refusal(w, u, 'absorb_soul', jsonb_build_object('kind', 'item', 'uid', -1, 'soul', soul)), 'null'));
  insert into said values ('INTOSOUL', coalesce(act_refusal(w, u, 'absorb_soul', jsonb_build_object('kind', 'item', 'uid', soul, 'soul', soul)), 'null'));
  bauble := give(w, u, 'bauble_minor', 1, 40, 'cooking: +2.1% skill gain');
  insert into said values ('BAUBLE', coalesce(act_refusal(w, u, 'absorb_soul', jsonb_build_object('kind', 'item', 'uid', bauble, 'soul', soul)), 'null'));
  insert into said values ('ALREADY', coalesce(act_refusal(w, u, 'absorb_soul', jsonb_build_object('kind', 'item', 'uid', kept, 'soul', soul)), 'null'));
  j := jsonb_build_object('kind', 'item', 'uid', plain, 'soul', soul);
  insert into said values ('ABSORB', coalesce(act_refusal(w, u, 'absorb_soul', j), 'null'));
  perform act_perform(w, u, 'absorb_soul', j);
  insert into said select 'SPLIT', string_agg(coalesce(rare, 'plain') || ' x' || count, ',' order by coalesce(rare, 'plain'))
    from item where world_id = w and holder = 'player' and holder_uid = u and def = 'plank';
  insert into said select 'SOULUSED', count(*)::text from item where world_id = w and holder = 'player' and holder_uid = u and def = 'soul' and rare = 'supreme';
  insert into said select 'ABSORBSAID', e.text from event e where e.world_id = w and e.uid = u and e.kind = 'event' order by e.n desc limit 1;
  -- A thing on its own takes it where it is.
  soul := give(w, u, 'soul', 1, 40, null, 'fantastic');
  single := give(w, u, 'hatchet', 1, 40);
  perform act_perform(w, u, 'absorb_soul', jsonb_build_object('kind', 'item', 'uid', single, 'soul', soul));
  insert into said select 'SINGLE', coalesce((select rare from item where id = single), 'plain');
end $$;
select k || E'\\t' || coalesce(v, 'null') from said;
rollback;
`);
const said = new Map(out.split('\n').filter(Boolean).map((l) => {
  const at = l.indexOf('\t');
  return [l.slice(0, at), l.slice(at + 1)] as [string, string];
}));
const say = (k: string): string => said.get(k) ?? '(nothing)';

check('a chest is not an altar', say('NOTALTAR') === SACRIFICE_SAID.notAltar, say('NOTALTAR'));
check('a sacrifice is made kneeling at the altar', say('REACH') === SACRIFICE_SAID.reach, say('REACH'));
check('of something', say('PICK') === SACRIFICE_SAID.pick, say('PICK'));
check('never a soul', say('SOUL_GIVEN') === SACRIFICE_SAID.soul, say('SOUL_GIVEN'));
check('nor anything ordinary', say('PLAIN') === SACRIFICE_SAID.notRare, say('PLAIN'));
check('nor a thing put by', say('LOCKED') === SACRIFICE_SAID.locked, say('LOCKED'));
check('nor one worn', say('WORN') === SACRIFICE_SAID.worn, say('WORN'));
check('nor a bag with something in it', say('FULL') === SACRIFICE_SAID.full, say('FULL'));
check('a rare hatchet may be given up', say('AXE') === 'null', say('AXE'));
check('and is gone', say('AXEGONE') === '0', say('AXEGONE'));
check('and every nutrient is full', say('FED') === NUTRIENTS.map((k) => `${k}=1`).join(','), say('FED'));
check('said as the browser says it', say('AXESAID') === `Sacrificed: rare hatchet. ${FED_SAID}`, say('AXESAID'));
check('of a stack, one is given up', say('PLANKSLEFT') === '2', say('PLANKSLEFT'));
check('and a soul left is of the rarity of what was given up', say('SOULS') === 'rare x1,supreme x1', say('SOULS'));
check('and says so', say('SOULSAID') === 'Got: supreme soul.', say('SOULSAID'));
check('every nutrient full again from empty', say('FEDAGAIN') === 'true', say('FEDAGAIN'));
check('a soul is absorbed only from a soul', say('PICKSOUL') === ABSORB_SAID.pickSoul, say('PICKSOUL'));
check('into something', say('PICKITEM') === ABSORB_SAID.pickItem, say('PICKITEM'));
check('never another soul', say('INTOSOUL') === ABSORB_SAID.intoSoul, say('INTOSOUL'));
check('nor a bauble', say('BAUBLE') === ABSORB_SAID.bauble, say('BAUBLE'));
check('nor a thing already rare', say('ALREADY') === alreadyRare({ rare: 1 }), say('ALREADY'));
check('an ordinary stack takes it', say('ABSORB') === 'null', say('ABSORB'));
check('one of it, and the rest stay as they were', say('SPLIT') === 'plain x4,supreme x2,supreme x1' || say('SPLIT') === 'plain x4,supreme x1,supreme x2', say('SPLIT'));
check('and the soul is used up', say('SOULUSED') === '0', say('SOULUSED'));
check('said as the browser says it', say('ABSORBSAID') === 'Absorbed: supreme soul into plank. Now supreme.', say('ABSORBSAID'));
check('a thing on its own takes it where it is', say('SINGLE') === 'fantastic', say('SINGLE'));

/* ---- the browser ------------------------------------------------------------ */
const game = Game.create(4242);
const home: Deed = { name: 'Home', x: 40, y: 40, radius: 3, level: 1, mine: true };
game.deed = home;
game.player.x = 40.5; game.player.y = 40.5;
const altar = game.addFurniture('altar', 41, 40, 0, 0, 50);
const chest = game.addFurniture('chest', 39, 40, 0, 0, 50);
const sac = ACTION_BY_ID.get('sacrifice')!;
const absorb = ACTION_BY_ID.get('absorb_soul')!;
const at = (id: number, itemUid?: number): Target => ({ kind: 'furniture', id, ...(itemUid === undefined ? {} : { itemUid }) } as Target);
// The last event line: a sacrifice teaches soul strength, which may land a knack after it (`earnKnacks`).
const lastSaid = (): string => game.log.filter((l) => l.kind === 'event').pop()?.text ?? '';
const rare = (id: string, step: number, count = 1) => {
  const it = game.inventory.add(id, { ql: 40, count });
  const one = game.inventory.take(it.uid, count)!;
  one.rare = step;
  return game.inventory.addItem(one);
};
for (const it of [...game.inventory.items]) game.inventory.remove(it.uid, it.count);
const axe = rare('hatchet', 1);
const planks = rare('plank', 2, 3);
const plain = game.inventory.add('plank', { ql: 40, count: 5 });
const kept = rare('shovel', 1);
kept.locked = true;
const worn = rare('pickaxe', 3);
game.player.equipped.weapon = worn.uid;
const bag = rare('satchel', 1);
bag.inside = [{ uid: game.inventory.nextUid++, id: 'nail', ql: 20, dmg: 0, count: 3 }];
const soul1 = rare(SOUL, 1);
check('the browser: a chest is not an altar', sac.check?.(at(chest.id, axe.uid), game) === SACRIFICE_SAID.notAltar);
game.player.x = 44.5; game.player.y = 44.5;
check('kneel at the altar', sac.check?.(at(altar.id, axe.uid), game) === SACRIFICE_SAID.reach);
game.player.x = 40.5; game.player.y = 40.5;
check('of something', sac.check?.(at(altar.id), game) === SACRIFICE_SAID.pick);
check('never a soul', sac.check?.(at(altar.id, soul1.uid), game) === SACRIFICE_SAID.soul);
check('nor anything ordinary', sac.check?.(at(altar.id, plain.uid), game) === SACRIFICE_SAID.notRare);
check('nor a thing put by', sac.check?.(at(altar.id, kept.uid), game) === SACRIFICE_SAID.locked);
check('nor one worn', sac.check?.(at(altar.id, worn.uid), game) === SACRIFICE_SAID.worn);
check('nor a bag with something in it', sac.check?.(at(altar.id, bag.uid), game) === SACRIFICE_SAID.full);
const crate = game.inventory.add('creature_crate', { ql: 40 });
crate.rare = 1;
crate.creature = 1;
check('nor a crate with a wildermon in it', sac.check?.(at(altar.id, crate.uid), game) === SACRIFICE_SAID.creature);
for (const k of NUTRIENTS) game.player.nutrition[k] = 0.1;
game.rand = () => 0.5;
check('a rare hatchet may be given up', sac.check?.(at(altar.id, axe.uid), game) === null);
sac.perform(at(altar.id, axe.uid), game);
check('it is gone, and every nutrient is full, said as the island says it',
  !game.inventory.get(axe.uid) && NUTRIENTS.every((k) => game.player.nutrition[k] === 1) && lastSaid() === say('AXESAID'), lastSaid());
game.rand = () => 0;
sac.perform(at(altar.id, planks.uid), game);
const souls = game.inventory.items.filter((it) => it.id === SOUL);
check('of a stack, one is given up, and a soul left of its rarity, said as the island says it',
  game.inventory.get(planks.uid)?.count === 2 && souls.some((m) => m.rare === 2) && lastSaid() === say('SOULSAID'), lastSaid());
const soul2 = souls.find((m) => m.rare === 2)!;
check('a soul is absorbed only from a soul', absorb.check?.({ kind: 'item', uid: plain.uid, soul: plain.uid }, game) === ABSORB_SAID.pickSoul);
check('into something', absorb.check?.({ kind: 'item', uid: -1, soul: soul2.uid }, game) === ABSORB_SAID.pickItem);
check('never another soul', absorb.check?.({ kind: 'item', uid: soul2.uid, soul: soul2.uid }, game) === ABSORB_SAID.intoSoul);
const bauble = game.inventory.add('bauble_minor', { ql: 40, extra: 'cooking: +2.1% skill gain' });
check('nor a bauble', absorb.check?.({ kind: 'item', uid: bauble.uid, soul: soul2.uid }, game) === ABSORB_SAID.bauble);
check('nor a thing already rare, in the island\'s words', absorb.check?.({ kind: 'item', uid: kept.uid, soul: soul2.uid }, game) === say('ALREADY'));
absorb.perform({ kind: 'item', uid: plain.uid, soul: soul2.uid }, game);
const planksNow = game.inventory.items.filter((it) => it.id === 'plank').map((it) => `${it.rare ? RARITIES[it.rare].name : 'plain'} x${it.count}`).sort();
check('one of an ordinary stack takes it, and the soul is used, said as the island says it',
  planksNow.includes('plain x4') && planksNow.some((p) => p.startsWith('supreme')) && !game.inventory.get(soul2.uid) && lastSaid() === say('ABSORBSAID'),
  `${planksNow.join(', ')} | ${lastSaid()}`);
const soul3 = rare(SOUL, 3);
const single = game.inventory.add('hatchet', { ql: 40 });
absorb.perform({ kind: 'item', uid: single.uid, soul: soul3.uid }, game);
check('a thing on its own takes it where it is', game.inventory.get(single.uid)?.rare === 3);

// And how often, in the browser, over many.
let left = 0;
const g2 = Game.create(99);
g2.player.x = 40.5; g2.player.y = 40.5;
const alt2 = g2.addFurniture('altar', 41, 40, 0, 0, 50);
const N = 20000;
const pile = g2.inventory.add('plank', { ql: 40, count: N });
const pileRare = g2.inventory.take(pile.uid, N)!;
pileRare.rare = 1;
g2.inventory.addItem(pileRare);
for (let i = 0; i < N; i++) sac.perform(at(alt2.id, pileRare.uid), g2);
left = g2.inventory.items.filter((it) => it.id === SOUL).reduce((n, it) => n + it.count, 0);
check(`about ${SOUL_CHANCE * 100}% of sacrifices leave a soul`, Math.abs(left / N - SOUL_CHANCE) < 0.004, `${left} of ${N}`);

/* ---- every rarity, as a body asks for it ------------------------------------- */
// Through the ask a body makes (\`rpc_act\`, settled), not the job alone: each of rare, supreme and fantastic given up
// leaves a soul of its own rarity when the dice say so, and that soul, absorbed, makes an ordinary thing that rarity.
const asked = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid; alt bigint; it bigint; plain bigint; soul bigint; r text; i int;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = 8.5, y = 8.5, body_at = now(), act = null, act_queue = '[]', equipped = '{}'::jsonb,
         stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1'), nutrition = '{}'::jsonb
   where world_id = w and uid = u;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'altar', 9, 8, 0, 0, 9.5, 8.5, 50, u) returning id into alt;
  create or replace function soul_chance() returns double precision language sql immutable as 'select 1::double precision';
  foreach r in array array['rare', 'supreme', 'fantastic'] loop
    it := give(w, u, 'hatchet', 1, 40, null, r);
    update player set nutrition = '{}'::jsonb where world_id = w and uid = u;
    insert into said values ('ASK_' || r, coalesce(rpc_act(w, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', it))->>'why', 'started'));
    for i in 1 .. 5 loop
      exit when (select act from player where world_id = w and uid = u) is null;
      update player set act_ends = now() - interval '1 second' where world_id = w and uid = u;
      perform settle(w, u);
    end loop;
    insert into said select 'GONE_' || r, count(*)::text from item where id = it;
    insert into said select 'FED_' || r, (select bool_and((nutrition->>k)::double precision = 1) from unnest(nutrients()) k)::text
      from player where world_id = w and uid = u;
    insert into said select 'SOUL_' || r, coalesce(sum(count), 0)::text from item
     where world_id = w and holder = 'player' and holder_uid = u and def = 'soul' and rare = r;
    -- And that soul, absorbed into an ordinary thing, makes it the same.
    select id into soul from item where world_id = w and holder = 'player' and holder_uid = u and def = 'soul' and rare = r limit 1;
    plain := give(w, u, 'shovel', 1, 40);
    insert into said values ('INTO_' || r, coalesce(rpc_act(w, 'absorb_soul', jsonb_build_object('kind', 'item', 'uid', plain, 'soul', soul))->>'why', 'started'));
    for i in 1 .. 5 loop
      exit when (select act from player where world_id = w and uid = u) is null;
      update player set act_ends = now() - interval '1 second' where world_id = w and uid = u;
      perform settle(w, u);
    end loop;
    insert into said select 'TOOK_' || r, coalesce(rare, 'plain') from item where id = plain;
  end loop;
end $$;
select k || E'\\t' || coalesce(v, 'null') from said;
rollback;
`);
const asks = new Map(asked.split('\n').filter(Boolean).map((l) => {
  const at = l.indexOf('\t');
  return [l.slice(0, at), l.slice(at + 1)] as [string, string];
}));
for (const [step, r] of RARITIES.slice(1).map((x, i) => [i + 1, x.name] as const)) {
  check(`on the island, asked for: a ${r} thing given up is gone, every nutrient full, and a ${r} soul left`,
    asks.get(`ASK_${r}`) === 'started' && asks.get(`GONE_${r}`) === '0' && asks.get(`FED_${r}`) === 'true' && asks.get(`SOUL_${r}`) === '1',
    `${asks.get(`ASK_${r}`)} gone=${asks.get(`GONE_${r}`)} fed=${asks.get(`FED_${r}`)} souls=${asks.get(`SOUL_${r}`)}`);
  check(`and the ${r} soul, absorbed, makes an ordinary shovel ${r}`,
    asks.get(`INTO_${r}`) === 'started' && asks.get(`TOOK_${r}`) === r, `${asks.get(`INTO_${r}`)} ${asks.get(`TOOK_${r}`)}`);
  // The browser, through the same ask.
  const g3 = Game.create(7 + step);
  g3.player.x = 40.5; g3.player.y = 40.5;
  for (const x of [...g3.inventory.items]) g3.inventory.remove(x.uid, x.count);
  const alt3 = g3.addFurniture('altar', 41, 40, 0, 0, 50);
  const one = g3.inventory.add('hatchet', { ql: 40 });
  one.rare = step;
  for (const k of NUTRIENTS) g3.player.nutrition[k] = 0;
  g3.rand = () => 0;
  const run = (): void => {
    for (let i = 0; i < 4000 && g3.action; i++) {
      g3.player.stats.stamina = 1;
      g3.update(0.05);
    }
  };
  g3.requestAction(sac, at(alt3.id, one.uid));
  run();
  const fed = NUTRIENTS.map((k) => g3.player.nutrition[k]);
  const left3 = g3.inventory.items.find((x) => x.id === SOUL);
  const shovel = g3.inventory.add('shovel', { ql: 40 });
  if (left3) g3.requestAction(absorb, { kind: 'item', uid: shovel.uid, soul: left3.uid } as Target);
  run();
  check(`in the browser, asked for: a ${r} thing given up leaves a ${r} soul, every nutrient full, and it makes a shovel ${r}`,
    !g3.inventory.get(one.uid) && left3?.rare === step && fed.every((v) => v > 0.999) && g3.inventory.get(shovel.uid)?.rare === step,
    `gone ${!g3.inventory.get(one.uid)} fed ${fed.map((v) => v.toFixed(4)).join(',')} soul ${left3?.rare} shovel ${g3.inventory.get(shovel.uid)?.rare}`);
}

// And how often on the island, with its own dice: about one in a hundred.
const M = 4000;
const islandLeft = Number(psql(`
begin;
do $$
declare w uuid; u uuid; alt bigint; it bigint; i int;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set body_at = now(), x = 8.5, y = 8.5, act = null, act_queue = '[]', equipped = '{}'::jsonb where world_id = w and uid = u;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'altar', 9, 8, 0, 0, 9.5, 8.5, 50, u) returning id into alt;
  it := give(w, u, 'plank', ${M}, 40, null, 'rare');
  for i in 1 .. ${M} loop
    perform act_perform(w, u, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', it));
  end loop;
  create temp table counted as select coalesce(sum(count), 0) as n from item where world_id = w and holder = 'player' and holder_uid = u and def = 'soul';
end $$;
select n from counted;
rollback;
`).split('\n').filter(Boolean).pop());
check(`on the island about ${SOUL_CHANCE * 100}% of sacrifices leave a soul, by its own dice`,
  Math.abs(islandLeft / M - SOUL_CHANCE) < 0.006, `${islandLeft} of ${M}`);

/* ---- a save from before ---------------------------------------------------- */
// What a sacrifice left was the item `mote` once; a save that holds one, in the pack or put by in a store, comes back
// holding a soul of the same rarity (`finish`, in `save.ts`).
const old = Game.create(5);
const store = STORES[STORES.length - 1];
const oldChest = old.addFurniture(store.id, Math.floor(old.player.x) + 2, Math.floor(old.player.y), 0.5, 0.5, 30);
old.inventory.addItem({ uid: old.inventory.nextUid++, id: 'mote', ql: 40, dmg: 0, count: 2, rare: 2 });
oldChest.items.push({ uid: old.inventory.nextUid++, id: 'mote', ql: 40, dmg: 0, count: 1, rare: 3 });
const back = await unpack(await packLand(old), packWorld(old));
const heldSouls = (items: Item[] | undefined): string => (items ?? []).filter((it) => it.id === SOUL || it.id === 'mote')
  .map((it) => `${it.id}:${it.rare}x${it.count}`).join(',');
const backChest = back ? [...back.furniture.values()].find((f) => f.kind === store.id) : undefined;
check(`a save from before holding motes, in the pack and in a ${store.name.toLowerCase()}, comes back holding souls of the same rarity`,
  heldSouls(back?.inventory.items) === 'soul:2x2' && heldSouls(backChest?.items) === 'soul:3x1',
  `pack ${heldSouls(back?.inventory.items)}, store ${heldSouls(backChest?.items)}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
if (bad.length) process.exit(1);
