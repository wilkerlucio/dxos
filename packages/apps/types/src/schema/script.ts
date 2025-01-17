//
// Copyright 2024 DXOS.org
//

import { ref, S, TypedObject } from '@dxos/echo-schema';

import { TextType } from './document';

export class ScriptType extends TypedObject({ typename: 'dxos.org/type/Script', version: '0.1.0' })({
  name: S.optional(S.String),
  source: ref(TextType),

  // Local binding to a function name.
  binding: S.optional(S.String),
  // Whether source has changed since last deploy.
  changed: S.optional(S.Boolean),
}) {}
