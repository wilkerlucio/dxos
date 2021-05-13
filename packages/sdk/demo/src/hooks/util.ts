//
// Copyright 2020 DXOS.org
//

/**
 * Turn array of callbacks into a single callback that calls them all.
 * @param callbacks
 */
// TODO(burdon): Move to Util.
export function liftCallback (callbacks: (() => void)[]): () => void {
  return () => callbacks.forEach(cb => cb());
}

/**
 * Helper to use async functions inside effects
 */
// TODO(burdon): Move to async.
export function asyncEffect (fun: () => Promise<(() => void) | undefined>): () => (() => void) | undefined {
  return () => {
    const promise = fun();
    return () => promise.then(cb => cb?.());
  };
}
