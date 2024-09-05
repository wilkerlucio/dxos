//
// Copyright 2024 DXOS.org
//

import { subtleCrypto } from '@dxos/crypto';
import { PublicKey, SpaceId } from '@dxos/keys';
import { ComplexMap } from '@dxos/util';

const SPACE_IDS_CACHE = new ComplexMap<PublicKey, SpaceId>(PublicKey.hash);

/**
 * Space keys are generated by creating a keypair, and then taking the first 20 bytes of the SHA-256 hash of the public key and encoding them to multibase RFC4648 base-32 format (prefixed with B, see Multibase Table).
 * Inspired by how ethereum addresses are derived.
 */
export const createIdFromSpaceKey = async (spaceKey: PublicKey): Promise<SpaceId> => {
  const cachedValue = SPACE_IDS_CACHE.get(spaceKey);
  if (cachedValue !== undefined) {
    return cachedValue;
  }

  const digest = await subtleCrypto.digest('SHA-256', spaceKey.asUint8Array());

  const bytes = new Uint8Array(digest).slice(0, SpaceId.byteLength);
  const spaceId = SpaceId.encode(bytes);
  SPACE_IDS_CACHE.set(spaceKey, spaceId);
  return spaceId;
};
