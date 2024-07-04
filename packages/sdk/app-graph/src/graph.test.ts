//
// Copyright 2023 DXOS.org
//

import { effect } from '@preact/signals-core';
import { expect } from 'chai';

import { updateCounter } from '@dxos/echo-schema/testing';
import { registerSignalRuntime } from '@dxos/echo-signals';
import { describe, test } from '@dxos/test';

import { Graph, ROOT_ID, ROOT_TYPE } from './graph';
import { type Node, type NodeFilter } from './node';

const longestPaths = new Map<string, string[]>();

const filterLongestPath: NodeFilter = (node, connectedNode): node is Node => {
  const longestPath = longestPaths.get(node.id);
  if (!longestPath) {
    return false;
  }

  if (longestPath[longestPath.length - 2] !== connectedNode.id) {
    return false;
  }

  return true;
};

// TODO(wittjosiah): Add tests for granularity of reactivity.
describe('Graph', () => {
  test('add nodes', () => {
    const graph = new Graph();

    const [root] = graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);

    expect(root.id).to.equal('root');
    expect(root.nodes()).to.have.length(2);
    expect(graph.findNode('test1')?.id).to.equal('test1');
    expect(graph.findNode('test2')?.id).to.equal('test2');
    expect(graph.findNode('test1')?.nodes()).to.be.empty;
    expect(graph.findNode('test2')?.nodes()).to.be.empty;
    expect(graph.findNode('test1')?.nodes({ direction: 'inbound' })).to.have.length(1);
    expect(graph.findNode('test2')?.nodes({ direction: 'inbound' })).to.have.length(1);
  });

  test('add nodes updates existing nodes', () => {
    const graph = new Graph();

    graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);
    graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);

    expect(Object.keys(graph._nodes)).to.have.length(3);
    expect(Object.keys(graph._edges)).to.have.length(6);
    expect(graph.root.nodes()).to.have.length(2);
  });

  test('remove node', () => {
    const graph = new Graph();

    const [root] = graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);

    expect(root.id).to.equal('root');
    expect(root.nodes()).to.have.length(2);
    expect(graph.findNode('test1')?.id).to.equal('test1');
    expect(graph.findNode('test2')?.id).to.equal('test2');

    graph._removeNodes(['test1']);
    expect(graph.findNode('test1')).to.be.undefined;
    expect(root.nodes()).to.have.length(1);
  });

  test('add edge', () => {
    const graph = new Graph();

    graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);
    graph._addEdges([{ source: 'test1', target: 'test2' }]);

    expect(graph.findNode('test1')?.nodes()).to.have.length(1);
    expect(graph.findNode('test2')?.nodes({ direction: 'inbound' })).to.have.length(2);
  });

  test('add edges is idempontent', () => {
    const graph = new Graph();

    graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);
    graph._addEdges([{ source: 'test1', target: 'test2' }]);
    graph._addEdges([{ source: 'test1', target: 'test2' }]);

    expect(graph.findNode('test1')?.nodes()).to.have.length(1);
    expect(graph.findNode('test2')?.nodes({ direction: 'inbound' })).to.have.length(2);
  });

  test('sort edges', () => {
    const graph = new Graph();

    const [root] = graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test3', type: 'test' },
          { id: 'test2', type: 'test' },
          { id: 'test4', type: 'test' },
        ],
      },
    ]);

    expect(root.nodes().map((node) => node.id)).to.deep.equal(['test1', 'test3', 'test2', 'test4']);

    graph._sortEdges('root', 'outbound', ['test4', 'test3']);

    expect(root.nodes().map((node) => node.id)).to.deep.equal(['test4', 'test3', 'test1', 'test2']);
  });

  test('remove edge', () => {
    const graph = new Graph();

    graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);
    graph._removeEdge({ source: 'root', target: 'test1' });

    expect(graph.root.nodes()).to.have.length(1);
    expect(graph.findNode('test1')?.nodes({ direction: 'inbound' })).to.be.empty;
  });

  test('toJSON', () => {
    const graph = new Graph();

    graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);
    graph._addEdges([{ source: 'test1', target: 'test2' }]);

    const json = graph.toJSON();
    expect(json).to.deep.equal({
      id: ROOT_ID,
      type: ROOT_TYPE,
      nodes: [
        { id: 'test1', type: 'test', nodes: [{ id: 'test2', type: 'test' }] },
        { id: 'test2', type: 'test' },
      ],
    });
  });

  test('can be traversed', () => {
    const graph = new Graph();

    const [root] = graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);

    const nodes: string[] = [];
    graph.traverse({ node: root, visitor: (node) => nodes.push(node.id) });
    expect(nodes).to.deep.equal(['root', 'test1', 'test2']);
  });

  test('traversal breaks cycles', () => {
    const graph = new Graph();

    const [root] = graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);
    graph._addEdges([{ source: 'test1', target: 'root' }]);

    const nodes: string[] = [];
    graph.traverse({ node: root, visitor: (node) => nodes.push(node.id) });
    expect(nodes).to.deep.equal(['root', 'test1', 'test2']);
  });

  test('traversal can be limited by predicate', () => {
    const graph = new Graph();

    const [root] = graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
          { id: 'test3', type: 'test' },
          { id: 'test4', type: 'test' },
        ],
      },
    ]);

    const nodes: string[] = [];
    graph.traverse({
      node: root,
      visitor: (node) => nodes.push(node.id),
      filter: (node) => {
        try {
          const id = parseInt(node.id.replace('test', ''), 10);
          return id % 2 === 0;
        } catch (e) {
          return false;
        }
      },
    });
    expect(nodes).to.deep.equal(['test2', 'test4']);
  });

  test('traversal can be started from any node', () => {
    const graph = new Graph();

    graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test', nodes: [{ id: 'test2', type: 'test', nodes: [{ id: 'test3', type: 'test' }] }] },
        ],
      },
    ]);

    const nodes: string[] = [];
    graph.traverse({
      node: graph.findNode('test2')!,
      visitor: (node) => nodes.push(node.id),
    });
    expect(nodes).to.deep.equal(['test2', 'test3']);
  });

  test('traversal can follow inbound edges', () => {
    const graph = new Graph();

    graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test', nodes: [{ id: 'test2', type: 'test', nodes: [{ id: 'test3', type: 'test' }] }] },
        ],
      },
    ]);

    const nodes: string[] = [];
    graph.traverse({
      node: graph.findNode('test2')!,
      direction: 'inbound',
      visitor: (node) => nodes.push(node.id),
    });
    expect(nodes).to.deep.equal(['test2', 'test1', 'root']);
  });

  test('can filter to longest paths', () => {
    const graph = new Graph();

    graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);
    graph._addEdges([{ source: 'test1', target: 'test2' }]);

    graph.traverse({
      visitor: (node, path) => {
        if (!longestPaths.has(node.id) || longestPaths.get(node.id)!.length < path.length) {
          longestPaths.set(node.id, path);
        }
      },
    });

    expect(longestPaths.get('root')).to.deep.equal(['root']);
    expect(longestPaths.get('test1')).to.deep.equal(['root', 'test1']);
    expect(longestPaths.get('test2')).to.deep.equal(['root', 'test1', 'test2']);
    expect(graph.root.nodes({ filter: filterLongestPath })).to.have.length(1);
    expect(graph.findNode('test1')?.nodes({ filter: filterLongestPath })).to.have.length(1);
    expect(graph.findNode('test2')?.nodes({ filter: filterLongestPath })).to.be.empty;

    longestPaths.clear();
  });

  test('traversing the graph subscribes to changes', () => {
    registerSignalRuntime();
    const graph = new Graph();

    graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);

    const dispose = effect(() => {
      graph.traverse({
        visitor: (node, path) => {
          if (!longestPaths.has(node.id) || longestPaths.get(node.id)!.length < path.length) {
            longestPaths.set(node.id, path);
          }
        },
      });
    });

    expect(longestPaths.get('root')).to.deep.equal(['root']);
    expect(longestPaths.get('test1')).to.deep.equal(['root', 'test1']);
    expect(longestPaths.get('test2')).to.deep.equal(['root', 'test2']);
    expect(graph.root.nodes({ filter: filterLongestPath })).to.have.length(2);
    expect(graph.findNode('test1')?.nodes({ filter: filterLongestPath })).to.be.empty;
    expect(graph.findNode('test2')?.nodes({ filter: filterLongestPath })).to.be.empty;

    graph._addEdges([{ source: 'test1', target: 'test2' }]);

    expect(longestPaths.get('root')).to.deep.equal(['root']);
    expect(longestPaths.get('test1')).to.deep.equal(['root', 'test1']);
    expect(longestPaths.get('test2')).to.deep.equal(['root', 'test1', 'test2']);
    expect(graph.root.nodes({ filter: filterLongestPath })).to.have.length(1);
    expect(graph.findNode('test1')?.nodes({ filter: filterLongestPath })).to.have.length(1);
    expect(graph.findNode('test2')?.nodes({ filter: filterLongestPath })).to.be.empty;

    dispose();
    longestPaths.clear();
  });

  test('updates are constrained on connected nodes', () => {
    registerSignalRuntime();
    const graph = new Graph();
    const [node1] = graph._addNodes([{ id: 'test1', type: 'test', properties: { value: 1 } }]);
    using updates = updateCounter(() => {
      node1.nodes();
    });
    expect(updates.count, 'update count').to.eq(0);
    graph._addNodes([{ id: 'test2', type: 'test', properties: { value: 2 } }]);
    expect(updates.count, 'update count').to.eq(0);
    graph._addEdges([{ source: 'test1', target: 'test2' }]);
    expect(updates.count, 'update count').to.eq(1);
    graph._addNodes([{ id: 'test2', type: 'test', properties: { value: -2 } }]);
    expect(updates.count, 'update count').to.eq(1);
    graph._addNodes([{ id: 'test3', type: 'test', properties: { value: 3 } }]);
    expect(updates.count, 'update count').to.eq(1);
    graph._addEdges([{ source: 'test2', target: 'test3' }]);
    expect(updates.count, 'update count').to.eq(1);
    graph._addEdges([{ source: 'test1', target: 'test3' }]);
    expect(updates.count, 'update count').to.eq(2);
  });

  test('get path', () => {
    const graph = new Graph();

    graph._addNodes([
      {
        id: ROOT_ID,
        type: ROOT_TYPE,
        nodes: [
          { id: 'test1', type: 'test' },
          { id: 'test2', type: 'test' },
        ],
      },
    ]);
    graph._addEdges([{ source: 'test1', target: 'test2' }]);

    expect(graph.getPath({ target: 'test2' })).to.deep.equal(['root', 'test1', 'test2']);
    expect(graph.getPath({ source: 'test1', target: 'test2' })).to.deep.equal(['test1', 'test2']);
    expect(graph.getPath({ source: 'test2', target: 'test1' })).to.be.undefined;
  });
});
