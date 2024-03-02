//
// Copyright 2024 DXOS.org
//

import { type Router, type RouteOptions as NaturalRouteOptions } from '@tanstack/react-router';

import { type Plugin } from '@dxos/app-framework';

export type RouteOptions = Omit<NaturalRouteOptions, 'getParentRoute'> & {
  parentId: string;
  id: string;
  path?: string;
};

export type RoutesProvides = {
  navigation: {
    routes: (createRoute: (options: RouteOptions) => void) => void;
  };
};

export type RouterProvides = {
  navigation: {
    router: Router;
  };
};

// TODO(wittjosiah): Effect Schema for parsing?

const parseRoutesExists = (plugin: Plugin) => {
  return 'navigation' in plugin.provides && plugin.provides.navigation && typeof plugin.provides.navigation === 'object'
    ? plugin.provides.navigation
    : undefined;
};

export const parseRoutesPlugin = (plugin: Plugin) => {
  const navigation = parseRoutesExists(plugin);
  return navigation && 'routes' in navigation && typeof navigation.routes === 'function'
    ? (plugin as Plugin<RoutesProvides>)
    : undefined;
};

export const parseRouterProvides = (plugin: Plugin) => {
  return 'router' in plugin.provides &&
    plugin.provides.router &&
    typeof plugin.provides.router === 'object' &&
    'routeTree' in plugin.provides.router &&
    plugin.provides.router.routeTree
    ? (plugin as Plugin<RouterProvides>)
    : undefined;
};