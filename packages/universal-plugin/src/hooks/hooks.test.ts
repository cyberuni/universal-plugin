import { describe, expect, it } from 'vitest'
import { type CanonicalHooksFile, translateHooks } from './hooks.js'

function canonical(hooks: CanonicalHooksFile['hooks']): CanonicalHooksFile {
	return { hooks }
}

const sessionStartCommand = canonical({
	SessionStart: [{ hooks: [{ type: 'command', command: './scripts/start.sh' }] }],
})

describe('translateHooks', () => {
	it('leaves the canonical form alone for claude-code', () => {
		const result = translateHooks(sessionStartCommand, 'claude-code')
		expect(result.hooks).toEqual(sessionStartCommand)
		expect(result.changed).toBe(false)
		expect(result.drops).toEqual([])
	})

	it('leaves the canonical form alone for codex when every handler is a command', () => {
		expect(translateHooks(sessionStartCommand, 'codex').changed).toBe(false)
	})

	it('leaves the canonical form alone for copilot-cli — PascalCase is its Claude-compatible format', () => {
		expect(translateHooks(sessionStartCommand, 'copilot-cli').changed).toBe(false)
	})

	it('lowercases the leading letter of each event name for cursor', () => {
		const result = translateHooks(
			canonical({
				SessionStart: [{ hooks: [{ type: 'command', command: './a.sh' }] }],
				PreToolUse: [{ hooks: [{ type: 'command', command: './b.sh' }] }],
			}),
			'cursor',
		)
		expect(Object.keys(result.hooks?.hooks ?? {})).toEqual(['sessionStart', 'preToolUse'])
		expect(result.changed).toBe(true)
	})

	it('flattens matcher groups and repeats the matcher on each handler for cursor', () => {
		const result = translateHooks(
			canonical({
				PreToolUse: [
					{
						matcher: 'Write|Edit',
						hooks: [
							{ type: 'command', command: './a.sh' },
							{ type: 'command', command: './b.sh' },
						],
					},
				],
			}),
			'cursor',
		)
		expect(result.hooks?.hooks['preToolUse']).toEqual([
			{ type: 'command', command: './a.sh', matcher: 'Write|Edit' },
			{ type: 'command', command: './b.sh', matcher: 'Write|Edit' },
		])
	})

	it('carries the schema version cursor expects, and none for codex', () => {
		expect(translateHooks(sessionStartCommand, 'cursor').hooks?.version).toBe(1)
		expect(translateHooks(sessionStartCommand, 'codex').hooks?.version).toBeUndefined()
	})

	it('drops the handler types codex cannot run', () => {
		const result = translateHooks(
			canonical({
				SessionStart: [
					{
						hooks: [
							{ type: 'command', command: './a.sh' },
							{ type: 'prompt', prompt: 'check' },
							{ type: 'http', url: 'https://example.com/hook' },
						],
					},
				],
			}),
			'codex',
		)
		expect(result.drops).toEqual([
			{ event: 'SessionStart', type: 'prompt' },
			{ event: 'SessionStart', type: 'http' },
		])
		expect(result.hooks?.hooks['SessionStart']).toEqual([{ hooks: [{ type: 'command', command: './a.sh' }] }])
		expect(result.changed).toBe(true)
	})

	it('keeps prompt handlers for cursor and drops http and agent', () => {
		const result = translateHooks(
			canonical({
				SessionStart: [
					{
						hooks: [
							{ type: 'prompt', prompt: 'check' },
							{ type: 'http', url: 'https://example.com/hook' },
							{ type: 'agent', prompt: 'verify' },
						],
					},
				],
			}),
			'cursor',
		)
		expect(result.drops).toEqual([
			{ event: 'SessionStart', type: 'http' },
			{ event: 'SessionStart', type: 'agent' },
		])
		expect(result.hooks?.hooks['sessionStart']).toEqual([{ type: 'prompt', prompt: 'check' }])
	})

	it('keeps http and prompt for copilot-cli and drops agent', () => {
		const result = translateHooks(
			canonical({
				SessionStart: [
					{
						hooks: [
							{ type: 'http', url: 'https://example.com/hook' },
							{ type: 'prompt', prompt: 'check' },
							{ type: 'agent', prompt: 'verify' },
						],
					},
				],
			}),
			'copilot-cli',
		)
		expect(result.drops).toEqual([{ event: 'SessionStart', type: 'agent' }])
	})

	it('keeps every canonical handler type for claude-code', () => {
		const result = translateHooks(
			canonical({
				SessionStart: [
					{
						hooks: [
							{ type: 'command', command: './a.sh' },
							{ type: 'http', url: 'https://example.com/hook' },
							{ type: 'prompt', prompt: 'check' },
							{ type: 'agent', prompt: 'verify' },
						],
					},
				],
			}),
			'claude-code',
		)
		expect(result.drops).toEqual([])
		expect(result.changed).toBe(false)
	})

	it('treats a handler with no type as a command', () => {
		const result = translateHooks(canonical({ SessionStart: [{ hooks: [{ command: './a.sh' }] }] }), 'codex')
		expect(result.drops).toEqual([])
	})

	it('omits an event whose every handler was dropped, and keeps the rest', () => {
		const result = translateHooks(
			canonical({
				SessionStart: [{ hooks: [{ type: 'prompt', prompt: 'check' }] }],
				Stop: [{ hooks: [{ type: 'command', command: './a.sh' }] }],
			}),
			'codex',
		)
		expect(Object.keys(result.hooks?.hooks ?? {})).toEqual(['Stop'])
	})

	it('returns no hooks file at all when every handler was dropped', () => {
		const result = translateHooks(
			canonical({ SessionStart: [{ hooks: [{ type: 'http', url: 'https://x.test' }] }] }),
			'codex',
		)
		expect(result.hooks).toBeNull()
		expect(result.drops).toEqual([{ event: 'SessionStart', type: 'http' }])
	})

	it('passes an unknown vendor through untouched', () => {
		const result = translateHooks(sessionStartCommand, 'acme')
		expect(result.hooks).toEqual(sessionStartCommand)
		expect(result.changed).toBe(false)
	})
})
