/**
 * The frame graph's frames (`Timings.gaps`), the far-body floors by quality step (`QUALITY_FAR`), and Low memory's
 * numbers (`memoryKnobs`).
 *
 * Asked for: a frame-time graph under the timings line; far creatures drawn less often at a low frame rate; a low
 * memory mode that lets bodies' pictures go sooner.
 *
 *   npx esbuild supabase/test/perfknobs.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/perfknobs.mjs && node node_modules/.cache/perfknobs.mjs
 */
import { GRAPH_FRAMES, Timings } from '../../src/render/timings';
import { LOW_MEMORY_SHARE, LOW_MEMORY_STILLS, LOW_MEMORY_UNSEEN, QUALITY_FAR } from '../../src/render/bodies';
import { check, finish } from './harness';

const t = new Timings();
check('no frames graphed with timings off', (t.begin(), t.begin(), t.gaps().length === 0));
(t as unknown as { on: boolean }).on = true;
for (let i = 0; i < GRAPH_FRAMES + 30; i++) t.begin();
const gaps = t.gaps();
check(`with timings on: the last ${GRAPH_FRAMES} frames, at most`, gaps.length > 0 && gaps.length <= GRAPH_FRAMES && gaps.every((g) => g >= 0), String(gaps.length));

check('far bodies: a floor a quality step, lower as frames run long', QUALITY_FAR.length >= 2 && QUALITY_FAR.every((f, i) => i === 0 || f < QUALITY_FAR[i - 1]) && QUALITY_FAR[0] === 0.5,
  QUALITY_FAR.join(', '));
check('Low memory: less room, fewer kept, let go sooner', LOW_MEMORY_SHARE > 1 && LOW_MEMORY_STILLS < 96 && LOW_MEMORY_UNSEEN < 5,
  `${LOW_MEMORY_SHARE} ${LOW_MEMORY_STILLS} ${LOW_MEMORY_UNSEEN}`);

finish('Frame graph, far bodies, Low memory');
