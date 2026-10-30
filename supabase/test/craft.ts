/**
 * Fourteen trades, and one of them yours.
 *
 * A class is a card locked into a slot: one craft trade and, when they land,
 * one combat trade. It opens at fifty in any skill it covers, the first one in
 * a slot is free, and swapping uses a Bauble of Regret and no silver.
 *
 * What this asks:
 *
 *   * both sides hold the same fourteen trades, skill for skill -- the browser
 *     from `CRAFT_CLASSES`, the island from `class_def` and `class_skill`;
 *   * every craft skill belongs to exactly one trade, and what is left over is
 *     exactly the twenty-two the combat trades are drawn from, so no skill can
 *     ever gate two cards;
 *   * a card is shut below fifty and open on it, in the same words on both
 *     sides;
 *   * the first trade is free, the same trade twice is refused, a swap with no
 *     Bauble of Regret is refused in the browser's words and takes nothing, and
 *     a swap with one breaks it, leaves the purse as it was, and says so in the
 *     browser's words.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { CRAFT_CLASSES, CLASS_AT, classDef, classRefusal } from '../../src/game/classes';
import { classChanged, REGRET, REGRET_SAID } from '../../src/game/baubles';

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

/*
 * The skills that belong to no trade at all, craft or fighting.
 *
 * The craft side partitions cleanly -- every one of its forty skills is
 * in exactly one trade -- and the fighting side deliberately does not. These
 * thirteen are the body and the soul, common to all twenty-one, and `fighting` in
 * particular *could not* be owned even if it should be: it is the scope key
 * every melee swing carries, so a trade that held it would move everybody's
 * numbers rather than its own.
 */
const NOBODY_OWNS = [
  'body_control', 'body_stamina', 'body_strength', 'fighting',
  'meditation', 'mind_logic', 'prayer', 'praying', 'swimming', 'driving', 'sailing', 'elementalism',
  // Enchanting (`enchant.ts`), the soul's as elementalism is.
  'enchanting',
].sort();

const out = psql(`
begin;
create temp table said (k text);

-- 1. The list, as the island holds it.
insert into said select 'LIST|' || string_agg(c.id || ':' || c.main || ':' ||
  (select string_agg(cs.skill, '+' order by cs.skill) from class_skill cs where cs.class = c.id),
  '|' order by c.id) from class_def c where c.kind = 'craft';
insert into said select 'NUMBERS|' || class_at()::int;
insert into said select 'LEFTOVER|' || coalesce(string_agg(s.id, ',' order by s.id), 'none')
  from skill_def s where not exists (select 1 from class_skill cs where cs.skill = s.id);

-- 2. Somebody to hand a trade to, with a skill nowhere near fifty.
do $$
declare w record; v_low double precision; v_said jsonb; v_purse bigint;
begin
  select p.world_id, p.uid into w from player p limit 1;
  delete from skill where world_id = w.world_id and uid = w.uid and id = 'digging';
  update player set craft_class = null, combat_class = null where world_id = w.world_id and uid = w.uid;
  delete from item where world_id = w.world_id and holder = 'player' and holder_uid = w.uid and def in ('coin', '${REGRET}');
  perform set_config('request.jwt.claims', json_build_object('sub', w.uid)::text, false);

  insert into said values ('SHUT|' || coalesce(class_refusal(w.world_id, w.uid, 'terraformer'), 'open'));
  v_said := rpc_take_class(w.world_id, 'terraformer');
  insert into said values ('SHUTTOOK|' || coalesce(v_said->>'why', 'IT WENT THROUGH'));

  -- Fifty in one skill it covers, and the card is on the table.
  insert into skill (world_id, uid, id, value) values (w.world_id, w.uid, 'digging', class_at())
    on conflict (world_id, uid, id) do update set value = class_at();
  insert into said values ('OPEN|' || coalesce(class_refusal(w.world_id, w.uid, 'terraformer'), 'open'));

  v_said := rpc_take_class(w.world_id, 'terraformer');
  insert into said values ('FIRST|' || coalesce(v_said->>'took', 'nothing') || '|'
    || coalesce(v_said->>'regret', '?') || '|' || coalesce(v_said->>'why', '-'));
  insert into said select 'SLOTS|' || coalesce(craft_class, 'none') || '|' || coalesce(combat_class, 'none')
    from player where world_id = w.world_id and uid = w.uid;

  -- The same one twice.
  v_said := rpc_take_class(w.world_id, 'terraformer');
  insert into said values ('AGAIN|' || coalesce(v_said->>'why', 'IT WENT THROUGH'));

  -- A swap with no Bauble of Regret, and silver in the purse that buys nothing.
  insert into skill (world_id, uid, id, value) values (w.world_id, w.uid, 'mining', class_at())
    on conflict (world_id, uid, id) do update set value = class_at();
  perform give_coins(w.world_id, w.uid, 5007);
  insert into said values ('CARDWHY|' || coalesce((select c->>'why' from jsonb_array_elements(rpc_classes(w.world_id)->'classes') c
    where c->>'id' = 'miner'), 'none'));
  v_said := rpc_take_class(w.world_id, 'miner');
  insert into said select 'BROKE|' || coalesce(v_said->>'why', 'IT WENT THROUGH') || '|'
    || coalesce(craft_class, 'none') from player where world_id = w.world_id and uid = w.uid;

  -- And with one: the bauble is used, and the purse is not.
  perform give(w.world_id, w.uid, '${REGRET}', 1, 40);
  insert into said values ('CARDOPEN|' || coalesce((select c->>'why' from jsonb_array_elements(rpc_classes(w.world_id)->'classes') c
    where c->>'id' = 'miner'), 'none'));
  v_purse := purse(w.world_id, w.uid);
  v_said := rpc_take_class(w.world_id, 'miner');
  insert into said select 'PAID|' || coalesce(v_said->>'took', 'nothing') || '|'
    || coalesce(v_said->>'regret', '?') || '|' || (v_purse - purse(w.world_id, w.uid)) || '|'
    || coalesce(craft_class, 'none') || '|'
    || (select count(*) from item i where i.world_id = w.world_id and i.holder = 'player' and i.holder_uid = w.uid and i.def = '${REGRET}')
    from player where world_id = w.world_id and uid = w.uid;
  insert into said select 'PAIDSAID|' || e.text from event e where e.world_id = w.world_id and e.uid = w.uid
    and e.text like 'Class changed:%' order by e.n desc limit 1;
end $$;

select * from said;
rollback;
`);

const said = (key: string): string =>
  out.split('\n').find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? 'MISSING';

/* The island's list, in the same shape the browser's makes. */
const island = said('LIST').split('|').sort();
const browser = CRAFT_CLASSES
  .map((c) => `${c.id}:${c.main}:${[...c.skills].sort().join('+')}`).sort();
check('both sides hold the same fourteen trades, skill for skill',
  island.join() === browser.join(),
  island.join() === browser.join() ? `${island.length} of them`
    : `island ${island.length}, browser ${browser.length}; first difference ${
      island.find((s, i) => s !== browser[i]) ?? '-'} vs ${browser.find((s, i) => s !== island[i]) ?? '-'}`);

const at = said('NUMBERS');
check('and the same number to open at', Number(at) === CLASS_AT, `open at ${at}`);

const all = CRAFT_CLASSES.flatMap((c) => c.skills);
check('every craft skill belongs to exactly one trade', new Set(all).size === all.length,
  `${all.length} covered, ${new Set(all).size} distinct`);
check(`and what is left over is exactly the ${NOBODY_OWNS.length} that belong to nobody`,
  said('LEFTOVER').split(',').sort().join() === NOBODY_OWNS.join(),
  `${said('LEFTOVER').split(',').length} left over: ${said('LEFTOVER')}`);

check('a card is shut below fifty, in the island’s words',
  said('SHUT').startsWith('Opens at 50 in one of: '), said('SHUT'));
check('and the browser says the same sentence',
  classRefusal(CRAFT_CLASSES[0], () => 0) === said('SHUT'),
  classRefusal(CRAFT_CLASSES[0], () => 0) ?? 'nothing');
check('and the door will not hand one over', said('SHUTTOOK') === said('SHUT'), said('SHUTTOOK'));
check('fifty in one skill it covers opens it', said('OPEN') === 'open', said('OPEN'));

const [took, paid, why] = said('FIRST').split('|');
check('the first trade in a slot is free, and breaks no bauble', took === 'terraformer' && paid === 'false', `${took}, bauble ${paid}, ${why}`);
check('and it goes in the craft slot, leaving the combat one alone',
  said('SLOTS') === 'terraformer|none', said('SLOTS'));
check('the same trade twice is refused', said('AGAIN') === 'Already your class: Terraformer.', said('AGAIN'));

const [brokeWhy, brokeStill] = said('BROKE').split('|');
check('a swap with no Bauble of Regret is refused, silver or none, in the browser\'s words, and nothing changes',
  brokeWhy === REGRET_SAID.none && brokeStill === 'terraformer',
  `${brokeWhy} — still ${brokeStill}`);
check('and the card says so before it is pressed', said('CARDWHY') === REGRET_SAID.none, said('CARDWHY'));
check('with one in the pack the card is open', said('CARDOPEN') === 'none', said('CARDOPEN'));

const [paidTook, paidSays, paidReally, paidNow, paidLeft] = said('PAID').split('|');
check('and with one the swap breaks it and takes no silver',
  paidTook === 'miner' && paidSays === 'true' && Number(paidReally) === 0 && paidNow === 'miner' && paidLeft === '0',
  `took ${paidTook}, bauble ${paidSays}, purse fell ${paidReally}, now ${paidNow}, baubles left ${paidLeft}`);
const changed = classChanged(classDef('terraformer')!.name, classDef('miner')!.name);
check('said as the browser says it', said('PAIDSAID').startsWith(changed), said('PAIDSAID'));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`fourteen trades, and one of them yours — ${ok.length} of ${ok.length}`);
