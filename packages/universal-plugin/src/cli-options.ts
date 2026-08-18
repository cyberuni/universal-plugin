import * as fs from 'node:fs'
import * as path from 'node:path'

import { Option } from 'commander'

/** Repo root; resolves to cwd when omitted. */
export const ROOT_OPTION = new Option('--root <path>', 'Plugin root directory')

export interface RootDeps {
	cwd: string
	exists: (candidate: string) => boolean
}

/** Resolves `--root` to an absolute directory. Every command reports and joins against this path,
 *  so it must name a real directory rather than a fragment of one.
 *
 *  A relative root resolves against the cwd, with one repair: in a monorepo a package is named by
 *  its workspace-relative path (`packages/pods`), and passing that from inside the package itself
 *  re-joins it onto a cwd that already ends with it — `<repo>/packages/pods/packages/pods`, a
 *  directory that does not exist. When the re-joined path is missing and the cwd already ends with
 *  the given path, the cwd is the package that was named. */
export function resolveRoot(root?: string, deps: Partial<RootDeps> = {}): string {
	const cwd = deps.cwd ?? process.cwd()
	const exists = deps.exists ?? ((candidate: string) => fs.existsSync(candidate))
	if (root === undefined) return cwd

	const resolved = path.resolve(cwd, root)
	if (path.isAbsolute(root) || exists(resolved)) return resolved

	// `path.normalize` keeps a trailing separator, which `endsWith` must not see.
	const relative = path.normalize(root).replace(new RegExp(`\\${path.sep}+$`), '')
	return cwd.endsWith(path.sep + relative) ? cwd : resolved
}
