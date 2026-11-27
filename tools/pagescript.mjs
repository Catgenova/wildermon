// A bundled page script loaded into a Playwright page, whatever its size.
//
// `page.addScriptTag({ content })` sends the script through the DevTools protocol, and Chromium refuses a message over
// 100 MB ("Too large read data is pending"). With every metal set's meshes in it (src/sculpt/lowpoly.ts METAL_SETS) the
// game's renderer bundle is past that. Here the script is served once over a local HTTP server and loaded by a <script>
// tag in the page, so it never crosses the protocol. (A file:// URL is refused from a page made with setContent.)
//
//   import { addScript } from '../pagescript.mjs';
//   await addScript(page, bundled.outputFiles[0].text);
import { createServer } from 'node:http';

/** Loads `js` into `page` as a classic script and resolves once it has run. */
export async function addScript(page, js) {
  const server = createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    res.end(js);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  try {
    const url = `http://127.0.0.1:${server.address().port}/page.js`;
    await page.evaluate((src) => new Promise((done, fail) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => done();
      s.onerror = () => fail(new Error(`page script did not load from ${src}`));
      document.head.appendChild(s);
    }), url);
  } finally {
    server.close();
  }
}
