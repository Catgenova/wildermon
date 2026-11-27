/**
 * esbuild's `build` for the pages a test draws in Chromium, with the metal sets' models left out.
 *
 * The game fetches each metal set as a chunk of its own the first time a piece of it is worn
 * (`METAL_SETS` in src/sculpt/lowpoly.ts). A test page is one script with no chunks, so esbuild
 * inlines every set into it: sixteen sets of ten models, tens of megabytes, enough that Chromium
 * closed the page while the script was added (respawnpick and newplayer, after tin and mithril).
 * Here each `./metal<id>` that lowpoly.ts asks for is a set of empty pieces instead (as a metal
 * set's piece is drawn before its set is in), so a page's script stays the size of what it tests.
 *
 * Imported by relative path (`./pagebuild`) in place of esbuild's own `build`; nothing here runs
 * on its own.
 */
import { build as esbuild, type BuildOptions, type BuildResult, type Plugin } from 'esbuild';

const EMPTY_SET = `
const piece = (who) => ({ who, base: 59, mats: [], colours: [], verts: [], polys: [], tris: [], weights: [], bones: [] });
const pair = () => ({ male: piece('male'), female: piece('female') });
export const SET = { helm: pair(), chest: pair(), mantle: pair(), legs: pair(), boots: pair() };
`;

/** Each metal set asked for by lowpoly.ts, as a set of empty pieces. */
export const noMetalSets: Plugin = {
  name: 'no-metal-sets',
  setup(b) {
    b.onResolve({ filter: /^\.\/metal[a-z]+$/ }, (a) =>
      /[\\/]src[\\/]sculpt[\\/]lowpoly\.ts$/.test(a.importer) ? { path: a.path, namespace: 'no-metal-set' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'no-metal-set' }, () => ({ contents: EMPTY_SET, loader: 'js' }));
  },
};

/** esbuild's `build`, the metal sets left out of what it bundles. */
export const build = <T extends BuildOptions>(options: T): Promise<BuildResult<T>> =>
  esbuild({ ...(options as BuildOptions), plugins: [...(options.plugins ?? []), noMetalSets] }) as unknown as Promise<BuildResult<T>>;
