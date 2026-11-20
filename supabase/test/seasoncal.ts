/**
 * The season calendar (`seasonCalendar`, src/ui/panels/seasons.ts).
 *
 * Asked for: a season calendar, what fruits now and what comes next. The season now and the three after it, each
 * when it starts and what fruits in it (`FRUITING`), what starts and what ends with it; nothing before the first
 * spring, when everything fruits.
 *
 *   npx esbuild supabase/test/seasoncal.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/seasoncal.mjs && node node_modules/.cache/seasoncal.mjs
 */
import { FRUITING, fruitsIn, seasonCalendar } from '../../src/game/fruiting';
import { DAY_SECONDS } from '../../src/game/pace';
import { SEASON_DAYS, SEASONS, YEAR_FROM } from '../../src/world/calendar';
import { check, finish } from './harness';

// Summer, its fifth day.
const at = YEAR_FROM + (SEASON_DAYS + 4) * DAY_SECONDS + 60;
const cal = seasonCalendar(at);
check('now: summer, day 5', cal.now === 'summer' && cal.day === 5, `${cal.now} ${cal.day}`);
check('the season now and the three after, in order', cal.seasons.map((s) => s.season).join() === ['summer', 'autumn', 'winter', 'spring'].join(), cal.seasons.map((s) => s.season).join());
check(`each when it starts: now, then ${SEASON_DAYS - 4} days, and a season apart after`,
  cal.seasons.map((s) => s.inDays).join() === [0, SEASON_DAYS - 4, 2 * SEASON_DAYS - 4, 3 * SEASON_DAYS - 4].join(), cal.seasons.map((s) => s.inDays).join());
for (const s of cal.seasons) {
  const want = Object.keys(FRUITING).filter((id) => fruitsIn(id, s.season)).sort();
  check(`${s.season}: what fruits in it, every one`, s.fruits.map((f) => f.id).sort().join() === want.join(), s.fruits.map((f) => f.id).join());
}
const summer = cal.seasons[0];
const cherry = summer.fruits.find((f) => f.id === 'cherry');
check('a summer-only fruit starts and ends with summer', !!cherry && cherry.starts && cherry.ends, JSON.stringify(cherry));
const blue = summer.fruits.find((f) => f.id === 'blueberry');
check('one from spring to autumn neither starts nor ends in summer', !!blue && !blue.starts && !blue.ends, JSON.stringify(blue));
const autumn = cal.seasons[1];
check('an autumn fruit starts with autumn', autumn.fruits.some((f) => f.id === 'apple' && f.starts));
check('before the first spring: no seasons', seasonCalendar(YEAR_FROM - 10).now === null && seasonCalendar(YEAR_FROM - 10).seasons.length === 0);
check(`${SEASONS.length} seasons`, cal.seasons.length === SEASONS.length);

finish('The season calendar');
