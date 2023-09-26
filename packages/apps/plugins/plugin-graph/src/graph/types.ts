//
// Copyright 2023 DXOS.org
//

import type { IconProps } from '@phosphor-icons/react';
import { FC } from 'react';

// TODO(burdon): Consider making intents part of graph.
//  (does it make sense to have trivially decomposed plugins that require each other)?
import type { Intent } from '@braneframe/plugin-intent';
import type { UnsubscribeCallback } from '@dxos/async';

// TODO(thure): `Parameters<TFunction>` causes typechecking issues because `TFunction` has so many signatures.
export type Label = string | [string, { ns: string; count?: number }];

/**
 * Called when a node is added to the graph, allowing other node builders to add children, actions or properties.
 */
export type NodeBuilder = (parent: Node) => UnsubscribeCallback | void;

/**
 * Represents a node in the graph.
 */
export type Node<TData = any, TProperties extends Record<string, any> = Record<string, any>> = {
  /**
   * Globally unique ID.
   */
  id: string;

  /**
   * Parent node in the graph.
   */
  parent: Node | null;

  /**
   * Label to be used when displaying the node.
   * For default labels, use a translated string.
   *
   * @example 'My Node'
   * @example ['unknown node label, { ns: 'example-plugin' }]
   */
  label: Label;

  /**
   * Description to be used when displaying a detailed view of the node.
   * For default descriptions, use a translated string.
   */
  description?: Label;

  /**
   * Icon to be used when displaying the node.
   */
  icon?: FC<IconProps>;

  /**
   * Properties of the node relevant to displaying the node.
   *
   * @example { index: 'a1' }
   */
  // TODO(burdon): Make this extensible and move label, description, and icon into here?
  properties: TProperties;

  /**
   * Data the node represents.
   */
  // TODO(burdon): Type system (e.g., minimally provide identifier string vs. TypedObject vs. Graph mixin type system)?
  //  type field would prevent convoluted sniffing of object properties. And allow direct pass-through for ECHO TypedObjects.
  // TODO(burdon): In some places `null` is cast to TData so make optional?
  data: TData;

  /**
   * Children of the node stored by their id.
   */
  // TODO(burdon): Rename nodes/nodeMap?
  childrenMap: Record<string, Node>;

  /**
   * Actions of the node stored by their id.
   */
  actionsMap: Record<string, Action>;

  /**
   * Children of the node in default order.
   */
  get children(): Node[];

  /**
   * Actions of the node in default order.
   */
  get actions(): Action[];

  addProperty(key: string, value: any): void;
  removeProperty(key: string): void;

  addNode<TChildData = null, TChildProperties extends { [key: string]: any } = { [key: string]: any }>(
    id: string,
    ...node: (Pick<Node, 'id' | 'label'> & Partial<Node<TChildData, TChildProperties>>)[]
  ): Node<TChildData, TChildProperties>[];
  removeNode(id: string): Node;

  addAction<TActionProperties extends { [key: string]: any } = { [key: string]: any }>(
    ...action: (Pick<Action, 'id' | 'label'> & Partial<Action<TActionProperties>>)[]
  ): Action<TActionProperties>[];
  removeAction(id: string): Action;
};

/**
 * An action on a node in the graph which may be invoked by sending the associated intent.
 */
export type Action<TProperties extends { [key: string]: any } = { [key: string]: any }> = {
  /**
   * Locally unique ID.
   */
  id: string;

  /**
   * Label to be used when displaying the node.
   * For default labels, use a translated string.
   *
   * @example 'Test Action'
   * @example ['test action label, { ns: 'example-plugin' }]
   */
  label: Label;

  /**
   * Icon to be used when displaying the node.
   */
  icon?: FC<IconProps>;

  /**
   * Intent(s) to be invoked when the action is invoked.
   */
  intent?: Intent | Intent[];

  /**
   * Properties of the node relevant to displaying the action.
   *
   * @example { index: 'a1' }
   */
  properties: TProperties;

  /**
   * Sub-actions of the node stored by their id.
   */
  actionsMap: { [key: string]: Action };

  /**
   * Actions of the node in default order.
   */
  get actions(): Action[];

  invoke: () => Promise<any>;

  addProperty(key: string, value: any): void;
  removeProperty(key: string): void;

  addAction<TActionProperties extends { [key: string]: any } = { [key: string]: any }>(
    ...action: (Pick<Action, 'id' | 'label'> & Partial<Action<TActionProperties>>)[]
  ): Action<TActionProperties>[];
  removeAction(id: string): Action;
};

export type TraversalOptions = {
  /**
   * The node to start traversing from. Defaults to the root node.
   */
  node?: Node;

  /**
   * The direction to traverse the graph. Defaults to 'down'.
   */
  direction?: 'up' | 'down';

  /**
   * A predicate to filter nodes which are passed to the `visitor` callback.
   */
  filter?: (node: Node) => boolean;

  /**
   * A callback which is called for each node visited during traversal.
   */
  visitor?: (node: Node) => void;
};
