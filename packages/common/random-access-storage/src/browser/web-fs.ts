//
// Copyright 2023 DXOS.org
//

import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { callbackify } from 'node:util';
import { RandomAccessStorage } from 'random-access-storage';

import { synchronized } from '@dxos/async';
import { log } from '@dxos/log';

import { Directory, File, Storage, StorageType, getFullPath } from '../common';

/**
 *
 */
export class WebFS implements Storage {
  readonly type = StorageType.WEBFS;

  protected readonly _files = new Map<string, File>();
  protected _root?: FileSystemDirectoryHandle;

  constructor(private readonly path: string) {}

  public get size() {
    return this._files.size;
  }

  private _getFiles(path: string): Map<string, File> {
    const fullName = this._getFullFilename(this.path, path);
    return new Map(
      [...this._files.entries()].filter(([path, file]) => path.includes(fullName) && file.destroyed !== true)
    );
  }

  @synchronized
  private async _initialize() {
    if (this._root) {
      return this._root;
    }
    this._root = await navigator.storage.getDirectory();
    assert(this._root, 'Root is undefined');
    return this._root;
  }

  createDirectory(sub = '') {
    return new Directory(
      this.type,
      getFullPath(this.path, sub),
      () => this._getFiles(sub),
      (...args) => this.getOrCreateFile(...args),
      () => this._delete(sub)
    );
  }

  getOrCreateFile(path: string, filename: string, opts?: any): File {
    const fullName = this._getFullFilename(path, filename);
    const existingFile = this._files.get(fullName);
    if (existingFile) {
      return existingFile;
    }
    const file = this._createFile(fullName);
    this._files.set(fullName, file);
    return file;
  }

  private _createFile(fullName: string) {
    return new WebFile({
      file: this._initialize().then((root) => root.getFileHandle(fullName, { create: true })),
      destroy: async () => {
        this._files.delete(fullName);
        const root = await this._initialize();
        return root.removeEntry(fullName);
      }
    });
  }

  private async _delete(path: string): Promise<void> {
    await Promise.all(
      Array.from(this._getFiles(path)).map(async ([path, file]) => {
        await file.destroy().catch((err: any) => log.warn(err));
        this._files.delete(path);
      })
    );
  }

  async reset() {
    await this._initialize();
    for await (const filename of await (this._root as any).keys()) {
      this._files.delete(filename);
      await this._root!.removeEntry(filename, { recursive: true }).catch((err: any) => log.warn(err));
    }
    this._root = undefined;
  }

  private _getFullFilename(path: string, filename?: string) {
    // Replace slashes with underscores. Because we can't have slashes in filenames in Browser File Handle API.
    if (filename) {
      return getFullPath(path, filename).split('/').join('_');
    } else {
      return path.split('/').join('_');
    }
  }
}

// TODO(mykola): Remove EventEmitter.
export class WebFile extends EventEmitter implements File {
  readonly opened: boolean = true;
  readonly suspended: boolean = false;
  readonly closed: boolean = false;
  readonly unlinked: boolean = false;
  readonly writing: boolean = false;
  readonly readable: boolean = true;
  readonly writable: boolean = true;
  readonly deletable: boolean = true;
  readonly truncatable: boolean = true;
  readonly statable: boolean = true;

  private readonly _fileHandle: Promise<FileSystemFileHandle>;
  private readonly _destroy: () => Promise<void>;

  constructor({ file, destroy }: { file: Promise<FileSystemFileHandle>; destroy: () => Promise<void> }) {
    super();
    this._fileHandle = file;
    this._destroy = destroy;
  }

  destroyed = false;
  directory = '';
  filename = '';
  type: StorageType = StorageType.WEBFS;
  native: RandomAccessStorage = {
    write: callbackify(this.write.bind(this)),
    read: callbackify(this.read.bind(this)),
    del: callbackify(this.del.bind(this)),
    stat: callbackify(this.stat.bind(this)),
    destroy: callbackify(this.destroy.bind(this)),
    truncate: callbackify(this.truncate?.bind(this))
  } as RandomAccessStorage;

  @synchronized
  async write(offset: number, data: Buffer) {
    // TODO(mykola): Fix types.
    const fileHandle: any = await this._fileHandle;
    const writable = await fileHandle.createWritable({ keepExistingData: true });
    await writable.write({ type: 'write', data, position: offset });
    await writable.close();
  }

  @synchronized
  async read(offset: number, size: number) {
    const fileHandle: any = await this._fileHandle;
    const file = await fileHandle.getFile();
    if (offset + size > file.size) {
      throw new Error('Read out of bounds');
    }
    return Buffer.from(new Uint8Array(await file.slice(offset, offset + size).arrayBuffer()));
  }

  @synchronized
  async del(offset: number, size: number) {
    if (offset < 0 || size < 0) {
      return;
    }
    const fileHandle: any = await this._fileHandle;
    const writable = await fileHandle.createWritable({ keepExistingData: true });
    const file = await fileHandle.getFile();
    let leftoverSize = 0;
    if (offset + size < file.size) {
      const leftover = Buffer.from(new Uint8Array(await file.slice(offset + size, file.size).arrayBuffer()));
      leftoverSize = leftover.length;
      await writable.write({ type: 'write', data: leftover, position: offset });
    }

    await writable.write({ type: 'truncate', size: offset + leftoverSize });
    await writable.close();
  }

  @synchronized
  async stat() {
    const fileHandle: any = await this._fileHandle;
    const file = await fileHandle.getFile();
    return {
      size: file.size
    };
  }

  async close(): Promise<void> {}

  @synchronized
  async destroy() {
    this.destroyed = true;
    return await this._destroy();
  }

  @synchronized
  async truncate(offset: number) {
    const fileHandle: any = await this._fileHandle;
    const writable = await fileHandle.createWritable({ keepExistingData: true });
    await writable.write({ type: 'truncate', size: offset });
    await writable.close();
  }
}
