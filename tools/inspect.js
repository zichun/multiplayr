/**
 * tools/inspect.js
 * Cross-platform launcher for the card-renderer terminal inspector.
 *
 * Registers ts-node (transpile-only, fast) and ignore-styles (so the component
 * chain's `.scss` imports are no-ops headlessly), then hands off to the CLI.
 * Invoked by `npm run inspect -- <args>`.
 */
'use strict';

require('ignore-styles');
require('ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', jsx: 'react' }
});

require('../src/client/lib/card-renderer/inspect-cli.tsx');
