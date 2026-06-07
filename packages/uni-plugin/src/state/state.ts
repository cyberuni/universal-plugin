export type ActionType = 'install' | 'upgrade' | 'remove'
export type DismissalReason = 'version-skipped' | 'keep'

export interface PendingAction {
  id: string
  type: ActionType
  plugin: string
  version: string
  fromVendor: string
  toVendor: string
  scope: string
  detectedAt: string
}

export interface DismissedEntry {
  reason: DismissalReason
  version: string | null
  dismissedAt: string
}

export interface ScopeSnapshot {
  takenAt: string
  plugins: Record<string, string>
}

export interface UniPluginUpdateEntry {
  current: string
  available: string
  detectedAt: string
}

export interface StateFile {
  schemaVersion: 1
  snapshots: Record<string, Record<string, ScopeSnapshot>>
  dismissed: Record<string, DismissedEntry>
  pendingActions: PendingAction[]
  uniPluginUpdates: Record<string, UniPluginUpdateEntry>
}

const KNOWN_ACTION_TYPES = new Set<string>(['install', 'upgrade', 'remove'])

export function emptyState(): StateFile {
  return {
    schemaVersion: 1,
    snapshots: {},
    dismissed: {},
    pendingActions: [],
    uniPluginUpdates: {},
  }
}

export function mergeSafeState(raw: StateFile): StateFile {
  return {
    ...raw,
    pendingActions: (raw.pendingActions ?? []).filter((a) => KNOWN_ACTION_TYPES.has(a.type)),
  }
}

export function takeSnapshot(
  state: StateFile,
  vendorId: string,
  scope: string,
  plugins: Record<string, string>,
  takenAt: string,
): StateFile {
  return {
    ...state,
    snapshots: {
      ...state.snapshots,
      [vendorId]: {
        ...(state.snapshots[vendorId] ?? {}),
        [scope]: { takenAt, plugins },
      },
    },
  }
}

export function isDismissed(
  state: StateFile,
  vendorId: string,
  scope: string,
  plugin: string,
  version: string,
): boolean {
  const entry = state.dismissed[`${vendorId}/${scope}/${plugin}`]
  if (!entry) return false
  if (entry.reason === 'keep') return true
  return entry.version === version
}

export function addPendingAction(state: StateFile, action: PendingAction): StateFile {
  const key = `${action.type}|${action.plugin}|${action.toVendor}|${action.scope}`
  const exists = state.pendingActions.some(
    (a) => `${a.type}|${a.plugin}|${a.toVendor}|${a.scope}` === key,
  )
  if (exists) return state
  return { ...state, pendingActions: [...state.pendingActions, action] }
}
