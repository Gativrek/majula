import { render } from 'preact';
import { log } from './lib/logger.ts';
import { App } from './ui/App.tsx';
import './ui/theme.css';
import './ui/motion.css';

const root = document.getElementById('app');
if (root === null) {
  throw new Error('index.html is missing its #app element');
}

log.info('app.boot', { commit: __COMMIT_HASH__ });
render(<App />, root);
