/**
 * A blow taken on the shield, and a blow that lands, are marked on the body, for everybody near to draw.
 *
 * `player.blocked_at` (20261120000007_a_blow_on_the_shield_is_seen.sql), `player.hurt_at` and `player.hurt_where`
 * (20261120000008_a_blow_that_lands_is_seen.sql). What this asks:
 *
 *   * a blow blocked sets `blocked_at` to the blow's instant, with "Blocked with shield." (`BLOCKED_SAID`) said, and
 *     leaves `hurt_at` as it was;
 *   * a blow that lands, with the same shield on or none, leaves `blocked_at` as it was and sets `hurt_at` to its instant
 *     and `hurt_where` to a hit location's slot, the one its line names (`landedOf` reads it back);
 *   * a blow dodged, or one a ward takes whole, marks neither;
 *   * the beat says them to the one struck (`rpc_settle`), and the roster's read of somebody else can ask for them
 *     (`PEOPLE_COLUMNS`), as the browser does.
 *
 * Runs against the database the suite leaves behind.
 */
import { BLOCKED_SAID, landedOf } from '../../src/game/fight';
import { HIT_LOCATIONS } from '../../src/game/gear';
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
        v_h0 double precision; v_h1 double precision; v_at timestamptz; j jsonb; v_hurt timestamptz; v_where text;
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
  insert into said values ('LANDED', (select (hurt_at = now())::text || '|' || coalesce(hurt_where, 'null') from player where world_id = w.world_id and uid = w.uid)
    || '|' || coalesce((select text from event where uid = w.uid and kind = 'fight' order by n desc limit 1), 'unsaid'));
  -- The beat says when and where to the one struck.
  perform pg_temp.as_(w.uid);
  j := rpc_settle(null, w.world_id, null, false, null);
  insert into said values ('HURT_BEAT', coalesce(((j->>'hurt_at')::timestamptz = now())::text, 'unsaid') || '|'
    || coalesce((j->>'hurt_where') = (select hurt_where from player where world_id = w.world_id and uid = w.uid), false)::text);
  insert into said values ('HURT_ROSTER', (select (hurt_at = now() and hurt_where is not null)::text from player where world_id = w.world_id and uid = w.uid));

  -- A blow a ward takes whole: nothing marked.
  update player set hurt_at = null, hurt_where = null, wounds = '[]'::jsonb, stats = jsonb_set(jsonb_set(stats, '{health}', '1'), '{aegis}', '1')
   where world_id = w.world_id and uid = w.uid;
  perform hurt_player(w.world_id, w.uid, ${RAW}, 'Something is on you', 'cut');
  insert into said values ('WARD', (select coalesce(hurt_at::text, 'null') || '|' || coalesce(hurt_where, 'null') || '|' || ((stats->>'health')::double precision = 1)::text
    from player where world_id = w.world_id and uid = w.uid));
  update player set stats = jsonb_set(stats, '{aegis}', '0') where world_id = w.world_id and uid = w.uid;

  -- Blows until one is dodged (body control at its most), each from a body never marked: nothing marked.
  update skill set value = 100 where world_id = w.world_id and uid = w.uid and id = 'body_control';
  v_tries := 0;
  loop
    v_tries := v_tries + 1;
    update player set wounds = '[]'::jsonb, hurt_at = null, hurt_where = null, stats = jsonb_set(stats, '{health}', '1') where world_id = w.world_id and uid = w.uid;
    delete from event where uid = w.uid;
    perform hurt_player(w.world_id, w.uid, ${RAW}, 'Something is on you', 'cut');
    select text into v_said from event where uid = w.uid order by n desc limit 1;
    exit when v_said like 'Dodged:%' or v_tries >= ${TRIES};
  end loop;
  insert into said values ('DODGE', coalesce(v_said, 'unsaid') || '|' || (select coalesce(hurt_at::text, 'null') from player where world_id = w.world_id and uid = w.uid));
  update skill set value = dodge_from() where world_id = w.world_id and uid = w.uid and id = 'body_control';

  -- With a wooden shield on: blows until one lands, each from a body never marked.
  v_sh := give(w.world_id, w.uid, 'wooden_shield', 1, 40);
  update player set equipped = jsonb_build_object('offhand', v_sh) where world_id = w.world_id and uid = w.uid;
  v_tries := 0;
  loop
    v_tries := v_tries + 1;
    update player set wounds = '[]'::jsonb, blocked_at = null, hurt_at = null, hurt_where = null, stats = jsonb_set(stats, '{health}', '1') where world_id = w.world_id and uid = w.uid;
    delete from event where uid = w.uid;
    perform hurt_player(w.world_id, w.uid, ${RAW}, 'Something is on you', 'cut');
    select (stats->>'health')::double precision, blocked_at, hurt_at, hurt_where into v_h1, v_at, v_hurt, v_where from player where world_id = w.world_id and uid = w.uid;
    exit when v_h1 < 1 or v_tries >= ${TRIES};
  end loop;
  insert into said values ('HIT', coalesce(v_at::text, 'null') || '|' || (v_h1 < 1)::text || '|' || v_tries
    || '|' || exists (select 1 from event where uid = w.uid and text = '${BLOCKED_SAID}')::text
    || '|' || coalesce((v_hurt = now())::text, 'null') || '|' || coalesce(v_where, 'null'));

  -- And blows until one is blocked.
  v_tries := 0;
  loop
    v_tries := v_tries + 1;
    update player set wounds = '[]'::jsonb, blocked_at = null, hurt_at = null, stats = jsonb_set(stats, '{health}', '1') where world_id = w.world_id and uid = w.uid;
    delete from event where uid = w.uid;
    perform hurt_player(w.world_id, w.uid, ${RAW}, 'Something is on you', 'cut');
    select (stats->>'health')::double precision, blocked_at, hurt_at into v_h1, v_at, v_hurt from player where world_id = w.world_id and uid = w.uid;
    select text into v_said from event where uid = w.uid order by n desc limit 1;
    exit when v_said = '${BLOCKED_SAID}' or v_tries >= ${TRIES};
  end loop;
  insert into said values ('BLOCK', coalesce(v_said, 'unsaid') || '|' || (v_at = now())::text || '|' || v_h1 || '|' || v_tries || '|' || coalesce(v_hurt::text, 'null'));

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
  check('a blow with no shield on lands and marks no block', at === 'null' && hurt === 'true', island('BARE'));
}
{
  const [at, hurt, tries, blocked] = island('HIT').split('|');
  check('a blow that lands with a shield on marks no block', at === 'null' && hurt === 'true' && blocked === 'false', `${island('HIT')} (${tries} blows)`);
}
{
  const [text, now, health, tries, hurt] = island('BLOCK').split('|');
  check(`a blow blocked says "${BLOCKED_SAID}", takes nothing and marks the body at the blow's instant`,
    text === BLOCKED_SAID && now === 'true' && Number(health) === 1, `${island('BLOCK')} (${tries} blows)`);
  check('and is not marked as a blow that landed', hurt === 'null', island('BLOCK'));
}
{
  const [now, where, line] = island('LANDED').split('|');
  const slots = HIT_LOCATIONS.map(([slot]) => slot as string);
  check('a blow that lands marks the body at its instant, and where, a hit location', now === 'true' && slots.includes(where), island('LANDED'));
  check('and its line says the same place (`landedOf`)', landedOf(line) === where, `"${line}" -> ${landedOf(line)}`);
  const [, , , , hurtNow, hitWhere] = island('HIT').split('|');
  check('a blow that lands with a shield on is marked as landed too', hurtNow === 'true' && slots.includes(hitWhere), island('HIT'));
}
check('the beat says when and where to the one struck (`rpc_settle` hurt_at, hurt_where)', island('HURT_BEAT') === 'true|true', island('HURT_BEAT'));
check('the roster reads when and where off the row', island('HURT_ROSTER') === 'true', island('HURT_ROSTER'));
check('a blow a ward takes whole marks nothing and takes nothing', island('WARD') === 'null|null|true', island('WARD'));
{
  const [text, at] = island('DODGE').split('|');
  check('a blow dodged marks nothing', text.startsWith('Dodged:') && at === 'null', island('DODGE'));
}
check('the beat says the mark to the blocker (`rpc_settle` blocked_at)', island('BEAT') === 'true', island('BEAT'));
check('the roster reads the mark off the row', island('ROSTER') === 'true', island('ROSTER'));

finish('a blow blocked or landed is marked on the body');
