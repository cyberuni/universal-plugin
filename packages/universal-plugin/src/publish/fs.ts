import { type JsonIo, realJsonIo } from '../version/fs.js'

/** `sync-version` reads and writes JSON the same way `plugin version` does — same interface, same
 *  applier — so the two directions of the version flow cannot drift. */
export type SyncVersionFs = JsonIo

export const realSyncVersionFs: SyncVersionFs = realJsonIo
