//
// Copyright 2022 DXOS.org
//

import copypaste from 'copy-paste';
import { Box, Text } from 'ink';
import React, { useState } from 'react';

import { generateSeedPhrase } from '@dxos/client';
import { useClient } from '@dxos/react-client';

import { TextInput } from '../../components';
import { Panel } from '../util';

export const CreateProfile = () => {
  const client = useClient();
  const [username, setUsername] = useState<string>();
  const [focused, setFocused] = useState(false);

  const handleSubmit = async (text: string) => {
    const username = text.trim();
    if (username.length) {
      const seedphrase = generateSeedPhrase();
      await client.halo.createProfile({ seedphrase, username });
      copypaste.copy(seedphrase);
    }
  };

  return (
    <Panel highlight={focused}>
      <TextInput
        value={username ?? ''}
        onChange={setUsername}
        onSubmit={handleSubmit}
        onFocus={setFocused}
        placeholder='Enter username.'
      />

      <Box marginTop={1}>
        <Text color='gray'>The recovery phrase will be copied to the clipboard.</Text>
      </Box>
    </Panel>
  );
};
