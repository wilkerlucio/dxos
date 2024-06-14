//
// Copyright 2024 DXOS.org
//

/**
 * Denotes the data version of the space document.
 */
export type SpaceDocVersion = number & { __type: 'SpaceDocVersion' };

export const SpaceDocVersion = Object.freeze({
  /**
   * For the documents created before the versioning was introduced.
   */
  LEGACY: 0 as SpaceDocVersion,

  /**
   * Current version.
   */
  CURRENT: 1 as SpaceDocVersion,
});
