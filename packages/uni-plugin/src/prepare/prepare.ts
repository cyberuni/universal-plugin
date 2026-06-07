import { addPendingAction, emptyState, takeSnapshot } from '../state/state.js'
import type { StateFile } from '../state/state.js'
import { computeDelta } from './delta.js'
import type { PrepareFs } from './fs.js'

export interface PrepareOptions {
  vendorId: string
  scope: 'global' | 'project'
  fs: PrepareFs
  now: string
  dryRun?: boolean
}

export interface PrepareResult {
  newActionCount: number
}

export function runPrepare(opts: PrepareOptions): PrepareResult {
  const { vendorId, scope, fs: prepareFs, now, dryRun } = opts

  const currentPlugins = prepareFs.readManifest()
  const state =
    scope === 'global'
      ? prepareFs.readGlobalState()
      : (prepareFs.readProjectState() ?? emptyState())

  const actions = computeDelta({ vendorId, scope, currentPlugins, state, now })

  let updatedState: StateFile = takeSnapshot(state, vendorId, scope, currentPlugins, now)
  for (const action of actions) {
    updatedState = addPendingAction(updatedState, action)
  }

  if (!dryRun) {
    if (scope === 'global') prepareFs.writeGlobalState(updatedState)
    else prepareFs.writeProjectState(updatedState)
  }

  return { newActionCount: actions.length }
}
