//
// Copyright 2022 DXOS.org
//

import { asyncTimeout, Event } from '@dxos/async';
import { PublicKey } from '@dxos/keys';
import { log } from '@dxos/log';

import { Messenger } from './messenger';
import { type SignalManager, MemorySignalManager, MemorySignalManagerContext } from './signal-manager';
import { type SignalMethods, type Message } from './signal-methods';

export type TestBuilderOptions = {
  signalManagerFactory?: () => SignalManager;
  messageDisruption?: (msg: Message) => Message[];
};

export class TestBuilder {
  private _signalContext = new MemorySignalManagerContext();
  private readonly _peers: TestPeer[] = [];

  constructor(public options: TestBuilderOptions) {}

  createSignalManager() {
    const signalManager = this.options.signalManagerFactory?.() ?? new MemorySignalManager(this._signalContext);

    if (this.options.messageDisruption) {
      // Imitates signal network disruptions (e. g. message doubling, ).
      const trueSend = signalManager.sendMessage.bind(signalManager);
      signalManager.sendMessage = async (message: Message) => {
        for (const msg of this.options.messageDisruption!(message)) {
          await trueSend(msg);
        }
      };
    }

    return signalManager;
  }

  createPeer(): TestPeer {
    const peer = new TestPeer(this);
    this._peers.push(peer);
    return peer;
  }

  async close() {
    await Promise.all(this._peers.map((peer) => peer.close()));
  }
}

export class TestPeer {
  public peerId = PublicKey.random();
  public identityKey = PublicKey.random();
  public signalManager: SignalManager;
  public messenger: Messenger;
  public defaultReceived = new Event<Message>();

  constructor(private readonly testBuilder: TestBuilder) {
    this.signalManager = testBuilder.createSignalManager();
    this.messenger = new Messenger({ signalManager: this.signalManager });
  }

  waitTillReceive(message: Message) {
    return expectReceivedMessage(this.signalManager, message);
  }

  async open() {
    await this.signalManager.open();
    this.messenger.open();
    await this.messenger
      .listen({
        peerId: this.peerId,
        onMessage: async (msg) => {
          this.defaultReceived.emit(msg);
        },
      })
      .catch((err) => log.catch(err));
  }

  async close() {
    await this.messenger.close();
    await this.signalManager.close();
  }
}

export const expectPeerAvailable = (client: SignalMethods, expectedTopic: PublicKey, peer: PublicKey) =>
  asyncTimeout(
    client.swarmEvent.waitFor(
      ({ swarmEvent, topic }) =>
        !!swarmEvent.peerAvailable && peer.equals(swarmEvent.peerAvailable.peer) && expectedTopic.equals(topic),
    ),
    1000,
  );

export const expectPeerLeft = (client: SignalMethods, expectedTopic: PublicKey, peer: PublicKey) =>
  asyncTimeout(
    client.swarmEvent.waitFor(
      ({ swarmEvent, topic }) =>
        !!swarmEvent.peerLeft && peer.equals(swarmEvent.peerLeft.peer) && expectedTopic.equals(topic),
    ),
    1000,
  );

export const expectReceivedMessage = (client: SignalMethods, expectedMessage: Message) => {
  return asyncTimeout(
    client.onMessage.waitFor(
      (msg) =>
        msg.author.peerKey === expectedMessage.author.peerKey &&
        msg.recipient[0].peerKey === expectedMessage.recipient[0].peerKey &&
        PublicKey.from(msg.payload.value).equals(expectedMessage.payload.value),
    ),
    1000,
  );
};
