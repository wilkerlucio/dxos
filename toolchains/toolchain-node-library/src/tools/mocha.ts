//
// Copyright 2021 DXOS.org
//

import { execTool } from './common';

export interface ExecMochaOpts {
  forceClose?: boolean
  userArgs?: string[]
  jsdom?: boolean
}

/**
 * https://mochajs.org/#command-line-usage
 * https://mochajs.org/#reporters
 * E.g., `rushx test ./src/database/** -w --reporter min
 *
 * @param userArgs
 * @param forceClose
 * @param jsdom
 */
export async function execMocha ({ userArgs = [], forceClose, jsdom = false }: ExecMochaOpts) {

  //
  // Sources
  // Assume first args are either a glob or expanded glob of sources.
  //

  const defaultSpec = './src/**/*.test.*';
  const defaultSources = './src/**/*';
  const sources = [];
  {
    while (userArgs?.length) {
      const arg = userArgs.shift()!;
      if (arg.charAt(0) === '-') {
        userArgs.unshift(arg);
        break;
      } else {
        sources.push(arg);
      }
    }

    if (!sources.length) {
      sources.push(defaultSpec);
    }
  }

  //
  // Options
  // NOTE: --no-diff is ignored since the `expect` package generates the output.
  //

  const options = [
    ...sources,
    forceClose ? '--exit' : '--no-exit',
    '-t', '15000',
    ...userArgs
  ];

  // Set defaults.
  {
    let watchFiles = false;
    let shouldWatch = false;
    for (const arg of userArgs) {
      if (arg === '-w' || arg === '--watch') {
        shouldWatch = true;
      } else if (arg === '--watch-files') {
        watchFiles = true;
      }
    }

    if (shouldWatch && !watchFiles) {
      options.push(`--watch-files="${defaultSources}"`);
    }
  }

  // TODO(burdon): Verbose option.
  // console.log('Options:', JSON.stringify(options, undefined, 2));

  const requires = jsdom ? ['-r', 'jsdom-global/register'] : [];
  await execTool('mocha', [
    ...requires,
    '-r', '@swc-node/register',
    '-r', require.resolve('./util/wtfnode.js'),
    '-r', require.resolve('./util/catch-unhandled-rejections.js'),
    ...options
  ], {
    stdio: ['inherit', 'inherit', process.stdout] // Redirect stderr > stdout.
  });
}
