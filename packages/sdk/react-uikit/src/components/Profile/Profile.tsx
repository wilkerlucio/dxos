//
// Copyright 2022 DXOS.org
//

import { Eraser } from 'phosphor-react';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import urlJoin from 'url-join';

import { Invitation, InvitationEncoder, Profile as ProfileType } from '@dxos/client';
import { useClient, useHaloInvitations } from '@dxos/react-client';
import { Button, getSize, Input, Loading, QrCode } from '@dxos/react-ui';
import { humanize } from '@dxos/util';

export interface ProfileProps {
  profile: ProfileType;
  createInvitationUrl?: (invitation: Invitation) => string;
}

// TODO(wittjosiah): Remove.
const defaultCreateUrl = (invitation: Invitation) => {
  const invitationPath = '/profile/invite-device'; // App-specific.
  const { origin, pathname } = window.location;
  return urlJoin(origin, pathname, `/#${invitationPath}`, `?invitation=${InvitationEncoder.encode(invitation)}`);
};

export const DisplayNameInput = ({ profile }: { profile: ProfileType }) => {
  const { t } = useTranslation();
  return (
    <Input
      label={t('displayName label')}
      initialValue={profile.displayName}
      placeholder={humanize(profile.identityKey.toHex())}
      className='my-0'
    />
  );
};

export const HaloInviteSingleton = ({ createInvitationUrl = defaultCreateUrl }: ProfileProps) => {
  const { t } = useTranslation();
  const client = useClient();
  const invitations = useHaloInvitations();

  useEffect(() => {
    if (invitations.length < 1) {
      void client.halo.createInvitation();
    }
  }, [client, invitations]);

  // TODO(wittjosiah): This should re-generate once it is used.
  const invitationUrl = useMemo(() => {
    const invitation = invitations[0]?.invitation;
    if (invitation) {
      return createInvitationUrl(invitation);
    }
  }, [invitations]);

  return invitationUrl ? (
    <QrCode
      size={40}
      value={invitationUrl}
      label={<p className='w-20'>{t('copy halo invite code label')}</p>}
      side='left'
      sideOffset={12}
      className='w-full h-auto'
    />
  ) : (
    <Loading label={t('generic loading label')} size='md' />
  );
};

export const Profile = (props: ProfileProps) => {
  const { t } = useTranslation();
  return (
    <div role='none' className='flex flex-col gap-4 items-center'>
      <DisplayNameInput {...props} />
      <HaloInviteSingleton {...props} />
      <Button variant='outline' className='w-full flex gap-2'>
        <Eraser className={getSize(5)} />
        {t('reset device label', { ns: 'halo' })}
      </Button>
    </div>
  );
};
