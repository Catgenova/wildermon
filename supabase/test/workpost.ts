/**
 * A work post takes a wildermon as Hitch does.
 *
 * Asked: "Bug: workposts aren't working. Make it work almost like a Hitch,
 * able to select the wildermon following or held in crates in inventory in a
 * menu on the post." The browser named its pick `creatureId` and the island
 * read `creature`, so every pick came back "Choose a wildermon.". Asked of
 * both sides:
 *
 *   * the menu's pick reaches the island under the name the island reads;
 *   * one following you, near, is set to the post and works out of it;
 *   * one in a crate in your pack is let out at the post and works out of it,
 *     and the crate is empty after;
 *   * somebody else's, one working your settlement, one following you from
 *     too far and one in a crate out of reach are each refused, in the
 *     browser's words.
 *
 * The island half runs against the database the suite leaves behind, in one
 * transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { POST_ACTION_BY_ID, POST_FOLLOW_REACH } from '../../src/game/posts';

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

/* ---- the browser's words ------------------------------------------------- */

const assign = POST_ACTION_BY_ID.get('assign_post')!;
const g = Game.create(4242);
g.player.x = 100.5;
g.player.y = 100.5;
const post = g.addPost(100, 101, 1, 1, 40, 'Pine');
const say = (c: Partial<import('../../src/game/creatures').Creature>): string | null => {
  const base = [...g.creatures.list.values()][0];
  const one = { ...base, id: 9001, name: 'Pip', mode: 'active', mine: true, hitchedTo: null, ridden: false, post: null, x: 100.5, y: 101, ...c };
  g.creatures.list.set(one.id, one as typeof base);
  const why = assign.check?.({ kind: 'post', id: post.id, creature: one.id }, g) ?? null;
  g.creatures.list.delete(one.id);
  return why;
};
const browser = {
  near: say({}),
  stranger: say({ mine: false }),
  worker: say({ mode: 'deed' }),
  far: say({ x: 100.5 + POST_FOLLOW_REACH + 1 }),
  lost: say({ mode: 'stored' }),
};
check('the browser lets one following you, near, go to the post', browser.near === null, String(browser.near));

/* ---- the island ---------------------------------------------------------- */

const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; a uuid := '11111111-1111-1111-1111-111111111111'; b uuid := '22222222-2222-2222-2222-222222222222';
        v_post bigint; v_post2 bigint; v_pet int; v_crated int; v_theirs int; v_worker int; v_far int; v_lost int;
        v_crate bigint; c creature;
begin
  select id into w from world where name = 'Bigness';
  update player set body_at = now(), x = 100.5, y = 100.5, away = false, seen_at = now(), act = null where world_id = w and uid = a;
  delete from creature where world_id = w and keeper in (a, b);
  insert into placed (world_id, kind, x, y, cx, cy, ql, made_by)
    values (w, 'post', 100, 101, 100.375, 101.375, 40, a) returning id into v_post;
  insert into placed (world_id, kind, x, y, cx, cy, ql, made_by)
    values (w, 'post', 101, 100, 101.375, 100.375, 40, a) returning id into v_post2;

  v_pet := creature_spawn(w, 'ambra', 100.5, 101, 'active', now() - interval '60 days', a);
  v_crated := creature_spawn(w, 'ambra', 100.5, 100.5, 'stored', now() - interval '60 days', a);
  perform give(w, a, 'creature_crate', 1, 40, null);
  select id into v_crate from item where world_id = w and holder = 'player' and holder_uid = a and def = 'creature_crate'
    order by id desc limit 1;
  update item set creature = v_crated where id = v_crate;
  v_theirs := creature_spawn(w, 'ambra', 100.5, 101, 'active', now() - interval '60 days', b);
  v_worker := creature_spawn(w, 'ambra', 100.5, 101, 'deed', now() - interval '60 days', a);
  v_far := creature_spawn(w, 'ambra', 100.5 + ${POST_FOLLOW_REACH + 1}, 100.5, 'active', now() - interval '60 days', a);
  v_lost := creature_spawn(w, 'ambra', 100.5, 100.5, 'stored', now() - interval '60 days', a);
  update creature set name = 'Pip' where world_id = w and id in (v_pet, v_crated, v_theirs, v_worker, v_far, v_lost);

  insert into said values ('stranger', coalesce(act_refusal(w, a, 'assign_post', jsonb_build_object('kind', 'post', 'id', v_post, 'creature', v_theirs)), 'none'));
  insert into said values ('worker', coalesce(act_refusal(w, a, 'assign_post', jsonb_build_object('kind', 'post', 'id', v_post, 'creature', v_worker)), 'none'));
  insert into said values ('far', coalesce(act_refusal(w, a, 'assign_post', jsonb_build_object('kind', 'post', 'id', v_post, 'creature', v_far)), 'none'));
  insert into said values ('lost', coalesce(act_refusal(w, a, 'assign_post', jsonb_build_object('kind', 'post', 'id', v_post, 'creature', v_lost)), 'none'));

  insert into said values ('near', coalesce(act_refusal(w, a, 'assign_post', jsonb_build_object('kind', 'post', 'id', v_post, 'creature', v_pet)), 'none'));
  perform act_perform(w, a, 'assign_post', jsonb_build_object('kind', 'post', 'id', v_post, 'creature', v_pet));
  select * into c from creature where world_id = w and id = v_pet;
  insert into said values ('near-after', c.mode || ',' || coalesce(c.post = v_post, false));

  insert into said values ('crated', coalesce(act_refusal(w, a, 'assign_post', jsonb_build_object('kind', 'post', 'id', v_post2, 'creature', v_crated)), 'none'));
  perform act_perform(w, a, 'assign_post', jsonb_build_object('kind', 'post', 'id', v_post2, 'creature', v_crated));
  select * into c from creature where world_id = w and id = v_crated;
  insert into said values ('crated-after', c.mode || ',' || coalesce(c.post = v_post2, false) || ',' || round(c.to_x::numeric, 1) || ',' || round(c.to_y::numeric, 1));
  insert into said values ('crate-empty', (select (creature is null)::text from item where id = v_crate));

  -- The post pulled up, with nobody else following you: the one on it follows you again.
  delete from creature where world_id = w and id in (v_far, v_theirs, v_worker, v_lost);
  perform act_perform(w, a, 'pick_up_post', jsonb_build_object('kind', 'post', 'id', v_post));
  select * into c from creature where world_id = w and id = v_pet;
  insert into said values ('pulled', c.mode || ',' || coalesce(c.post::text, 'none') || ',' || c.keeper::text);
  insert into said values ('pulled-said', coalesce((select e.text from event e where e.world_id = w and e.uid = a and e.text like 'Post pulled up:%'
    order by e.n desc limit 1), 'unsaid'));
  -- The other rotted away, with one following you now: to your settlement, or into the empty crate in your pack.
  update placed set dmg = 100, since = now() where id = v_post2;
  perform post_settle(v_post2);
  select * into c from creature where world_id = w and id = v_crated;
  insert into said values ('rotted', c.mode || ',' || coalesce(c.post::text, 'none') || ','
    || case when c.mode = 'stored' then (select (creature = v_crated)::text from item where id = v_crate) else 'deed' end);
end $$;
select k || '=' || v from said order by k;
rollback;
`);
const island = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

check('the island lets one following you, near, go to the post', island.get('near') === 'none', island.get('near'));
check('and it works out of the post', island.get('near-after') === 'deed,true', island.get('near-after'));
check('the island lets one in a crate in your pack go to the post', island.get('crated') === 'none', island.get('crated'));
check('and it comes out of the crate at the post and works out of it', island.get('crated-after') === 'deed,true,101.4,101.0', island.get('crated-after'));
check('and the crate in the pack is empty', island.get('crate-empty') === 'true', island.get('crate-empty'));
check('pulled up, the one on it follows you again, not lost', island.get('pulled') === 'active,none,11111111-1111-1111-1111-111111111111', island.get('pulled'));
check('and says so, in the browser\'s words', island.get('pulled-said') === 'Post pulled up: Pip returns to you.', island.get('pulled-said'));
check('rotted away with one following you: back to your settlement, or into the empty crate in your pack',
  ['deed,none,deed', 'stored,none,true'].includes(island.get('rotted') ?? ''), island.get('rotted'));
for (const k of ['stranger', 'worker', 'far', 'lost'] as const) {
  const b = browser[k];
  check(`refused, in the browser's words: ${k}`, !!b && island.get(k) === b, `browser "${b}", island "${island.get(k)}"`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a work post takes a wildermon as Hitch does — ${ok.length} of ${ok.length}`);
