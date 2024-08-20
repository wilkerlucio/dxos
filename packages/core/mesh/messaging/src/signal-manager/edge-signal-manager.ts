//
// Copyright 2024 DXOS.org
//

import { AnySchema } from '@bufbuild/protobuf/wkt';

import { Event } from '@dxos/async';
import { Resource } from '@dxos/context';
import { protocol, type EdgeClient } from '@dxos/edge-client';
import { invariant } from '@dxos/invariant';
import { PublicKey } from '@dxos/keys';
import { log } from '@dxos/log';
import {
  SwarmRequestSchema,
  SwarmRequest_Action as SwarmRequestAction,
  SwarmResponseSchema,
  type Message as EdgeMessage,
} from '@dxos/protocols/buf/dxos/edge/messenger_pb';
import { type SwarmEvent } from '@dxos/protocols/proto/dxos/mesh/signal';
import { ComplexMap, ComplexSet } from '@dxos/util';

import { type Message, type SignalMethods } from '../signal-methods';

const SWARM_SERVICE_ID = 'swarm';
const SIGNAL_SERVICE_ID = 'signal';

export class EdgeSignal extends Resource implements SignalMethods {
  public swarmEvent = new Event<{ topic: PublicKey; swarmEvent: SwarmEvent }>();
  public onMessage = new Event<Message>();

  /**
   * swarm key -> peers in the swarm
   */
  // TODO(mykola): This class should not contain swarm state. Temporary before network-manager API changes to accept list of peers.
  private readonly _swarmPeers = new ComplexMap<PublicKey, ComplexSet<PublicKey>>(PublicKey.hash);
  private readonly _messengerClient: EdgeClient;

  constructor({ messengerClient }: { messengerClient: EdgeClient }) {
    super();
    this._messengerClient = messengerClient;
  }

  protected override async _open() {
    this._ctx.onDispose(this._messengerClient.addListener((message) => this._onMessage(message)));
  }

  /**
   * Warning: PeerId is inferred from messengerClient
   */
  async join({ topic }: { topic: PublicKey; peerId: PublicKey }): Promise<void> {
    this._swarmPeers.set(topic, new ComplexSet<PublicKey>(PublicKey.hash));
    await this._messengerClient.send(
      protocol.createMessage(SwarmRequestSchema, {
        serviceId: SWARM_SERVICE_ID,
        payload: { action: SwarmRequestAction.JOIN, swarmKeys: [topic.toHex()] },
      }),
    );
  }

  async leave({ topic }: { topic: PublicKey; peerId: PublicKey }): Promise<void> {
    this._swarmPeers.delete(topic);
    await this._messengerClient.send(
      protocol.createMessage(SwarmRequestSchema, {
        serviceId: SWARM_SERVICE_ID,
        payload: { action: SwarmRequestAction.LEAVE, swarmKeys: [topic.toHex()] },
      }),
    );
  }

  async sendMessage(message: Message): Promise<void> {
    await this._messengerClient.send(
      protocol.createMessage(AnySchema, {
        serviceId: SIGNAL_SERVICE_ID,
        source: message.author,
        target: message.recipient,
        payload: { typeUrl: message.payload.type_url, value: message.payload.value },
      }),
    );
  }

  async subscribeMessages(peerId: PublicKey): Promise<void> {
    // No-op.
  }

  async unsubscribeMessages(peerId: PublicKey): Promise<void> {
    // No-op.
  }

  private _onMessage(message: EdgeMessage) {
    switch (message.serviceId) {
      case SWARM_SERVICE_ID: {
        this._processSwarmResponse(message);
        break;
      }
      case SIGNAL_SERVICE_ID: {
        this._processMessage(message);
      }
    }
  }

  private _processSwarmResponse(message: EdgeMessage) {
    invariant(protocol.getPayloadType(message) === SwarmResponseSchema.typeName, 'Wrong payload type');
    const payload = protocol.getPayload(message, SwarmResponseSchema);
    const topic = PublicKey.from(payload.swarmKey);
    if (!this._swarmPeers.has(topic)) {
      log.warn('Received message from wrong topic', { topic });
      return;
    }
    const oldPeers = this._swarmPeers.get(topic)!;
    const timestamp = new Date(Date.parse(message.timestamp));
    const newPeers = new ComplexSet<PublicKey>(
      PublicKey.hash,
      payload.peers.map(({ peerKey }) => PublicKey.from(peerKey)),
    );

    // Emit new available peers in the swarm.
    for (const peer of newPeers) {
      if (oldPeers.has(peer)) {
        continue;
      }
      this.swarmEvent.emit({
        topic,
        swarmEvent: { peerAvailable: { peer: peer.asUint8Array(), since: timestamp } },
      });
    }

    // Emit peer that left the swarm.
    for (const peer of oldPeers.values()) {
      if (newPeers.has(peer)) {
        continue;
      }
      this.swarmEvent.emit({
        topic,
        swarmEvent: { peerLeft: { peer: peer.asUint8Array() } },
      });
    }

    this._swarmPeers.set(topic, newPeers);
  }

  private _processMessage(message: EdgeMessage) {
    invariant(protocol.getPayloadType(message) === AnySchema.typeName, 'Wrong payload type');
    const payload = protocol.getPayload(message, AnySchema);
    invariant(message.source, 'source is missing');
    invariant(message.target, 'target is missing');

    this.onMessage.emit({
      author: message.source,
      recipient: message.target,
      payload: {
        type_url: payload.typeUrl,
        value: payload.value,
      },
    });
  }
}
