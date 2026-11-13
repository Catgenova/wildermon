/**
 * A blow taken on the shield is marked on the body, for everybody near to draw.
 *
 * `player.blocked_at` (20261120000007_a_blow_on_the_shield_is_seen.sql). What this asks:
 *
 *   * a blow blocked sets it to the blow's instant, with "Blocked with shield." (`BLOCKED_SAID`) said;
 *   * a blow that lands, with the same shield on, leaves it as it was, and so does a blow with no shield on;
 *   * the beat says it to the blocker (`rpc_settle`'s `blocked_at`), and the roster's read of somebody else can ask
 *     for it (`PEOPLE_COLUMNS`), as the browser does.
 *
 * Runs against the database the suite leaves behind.
 */
import { BLOCKED_SAID } from '../../src/game/fight';
import { psql, check, finish } from './harness';

/** The blow a forced block or a landed hit is struck with, as a share of health. */
const RAW = 0.1;
const TRIES = 80;

const out = psql(`
begin;
create temp table said (k text, v text);
create function pg_temp.as_(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from caller where uid = u;
end $f$;
do $b$
declare w record; v_px double precision; v_py double precision; tx int; ty int; v_sh bigint; v_tries int; v_said text;
        v_h0 double precision; v_h1 double precision; v_at timestamptz; j jsonb;
begin
  perform setseed(0.47);
  select p.world_id, p.uid, wd.size, wd.spawn_x, wd.spawn_y into w
    from player p join world wd on wd.id = p.world_id
   where exists (select 1 from land_tile t where t.world_id = wd.id)
   order by wd.size desc, p.world_id, p.uid limit 1;
  v_px := case when w.spawn_x + peace_reach() + 6 < w.size then w.spawn_x + peace_reach() + 6.5
               else w.spawn_x - peace_reach() - 5.5 end;
  v_py := w.spawn_y + 0.5;
  for tx in greatest(0, floor(v_px)::int - 6)..least(w.size - 1, floor(v_px)::int + 6) loop
    for ty in greatest(0, floor(v_py)::int - 6)..least(w.size - 1, floor(v_py)::int + 6) loop
      perform land_set_height(w.world_id, tx, ty, 4); perform land_set_dirt(w.world_id, tx, ty, 5);
      perform land_set_tile(w.world_id, tx, ty, tile_id('Grass'));
    end loop;
  end loop;
  -- Nobody near to take the blow on their own shield, and nothing on this body from a trade, a faith or a ward.
  update player set body_at = now(), x = v_px - 60 where world_id = w.world_id and uid <> w.uid and (x - v_px) ^ 2 + (y - v_py) ^ 2 < 60 ^ 2;
  update player set act = null, act_target = null, act_ends = null, act_left = null, act_goes = null,
         act_queue = '[]'::jsonb, equipped = '{}'::jsonb, fight_stance = 'balanced', fight_back = false,
         moved_at = now() - interval '1 minute', x = v_px, y = v_py, level = 0, wounds = '[]'::jsonb, away = false,
         blessings = '{}'::jsonb, craft_class = null, combat_class = null, class_mul = null, class_level = 0, blocked_at = null,
         stats = (coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1, 'aegis', 0)) - 'hurtAt' - 'hurtBy'
    where world_id = w.world_id and uid = w.uid;
  delete from player_node where world_id = w.world_id and uid = w.uid;
  update creature set hunting = null, brawl = null where world_id = w.world_id and hunting = w.uid;
  delete from creature where world_id = w.world_id and to_x between v_px - 20 and v_px + 20 and to_y between v_py - 20 and v_py + 20;
  delete from faith_zone where world_id = w.world_id;
  -- No dodge (body control where it starts), and a middling shield.
  insert into skill (world_id, uid, id, value) values (w.world_id, w.uid, 'body_control', dodge_from()), (w.world_id, w.uid, 'shields', 50)
    on conflict (world_id, uid, id) do update set value = excluded.value;

  -- A blow with no shield on: it lands, and nothing is marked.
  delete from event where uid = w.uid;
  perform hurt_player(w.world_id, w.uid, ${RAW}, 'Something is on you', 'cut');
  insert into said values ('BARE', coalesce((select blocked_at::text from player where world_id = w.world_id and uid = w.uid), 'null')
    || '|' || (1 - (select (stats->>'health')::double precision from player where world_id = w.world_id and uid = w.uid) > 0)::text);

  -- With a wooden shield on: blows until one lands, each from a body never marked.
  v_sh := give(w.world_id, w.uid, 'wooden_shield', 1, 40);
  update player set equipped = jsonb_build_object('offhand', v_sh) where world_id = w.world_id and uid = w.uid;
  v_tries := 0;
  loop
    v_tries := v_tries + 1;
    update player set wounds = '[]'::jsonb, blocked_at = null, stats = jsonb_set(stats, '{health}', '1') where world_id = w.world_id and uid = w.uid;
    delete from event where uid = w.uid;
    perform hurt_player(w.world_id, w.uid, ${RAW}, 'Something is on you', 'cut');
    select (stats->>'health')::double precision, blocked_at into v_h1, v_at from player where world_id = w.world_id and uid = w.uid;
    exit when v_h1 < 1 or v_tries >= ${TRIES};
  end loop;
  insert into said values ('HIT', coalesce(v_at::text, 'null') || '|' || (v_h1 < 1)::text || '|' || v_tries
    || '|' || exists (select 1 from event where uid = w.uid and text = '${BLOCKED_SAID}')::text);

  -- And blows until one is blocked.
  v_tries := 0;
  loop
    v_tries := v_tries + 1;
    update player set wounds = '[]'::jsonb, blocked_at = null, stats = jsonb_set(stats, '{health}', '1') where world_id = w.world_id and uid = w.uid;
    delete from event where uid = w.uid;
    perform hurt_player(w.world_id, w.uid, ${RAW}, 'Something is on you', 'cut');
    select (stats->>'health')::double precision, blocked_at into v_h1, v_at from player where world_id = w.world_id and uid = w.uid;
    select text into v_said from event where uid = w.uid order by n desc limit 1;
    exit when v_said = '${BLOCKED_SAID}' or v_tries >= ${TRIES};
  end loop;
  insert into said values ('BLOCK', coalesce(v_said, 'unsaid') || '|' || (v_at = now())::text || '|' || v_h1 || '|' || v_tries);

  -- The beat says it to the blocker, as the instant on the row.
  perform pg_temp.as_(w.uid);
  j := rpc_settle(null, w.world_id, null, false, null);
  insert into said values ('BEAT', coalesce(((j->>'blocked_at')::timestamptz = v_at)::text, 'unsaid'));
  -- And the roster asks for it by name, with the rest of what it reads (\`PEOPLE_COLUMNS\`).
  insert into said values ('ROSTER', (select (blocked_at = v_at)::text from player where world_id = w.world_id and uid = w.uid));
end $b$;
select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const at = line.indexOf('=');
  if (at > 0) said.set(line.slice(0, at), line.slice(at + 1));
}
const island = (k: string): string => said.get(k) ?? 'MISSING';

{
  const [at, hurt] = island('BARE').split('|');
  check('a blow with no shield on lands and marks nothing', at === 'null' && hurt === 'true', island('BARE'));
}
{
  const [at, hurt, tries, blocked] = island('HIT').split('|');
  check('a blow that lands with a shield on leaves the body unmarked', at === 'null' && hurt === 'true' && blocked === 'false', `${island('HIT')} (${tries} blows)`);
}
{
  const [text, now, health, tries] = island('BLOCK').split('|');
  check(`a blow blocked says "${BLOCKED_SAID}", takes nothing and marks the body at the blow's instant`,
    text === BLOCKED_SAID && now === 'true' && Number(health) === 1, `${island('BLOCK')} (${tries} blows)`);
}
check('the beat says the mark to the blocker (`rpc_settle` blocked_at)', island('BEAT') === 'true', island('BEAT'));
check('the roster reads the mark off the row', island('ROSTER') === 'true', island('ROSTER'));

finish('a blow on the shield is marked on the body');
