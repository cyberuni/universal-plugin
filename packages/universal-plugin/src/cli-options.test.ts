import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveRoot } from './cli-options.js'

const REPO = path.resolve('/repo')
const PACKAGE = path.join(REPO, 'packages', 'pods')

/** `exists` over a fixed set of directories, so these cases never touch a real filesystem. */
function existsIn(...dirs: string[]) {
	return (candidate: string) => dirs.includes(candidate)
}

describe('resolveRoot', () => {
	it('falls back to the cwd when no root is given', () => {
		expect(resolveRoot(undefined, { cwd: PACKAGE, exists: existsIn(PACKAGE) })).toBe(PACKAGE)
	})

	it('returns an absolute root unchanged', () => {
		expect(resolveRoot(PACKAGE, { cwd: REPO, exists: existsIn(PACKAGE) })).toBe(PACKAGE)
	})

	it('resolves "." to the cwd itself', () => {
		expect(resolveRoot('.', { cwd: PACKAGE, exists: existsIn(PACKAGE) })).toBe(PACKAGE)
	})

	it('resolves a relative root against the cwd', () => {
		expect(resolveRoot('packages/pods', { cwd: REPO, exists: existsIn(REPO, PACKAGE) })).toBe(PACKAGE)
	})

	// The reported pnpm-monorepo failure: a workspace-relative root named from inside that same
	// workspace package re-joined onto the cwd, giving /repo/packages/pods/packages/pods.
	it('does not re-join a workspace-relative root onto a cwd already inside it', () => {
		expect(resolveRoot('packages/pods', { cwd: PACKAGE, exists: existsIn(REPO, PACKAGE) })).toBe(PACKAGE)
	})

	it('keeps the re-joined path when it actually exists', () => {
		const nested = path.join(PACKAGE, 'packages', 'pods')
		expect(resolveRoot('packages/pods', { cwd: PACKAGE, exists: existsIn(PACKAGE, nested) })).toBe(nested)
	})

	it('leaves an unrelated missing relative root alone, so the command reports the real path', () => {
		const missing = path.join(PACKAGE, 'packages', 'other')
		expect(resolveRoot('packages/other', { cwd: PACKAGE, exists: existsIn(PACKAGE) })).toBe(missing)
	})
})
