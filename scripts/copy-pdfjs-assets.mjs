/**
 * Copies the files PDF.js fetches at runtime into `public/pdfjs/`, which Vite serves and
 * bundles into the app.
 *
 * They have to ship inside the APK: PDF.js otherwise looks for character maps, standard
 * fonts and its image-decoder wasm by URL, and a viewer that reaches for a CDN fails in
 * airplane mode (SPECS §6). Runs before every dev server and build, so `public/pdfjs/`
 * is generated rather than committed and cannot drift from the installed version.
 */

import { cpSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

const SOURCE = join('node_modules', 'pdfjs-dist');
const TARGET = join('public', 'pdfjs');

/** A JavaScript engine for PDFs that run scripts. The app never enables scripting. */
function isUnusedScriptingEngine(path) {
  return basename(path).startsWith('quickjs-eval');
}

rmSync(TARGET, { recursive: true, force: true });
for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  cpSync(join(SOURCE, directory), join(TARGET, directory), {
    recursive: true,
    filter: (path) => !isUnusedScriptingEngine(path),
  });
}
