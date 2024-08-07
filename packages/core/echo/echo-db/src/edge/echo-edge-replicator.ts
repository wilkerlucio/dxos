import { type Message as AutomergeMessage, cbor } from '@dxos/automerge/automerge-repo';
import { Resource, type Context } from '@dxos/context';
import type {
  EchoReplicator,
  EchoReplicatorContext,
  ReplicatorConnection,
  ShouldAdvertiseParams,
  ShouldSyncCollectionParams,
} from '@dxos/echo-pipeline';
import { log } from '@dxos/log';
import { scheduleMicroTask } from '@dxos/async';
import { invariant } from '@dxos/invariant';
import { bufferToArray } from '@dxos/util';
import { Messenger } from '@dxos/edge-client';
import type { SpaceId } from '@dxos/keys';
import { Message as RouterMessage } from '@dxos/protocols/buf/dxos/edge/messenger_pb';

export type EchoEdgeReplicatorParams = {
  edgeConnection: Messenger;
};

export class EchoEdgeReplicator implements EchoReplicator {
  private readonly _edgeConnection: Messenger;

  private _context: EchoReplicatorContext | null = null;
  private _connectedSpaces = new Set<SpaceId>();
  private _connections = new Map<SpaceId, EdgeReplicatorConnection>();

  constructor({ edgeConnection }: EchoEdgeReplicatorParams) {
    this._edgeConnection = edgeConnection;
  }

  async connect(context: EchoReplicatorContext): Promise<void> {
    log.info('connect', { peerId: context.peerId });
    this._context = context;

    for (const spaceId of this._connectedSpaces) {
      await this._openConnection(spaceId);
    }
  }

  async disconnect(): Promise<void> {
    for (const connection of this._connections.values()) {
      await connection.close();
    }
    this._connections.clear();
  }

  async connectToSpace(spaceId: SpaceId) {
    this._connectedSpaces.add(spaceId);

    // Check if AM-repo requested that we connect to remote peers.
    if (this._context !== null) {
      await this._openConnection(spaceId);
    }
  }

  async disconnectFromSpace(spaceId: SpaceId) {
    this._connectedSpaces.delete(spaceId);

    const connection = this._connections.get(spaceId);
    if (connection) {
      await connection.close();
      this._connections.delete(spaceId);
    }
  }

  private async _openConnection(spaceId: SpaceId) {
    invariant(this._context);
    const connection = new EdgeReplicatorConnection({
      edgeConnection: this._edgeConnection,
      ownPeerId: this._context.peerId,
      spaceId,
      onRemoteConnected: async () => {
        this._context?.onConnectionOpen(connection);
      },
      onRemoteDisconnected: async () => {
        this._context?.onConnectionClosed(connection);
      },
    });
    this._connections.set(spaceId, connection);

    await connection.open();
  }
}

type EdgeReplicatorConnectionsParams = {
  edgeConnection: Messenger;
  ownPeerId: string;
  spaceId: SpaceId;
  onRemoteConnected: () => Promise<void>;
  onRemoteDisconnected: () => Promise<void>;
};

class EdgeReplicatorConnection extends Resource implements ReplicatorConnection {
  private readonly _edgeConnection: Messenger;
  private _remotePeerId: string | null = null;
  private readonly _ownPeerId: string;
  private readonly _spaceId: SpaceId;
  private readonly _onRemoteConnected: () => Promise<void>;
  private readonly _onRemoteDisconnected: () => Promise<void>;

  private _socket?: WebSocket = undefined;
  private _readableStreamController!: ReadableStreamDefaultController<AutomergeMessage>;

  public readable: ReadableStream<AutomergeMessage>;
  public writable: WritableStream<AutomergeMessage>;

  constructor({
    edgeConnection,
    ownPeerId,
    spaceId,
    onRemoteConnected,
    onRemoteDisconnected,
  }: EdgeReplicatorConnectionsParams) {
    super();
    this._edgeConnection = edgeConnection;
    this._ownPeerId = ownPeerId;
    this._spaceId = spaceId;
    this._onRemoteConnected = onRemoteConnected;
    this._onRemoteDisconnected = onRemoteDisconnected;

    this.readable = new ReadableStream<AutomergeMessage>({
      start: (controller) => {
        this._readableStreamController = controller;
        this._ctx.onDispose(() => controller.close());
      },
    });

    this.writable = new WritableStream<AutomergeMessage>({
      write: async (message: AutomergeMessage, controller) => {
        this._sendMessage(message);
      },
    });
  }

  protected override async _open(ctx: Context): Promise<void> {
    this._ctx.onDispose(
      this._edgeConnection.addListener((msg: RouterMessage) => {
        this._onMessage(msg);
      }),
    );

    await this._onRemoteConnected();
  }

  protected override async _close(): Promise<void> {
    this._socket?.close();
  }

  get peerId(): string {
    invariant(this._remotePeerId, 'Not connected');
    return this._remotePeerId;
  }

  async shouldAdvertise(params: ShouldAdvertiseParams): Promise<boolean> {
    // TODO(dmaretskyi): Think this through.
    return true;
  }

  shouldSyncCollection(params: ShouldSyncCollectionParams): boolean {
    // TODO(dmaretskyi): Think this through.
    return true;
  }

  // When a socket closes, or disconnects, remove it from the array.
  private _onClose = () => {
    log.info('close');

    // TODO(dmaretskyi): Retries.
    scheduleMicroTask(this._ctx, async () => {
      await this._onRemoteDisconnected();
    });
  };

  private _onMessage(message: RouterMessage) {
    log.info('recv', { message });
    if (!message.serviceId) return;
    const [service, ...rest] = message.serviceId.split(':');
    if (service !== 'automerge-replicator') return;

    const [spaceId] = rest;
    log.info('compare spaceID', { spaceId, _spaceId: this._spaceId });
    if (spaceId !== this._spaceId) return;

    const payload = cbor.decode(message.payload!.value) as AutomergeMessage;
    this._processMessage(payload);
  }

  private _processMessage(message: AutomergeMessage) {
    this._readableStreamController.enqueue(message);
  }

  private _sendMessage(message: AutomergeMessage) {
    invariant(this._socket, 'Not connected');
    log.info('send', {
      type: message.type,
      senderId: message.senderId,
      targetId: message.targetId,
      documentId: message.documentId,
    });
    const encoded = cbor.encode(message);
    this._socket.send(bufferToArray(encoded));
  }
}

const ProtocolV1 = '1';

// TODO(dmaretskyi): Protocol types.
// TODO(dmaretskyi): Automerge core protocol vs websocket protocol.
// TODO(dmaretskyi): Backpressure.
// TODO(dmaretskyi): Worker share policy.
