import { execSync } from 'node:child_process';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

/**
 * CODESTYLE §6: the commit hash must be visible in the app, because the only bug
 * reports that will ever exist are the owner's own and they need a build to point at.
 */
function readCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  // @preact/preset-vite aliases react and react-dom to preact/compat, so JSX is
  // authored React-style and the alias stays a build detail (CODESTYLE §12).
  plugins: [preact()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    __COMMIT_HASH__: JSON.stringify(readCommitHash()),
  },
});
