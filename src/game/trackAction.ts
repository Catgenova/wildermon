/**
 * The job of Track, asked from a kind's page in the field guide: the rules
 * are `tracking.ts`'s, and this is the go that reads them.
 */
import type { ActionDef } from './actions';
import type { Game } from './game';
import { creatureLevel, CULL_RANGE, kindName, SPECIES } from './creatures';
import { ACTION_PACE } from './pace';
import { article } from './words';
import {
  bearingTo, nearestWild, TRACK, TRACK_BANDS, TRACK_TIME, trackDistSays, trackLevel, trackReach, trackReading, trackRefusal, trackSaid,
  TRACKING, type TrackFound,
} from './tracking';

/** The level a track is read at now. */
const levelOf = (g: Game): number => trackLevel(g.skills.get(TRACKING));

export const TRACK_ACTIONS: ActionDef[] = [
  {
    id: TRACK,
    label: 'Track',
    // On the bar while it is in hand: "Tracking a Reedpup".
    doing: (t) => {
      const def = t.kind === 'tile' && t.species ? SPECIES[t.species] : undefined;
      return def ? `Tracking ${article(def.name)} ${def.name}` : 'Tracking';
    },
    verb: 'tracking',
    skill: TRACKING,
    // Asked from a kind's page in the field guide, never from a tile's menu.
    hidden: true,
    stamina: 0.03,
    // A weight, as every job's is: `TRACK_TIME` seconds at nought, at the pace.
    baseTime: TRACK_TIME / ACTION_PACE,
    applies: (t) => t.kind === 'tile' && typeof t.species === 'string',
    check: (t, g) => trackRefusal(t.kind === 'tile' && t.species ? SPECIES[t.species] : undefined, g.guide.seen),
    /*
     * Alone, and only alone: on an island this is the island's (`perform_track`). Here the wild past the stretch
     * being walked is kept as a count of each stretch of country rather than as creatures (`Creatures.stream`), so a
     * track reaches no further than what is out, `CULL_RANGE` tiles, and says so when it finds nothing.
     */
    perform: (t, g) => {
      if (t.kind !== 'tile' || !t.species) return;
      const def = SPECIES[t.species];
      const L = levelOf(g);
      const range = Math.min(trackReach(L, g.awareShare()), CULL_RANGE);
      const p = g.player;
      const c = nearestWild(g.creatures.list.values(), t.species, p.x, p.y, range);
      if (!c) {
        g.missed();
        g.logMsg(trackSaid(def.name, range, null, null), 'event');
        return;
      }
      const r = trackReading(L, bearingTo(p.x, p.y, c.x, c.y), Math.hypot(c.x - p.x, c.y - p.y), g.rand());
      const found: TrackFound = { stageName: kindName(c), level: creatureLevel(c), moving: c.moving };
      g.logMsg(trackSaid(def.name, range, found, r), 'event');
      // A trail read, for the journal (the island's `perform_track` the same).
      g.note('tracked');
      g.trail = { name: TRACK_BANDS[r.band].stage ? found.stageName : def.name, bearing: r.bearing, dist: trackDistSays(r), x: p.x, y: p.y, at: g.time };
    },
  },
];
