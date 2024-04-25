//
// Copyright 2024 DXOS.org
//

import { Collection, getSpaceProperty, setSpaceProperty } from '@braneframe/types';
import { create, Expando, ref, S, TypedObject } from '@dxos/echo-schema';
import { type Migration } from '@dxos/migrations';
import { Filter } from '@dxos/react-client/echo';
import { nonNullable } from '@dxos/util';

export class FolderType extends TypedObject({ typename: 'braneframe.Folder', version: '0.1.0' })({
  name: S.optional(S.string),
  objects: S.mutable(S.array(ref(Expando))),
}) {}

export class SectionType extends TypedObject({ typename: 'braneframe.Section', version: '0.1.0' })({
  object: ref(Expando),
}) {}

export class StackType extends TypedObject({ typename: 'braneframe.Stack', version: '0.1.0' })({
  title: S.optional(S.string),
  sections: S.mutable(S.array(ref(SectionType))),
}) {}

export const migrations: Migration[] = [
  {
    version: 1,
    up: async ({ space }) => {
      const rootFolder = getSpaceProperty(space, FolderType.typename);
      if (rootFolder instanceof FolderType) {
        return;
      }

      const { objects } = await space.db.query(Filter.schema(FolderType, { name: space.key.toHex() })).run();
      if (objects.length > 0) {
        setSpaceProperty(space, FolderType.typename, objects[0]);
      } else {
        setSpaceProperty(space, FolderType.typename, create(FolderType, { name: space.key.toHex(), objects: [] }));
      }
    },
    down: () => {},
  },
  {
    version: 2,
    up: async ({ space }) => {
      const rootFolder = getSpaceProperty<FolderType>(space, FolderType.typename)!;
      const { objects } = await space.db.query(Filter.schema(FolderType, { name: space.key.toHex() })).run();
      if (objects.length <= 1) {
        return;
      }
      rootFolder.name = '';
      rootFolder.objects = objects.flatMap(({ objects }) => Array.from(objects));
      objects.forEach((object) => {
        if (object !== rootFolder) {
          space.db.remove(object);
        }
      });
    },
    down: () => {},
  },
  {
    version: 3,
    up: async ({ space }) => {
      // Find all folders and stacks.
      const { objects: folders } = await space.db.query(Filter.schema(FolderType)).run();
      const { objects: stacks } = await space.db.query(Filter.schema(StackType)).run();

      // Create corresponding collections for folders and stacks.
      const folderCollections = folders.map((folder): [FolderType, Collection] => [
        folder,
        create(Collection, { name: folder.name, objects: folder.objects, views: {} }),
      ]);
      const stackCollections = stacks.map((stack): [StackType, Collection] => [
        stack,
        create(Collection, {
          name: stack.title,
          objects: stack.sections.map((section) => section?.object).filter(nonNullable),
          // StackView will be created when the stack is rendered.
          // There's nothing to migrate here because no stack-specific data was stored previously.
          views: {},
        }),
      ]);

      // Replace folders and stacks, in migrated collections with corresponding collections.
      // This is only done for folders because stacks previously couldn't contain other stacks or folders.
      folderCollections.forEach(([_, collection]) => {
        collection.objects.forEach((object, index) => {
          if (object instanceof FolderType) {
            const [_, c] = folderCollections.find(([folder]) => folder === object)!;
            collection.objects.splice(index, 1, c);
          }

          if (object instanceof StackType) {
            const [_, c] = stackCollections.find(([stack]) => stack === object)!;
            collection.objects.splice(index, 1, c);
          }
        });
      });

      // Add collections to the space.
      folderCollections.forEach(([_, collection]) => {
        space.db.add(collection);
      });
      stackCollections.forEach(([_, collection]) => {
        space.db.add(collection);
      });

      // Update the space property.
      const rootFolder = getSpaceProperty(space, FolderType.typename);
      const [_, collection] = folderCollections.find(([folder]) => folder === rootFolder) ?? [];
      if (collection) {
        setSpaceProperty(space, Collection.typename, collection);
      }
    },
    down: () => {},
  },
];
