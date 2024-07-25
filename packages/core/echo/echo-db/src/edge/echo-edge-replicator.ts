import { type Message, cbor } from '@dxos/automerge/automerge-repo';
import { Resource, type Context } from '@dxos/context';
import type {
  EchoReplicator,
  EchoReplicatorContext,
  ReplicatorConnection,
  ShouldAdvertiseParams,
  ShouldSyncCollectionParams,
} from '@dxos/echo-pipeline';
import WebSocket from 'isomorphic-ws';
import { log } from '@dxos/log';
import { scheduleMicroTask } from '@dxos/async';
import { invariant } from '@dxos/invariant';
import { bufferToArray } from '@dxos/util';

export type EchoEdgeReplicatorParams = {
  url: string;
};

export class EchoEdgeReplicator implements EchoReplicator {
  private readonly _url: string;

  private _connection?: EdgeReplicatorConnection = undefined;

  constructor({ url }: EchoEdgeReplicatorParams) {
    this._url = url;
    log.info('created', { url });
  }

  async connect(context: EchoReplicatorContext): Promise<void> {
    this._connection = new EdgeReplicatorConnection({
      url: this._url,
      ownerPeerId: context.peerId,
      onRemoteConnected: async () => {
        context.onConnectionOpen(this._connection!);
      },
      onRemoteDisconnected: async () => {
        context.onConnectionClosed(this._connection!);
      },
    });
    await this._connection.open();
  }

  async disconnect(): Promise<void> {
    await this._connection?.close();
  }
}

type EdgeReplicatorConnectionsParams = {
  url: string;
  ownerPeerId: string;
  onRemoteConnected: () => Promise<void>;
  onRemoteDisconnected: () => Promise<void>;
};

class EdgeReplicatorConnection extends Resource implements ReplicatorConnection {
  private readonly _url: string;
  private _remotePeerId: string | null = null;
  private readonly _ownerPeerId: string;
  private readonly _onRemoteConnected: () => Promise<void>;
  private readonly _onRemoteDisconnected: () => Promise<void>;

  private _socket?: WebSocket = undefined;
  private _readableStreamController!: ReadableStreamDefaultController<Message>;

  public readable: ReadableStream<Message>;
  public writable: WritableStream<Message>;

  constructor({ url, ownerPeerId, onRemoteConnected, onRemoteDisconnected }: EdgeReplicatorConnectionsParams) {
    super();
    this._url = url;
    this._ownerPeerId = ownerPeerId;
    this._onRemoteConnected = onRemoteConnected;
    this._onRemoteDisconnected = onRemoteDisconnected;

    this.readable = new ReadableStream<Message>({
      start: (controller) => {
        this._readableStreamController = controller;
        this._ctx.onDispose(() => controller.close());
      },
    });

    this.writable = new WritableStream<Message>({
      write: async (message: Message, controller) => {
        this._sendMessage(message);
      },
    });
  }

  protected override async _open(ctx: Context): Promise<void> {
    this._connectWebsocket();
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

  private _connectWebsocket() {
    // Wire up retries
    this._socket = new WebSocket(this._url);

    this._socket.binaryType = 'arraybuffer';

    this._socket.addEventListener('open', this._onOpen);
    this._socket.addEventListener('close', this._onClose);
    this._socket.addEventListener('message', this._onMessage);
    this._socket.addEventListener('error', this._onError);
  }

  private _onOpen = () => {
    log.info('open');

    this._sendMessage({
      type: 'join',
      senderId: this._ownerPeerId as any,
      peerMetadata: {},
      supportedProtocolVersions: [ProtocolV1],
    } as any); // TODO(dmaretskyi): Better protocol type.
  };

  // When a socket closes, or disconnects, remove it from the array.
  private _onClose = () => {
    log.info('close');

    // TODO(dmaretskyi): Retries.
    scheduleMicroTask(this._ctx, async () => {
      await this._onRemoteDisconnected();
    });
  };

  private _onMessage = (event: WebSocket.MessageEvent) => {
    let binary = event.data;
    if (event.data instanceof ArrayBuffer) {
      binary = new Uint8Array(event.data);
    }
    invariant(binary instanceof Uint8Array);

    const message: Message = cbor.decode(binary);
    log.info('recv', {
      type: message.type,
      senderId: message.senderId,
      targetId: message.targetId,
      documentId: message.documentId,
      data: message.data?.length,
    });
    this._processMessage(message);
  };

  /** The websocket error handler signature is different on node and the browser.  */
  private _onError = (
    event:
      | Event // browser
      | WebSocket.ErrorEvent, // node
  ) => {
    if ('error' in event) {
      // (node)
      if (event.error.code !== 'ECONNREFUSED') {
        /* c8 ignore next */
        throw event.error;
      }
    } else {
      // (browser) We get no information about errors. https://stackoverflow.com/a/31003057/239663
      // There will be an error logged in the console (`WebSocket connection to 'wss://foo.com/'
      // failed`), but by design the error is unavailable to scripts. We'll just assume this is a
      // failed connection.
    }
    log.warn('Connection failed');
  };

  private _processMessage(message: Message) {
    switch (message.type) {
      case 'peer':
        {
          this._remotePeerId = message.senderId;
          log.info('connected', { peerId: this._remotePeerId });
          scheduleMicroTask(this._ctx, async () => {
            await this._onRemoteConnected();
          });
        }
        break;
      default:
        {
          this._readableStreamController.enqueue(message);
        }
        break;
    }
  }

  private _sendMessage(message: Message) {
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
