// Copies the Vite build output to the repository root so GitHub Pages can
// serve the site straight from the main branch.
import { createHash } from 'node:crypto';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

/** Every page the site serves. Both are generated; edit the ones in src/. */
const PAGES = ['index.html', 'account.html'];

rmSync('assets', { recursive: true, force: true });
cpSync('dist/assets', 'assets', { recursive: true });

/*
 * Asset file names are fixed, so a browser that cached ./assets/main.js could
 * keep serving an old build. Stamp each link with a hash of the file it points
 * at: the name on disk stays stable, but the URL changes whenever the bytes do.
 */
const stamp = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8);

/*
 * The home-screen manifest and its icons (src/public/), at the root where the
 * manifest's scope is the whole site. Its icons are stamped inside it, and
 * the manifest and the touch icon in the pages, the same way.
 */
rmSync('icons', { recursive: true, force: true });
cpSync('dist/icons', 'icons', { recursive: true });
const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
for (const icon of manifest.icons) icon.src = `${icon.src}?v=${stamp(`dist/${icon.src}`)}`;
writeFileSync('manifest.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);

for (const page of PAGES) {
  const html = readFileSync(`dist/${page}`, 'utf8')
    .replace(/(\.\/assets\/[\w.-]+)(?=["'])/g, (url) => `${url}?v=${stamp(url.replace('./', 'dist/'))}`)
    .replace(/\.\/(manifest\.webmanifest|icons\/[\w.-]+)(?=["'])/g, (url, file) => `${url}?v=${stamp(file.startsWith('icons/') ? `dist/${file}` : file)}`);
  writeFileSync(page, html);
}
console.log(`Copied ${PAGES.map((p) => `dist/${p}`).join(', ')}, dist/assets/, dist/icons/ and dist/manifest.webmanifest to the repository root.`);
