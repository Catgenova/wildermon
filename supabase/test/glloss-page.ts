/**
 * The Solara bench (`tools/perf/solara-page.ts`) and a way to take the sculpted bodies' GL context away from it, as a
 * browser does when it is short of GPU memory (`WEBGL_lose_context`). Bundled by `glloss.ts`.
 */
import '../../tools/perf/solara-page';
import { glContext } from '../../src/sculpt/gl';

(window as unknown as { loseGL: () => string }).loseGL = () => {
  const ext = glContext()?.gl.getExtension('WEBGL_lose_context');
  if (!ext) return 'no WEBGL_lose_context';
  ext.loseContext();
  return 'lost';
};
