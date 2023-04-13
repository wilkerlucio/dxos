//
// Copyright 2023 DXOS.org
//

import '@dxosTheme';
import { Config, Defaults } from '@dxos/config';
import { initializeAppTelemetry } from '@dxos/react-appkit/telemetry';
import { startIFrameRuntime, forceClientReset } from '@dxos/vault';

import { namespace } from './util';

void initializeAppTelemetry({ namespace, config: new Config(Defaults()) });

const reset = window.location.hash === '#reset';

if (reset) {
  void forceClientReset();
} else {
  void startIFrameRuntime(
    () =>
      // NOTE: Url must be within SharedWorker instantiation for bundling to work as expected.
      new SharedWorker(new URL('@dxos/vault/shared-worker', import.meta.url), {
        type: 'module',
        name: 'dxos-vault'
      })
  );
}
