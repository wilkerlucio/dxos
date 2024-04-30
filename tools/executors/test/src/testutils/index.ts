// Keep as literal so vitest can substitute this.
const ENV_TAGS = process.env.MOCHA_TAGS;
const ENV_ENV = process.env.VITEST_ENV;

const tags = (ENV_TAGS ?? '').split(',');

export const tagEnabled = (tag: string) => tags.includes(tag);

export const inEnvironment = (...environments: string[]) => environments.includes(ENV_ENV ?? 'nodejs');

/**
 * Will wait for the debugger to be attached and stop on the breakpoint.
 * You can then press "step-out" to return to the caller.
 */
export const waitForDebugger = async () => {
  while (true) {
    const before = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const after = performance.now();
    if (after - before > 100) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

/**
 * Open resources and close them after the test is finished.
 */
// TODO(dmaretskyi): Import those types from somewhere.
export const openAndClose = async (
  t: { onTestFinished: (cb: () => any) => void },
  ...resources: { open(): Promise<any>; close(): Promise<any> }[]
): Promise<void> => {
  for (const resourceLike of resources) {
    await resourceLike.open();
    t.onTestFinished(() => resourceLike.close());
  }
};
