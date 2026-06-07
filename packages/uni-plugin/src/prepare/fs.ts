import * as fsNode from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { emptyState, mergeSafeState } from '../state/state.js'
import type { StateFile } from '../state/state.js'
import type { VendorConfig } from '../vendor-registry/vendor-registry.js'

export interface PrepareFs {
  readManifest(): Record<string, string>
  readGlobalState(): StateFile
  readProjectState(): StateFile | null
  writeGlobalState(state: StateFile): void
  writeProjectState(state: StateFile): void
}

function globalStatePath(): string {
  return path.join(os.homedir(), '.agents', 'uni-plugin.json')
}

function projectStatePath(root: string): string {
  return path.join(root, '.agents', 'uni-plugin.json')
}

function readStateFile(filePath: string): StateFile | null {
  try {
    return mergeSafeState(JSON.parse(fsNode.readFileSync(filePath, 'utf8')) as StateFile)
  } catch {
    return null
  }
}

function writeStateFile(filePath: string, state: StateFile): void {
  fsNode.mkdirSync(path.dirname(filePath), { recursive: true })
  fsNode.writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n', 'utf8')
}

export function realPrepareFs(vendor: VendorConfig, projectRoot?: string): PrepareFs {
  return {
    readManifest(): Record<string, string> {
      if (!vendor.globalManifest) return {}
      const manifestPath = vendor.globalManifest.replace('~', os.homedir())
      try {
        const raw = JSON.parse(fsNode.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
        // Claude Code installed_plugins.json: keys are plugin names, values are objects with a version field
        return Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [
            k,
            typeof v === 'object' && v !== null && 'version' in v
              ? String((v as Record<string, unknown>).version)
              : String(v),
          ]),
        )
      } catch {
        return {}
      }
    },
    readGlobalState: () => readStateFile(globalStatePath()) ?? emptyState(),
    readProjectState: () =>
      projectRoot ? readStateFile(projectStatePath(projectRoot)) : null,
    writeGlobalState: (s) => writeStateFile(globalStatePath(), s),
    writeProjectState: (s) => {
      if (projectRoot) writeStateFile(projectStatePath(projectRoot), s)
    },
  }
}
