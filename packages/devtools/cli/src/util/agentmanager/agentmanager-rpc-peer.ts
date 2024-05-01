//
// Copyright 2023 DXOS.org
//

// TODO(egorgripasov): Factor out.
import WebSocket from 'isomorphic-ws';

import { Trigger, Event } from '@dxos/async';
import { log } from '@dxos/log';
import { schema } from '@dxos/protocols';
import { type AgentManager } from '@dxos/protocols/proto/dxos/service/agentmanager';
import { createProtoRpcPeer, type ProtoRpcPeer } from '@dxos/rpc';

export class AgentManagerRpcPeer {
  private readonly _socket: WebSocket;
  private readonly _rpc: ProtoRpcPeer<{ AgentManager: AgentManager }>;
  private readonly _connectTrigger = new Trigger();

  readonly connected = new Event();
  readonly disconnected = new Event();
  readonly error = new Event<Error>();

  constructor(private readonly _url: string) {
    this._socket = new WebSocket(this._url);
    this._socket.onopen = async () => {
      try {
        await this._rpc.open();
        log(`RPC open ${this._url}`);
        this.connected.emit();
        this._connectTrigger.wake();
      } catch (err: any) {
        this.error.emit(err);
      }
    };

    this._socket.onclose = async () => {
      log(`Disconnected ${this._url}`);
      this.disconnected.emit();
      try {
        await this._rpc.close();
      } catch (err: any) {
        this.error.emit(err);
      }
    };

    this._socket.onerror = (event: WebSocket.ErrorEvent) => {
      log(`Publisher socket error ${this._url} ${event.message}`);
      this.error.emit(event.error ?? new Error(event.message));
    };

    this._rpc = createProtoRpcPeer({
      requested: {
        AgentManager: schema.getService('dxos.service.agentmanager.AgentManager'),
      },
      exposed: {},
      handlers: {},
      noHandshake: true,
      timeout: 1_000_000,
      port: {
        send: (msg) => {
          this._socket.send(msg);
        },
        subscribe: (cb) => {
          this._socket.onmessage = async (msg: WebSocket.MessageEvent) => {
            if (typeof Blob !== 'undefined' && msg.data instanceof Blob) {
              cb(Buffer.from(await msg.data.arrayBuffer()));
            } else {
              cb(msg.data as any);
            }
          };
        },
      },
    });
  }

  get rpc(): AgentManager {
    return this._rpc.rpc.AgentManager;
  }

  async close() {
    try {
      await this._rpc.close();
    } finally {
      this._socket.close();
    }
  }
}
