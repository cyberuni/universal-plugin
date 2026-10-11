import { describe, expect, it } from 'vitest'
import {
	extractPins,
	isPackageRunner,
	markedMcpVersions,
	pinRunnerArgs,
	splitSpecifier,
	stampMcpServers,
	stripPinMarkers,
} from './pin.js'

describe('extractPins', () => {
	it('extracts a single npx pin', () => {
		const pins = extractPins('Run `npx cyberplace@1.2.0` to install.')
		expect(pins).toEqual([{ pkg: 'cyberplace', current: '1.2.0', file: '', runner: 'npx' }])
	})

	it('extracts a single upx pin', () => {
		const pins = extractPins('Run `upx cyberplace@1.2.0` to install.')
		expect(pins).toEqual([{ pkg: 'cyberplace', current: '1.2.0', file: '', runner: 'upx' }])
	})

	it('extracts multiple pins', () => {
		const pins = extractPins('npx cyberplace@1.2.0 and npx cyberfleet@1.0.0')
		expect(pins.map((p) => p.pkg)).toEqual(['cyberplace', 'cyberfleet'])
	})

	it('extracts a scoped package', () => {
		const pins = extractPins('npx @cyberuni/tool@2.0.0')
		expect(pins[0]?.pkg).toBe('@cyberuni/tool')
	})

	it('strips a trailing backtick from the pin', () => {
		const pins = extractPins('`npx cyberplace@1.2.0`')
		expect(pins[0]?.current).toBe('1.2.0')
	})

	it('strips a trailing quote from the pin', () => {
		const pins = extractPins('"npx cyberplace@1.2.0"')
		expect(pins[0]?.current).toBe('1.2.0')
	})

	it('handles a placeholder pin', () => {
		const pins = extractPins('npx cyberplace@<version>')
		expect(pins[0]?.current).toBe('<version>')
	})

	it('handles --yes / -y prefixes', () => {
		expect(extractPins('npx --yes cyberplace@1.2.0')[0]?.pkg).toBe('cyberplace')
		expect(extractPins('npx -y cyberplace@1.2.0')[0]?.pkg).toBe('cyberplace')
	})

	it('returns empty when no pin is present', () => {
		expect(extractPins('no references here')).toEqual([])
	})
})

describe('splitSpecifier', () => {
	it('splits a plain name and version', () => {
		expect(splitSpecifier('cyber-asana@1.2.0')).toEqual({ pkg: 'cyber-asana', version: '1.2.0' })
	})

	it('treats a scope @ as the scope separator, not the version one', () => {
		expect(splitSpecifier('@cyberuni/server')).toEqual({ pkg: '@cyberuni/server' })
		expect(splitSpecifier('@cyberuni/server@2.0.0')).toEqual({ pkg: '@cyberuni/server', version: '2.0.0' })
	})

	it('reports no version when there is none', () => {
		expect(splitSpecifier('cyber-asana')).toEqual({ pkg: 'cyber-asana' })
	})
})

describe('isPackageRunner', () => {
	it('accepts the runner words and nothing else', () => {
		expect(isPackageRunner('npx')).toBe(true)
		expect(isPackageRunner('upx')).toBe(true)
		expect(isPackageRunner('node')).toBe(false)
		expect(isPackageRunner(undefined)).toBe(false)
	})
})

describe('pinRunnerArgs', () => {
	it('skips the -y and --yes flags to find the specifier', () => {
		expect(pinRunnerArgs(['-y', 'cyber-asana', 'mcp'], '1.0.0')?.args).toEqual(['-y', 'cyber-asana@1.0.0', 'mcp'])
		expect(pinRunnerArgs(['--yes', 'cyber-asana'], '1.0.0')?.args).toEqual(['--yes', 'cyber-asana@1.0.0'])
	})

	it('reports the version the argv already carried', () => {
		expect(pinRunnerArgs(['-y', 'cyber-asana@0.9.0'], '1.0.0')?.previous).toBe('0.9.0')
		expect(pinRunnerArgs(['-y', 'cyber-asana'], '1.0.0')?.previous).toBeUndefined()
	})

	it('returns null when the argv carries no package specifier', () => {
		expect(pinRunnerArgs(['-y'], '1.0.0')).toBeNull()
		expect(pinRunnerArgs([], '1.0.0')).toBeNull()
	})
})

describe('stampMcpServers', () => {
	const marked = { command: 'npx', args: ['-y', 'cyber-asana', 'mcp'], pinToPluginVersion: true }

	it('stamps a marked entry and keeps the marker for the next stamp', () => {
		const result = stampMcpServers({ srv: marked }, '1.0.0')
		expect(result.servers['srv']).toEqual({ ...marked, args: ['-y', 'cyber-asana@1.0.0', 'mcp'] })
		expect(result.changed).toBe(true)
		expect(result.notes).toEqual([])
	})

	it('leaves an unmarked entry untouched and reports no change', () => {
		const entry = { command: 'npx', args: ['-y', 'cyber-asana', 'mcp'] }
		const result = stampMcpServers({ srv: entry }, '1.0.0')
		expect(result.servers['srv']).toEqual(entry)
		expect(result.changed).toBe(false)
	})

	it('reports no change when the entry already carries the version', () => {
		const result = stampMcpServers({ srv: { ...marked, args: ['-y', 'cyber-asana@1.0.0'] } }, '1.0.0')
		expect(result.changed).toBe(false)
	})

	it('notes each guard and leaves the entry unstamped', () => {
		expect(
			stampMcpServers({ srv: { command: 'node', args: ['./s.js'], pinToPluginVersion: true } }, '1.0.0').notes,
		).toEqual([{ server: 'srv', kind: 'not-a-runner' }])
		expect(stampMcpServers({ srv: { command: 'npx', args: ['-y'], pinToPluginVersion: true } }, '1.0.0').notes).toEqual(
			[{ server: 'srv', kind: 'no-specifier' }],
		)
	})

	it('passes a non-object entry through untouched', () => {
		const result = stampMcpServers({ a: 'not-an-object', b: null, c: [1, 2] }, '1.0.0')
		expect(result.servers).toEqual({ a: 'not-an-object', b: null, c: [1, 2] })
		expect(result.changed).toBe(false)
	})
})

describe('stripPinMarkers', () => {
	it('strips the marker and copies the authored version', () => {
		const result = stripPinMarkers({
			srv: { command: 'npx', args: ['-y', 'cyber-asana@0.9.0'], pinToPluginVersion: true },
		})
		expect(result.servers['srv']).toEqual({ command: 'npx', args: ['-y', 'cyber-asana@0.9.0'] })
		expect(result.changed).toBe(true)
	})

	it('strips a false marker — it is still a directive no vendor should see', () => {
		const result = stripPinMarkers({ srv: { command: 'npx', args: ['-y', 'x'], pinToPluginVersion: false } })
		expect(result.servers['srv']).toEqual({ command: 'npx', args: ['-y', 'x'] })
		expect(result.changed).toBe(true)
	})

	it('reports no change when nothing is marked', () => {
		expect(stripPinMarkers({ srv: { command: 'npx', args: ['x'] }, b: null }).changed).toBe(false)
	})
})

describe('markedMcpVersions', () => {
	it('lists the version each marked runner entry carries', () => {
		expect(
			markedMcpVersions({
				a: { command: 'npx', args: ['-y', 'x@1.0.0'], pinToPluginVersion: true },
				b: { command: 'npx', args: ['-y', 'y'], pinToPluginVersion: true },
				c: { command: 'npx', args: ['-y', 'z@2.0.0'] },
				d: { command: 'node', args: ['s.js'], pinToPluginVersion: true },
			}),
		).toEqual([{ server: 'a', version: '1.0.0' }, { server: 'b' }])
	})
})

describe('pinRunnerArgs — carrying the rest of the argv through', () => {
	it('rewrites only the specifier slot and leaves every other argument as authored', () => {
		// A non-string element elsewhere in args is data the runner passes on; stringifying it would
		// silently change an argument this function was never asked to touch.
		const args = ['-y', 'cyber-asana', 'mcp', null, 7]
		expect(pinRunnerArgs(args, '1.0.0')?.args).toEqual(['-y', 'cyber-asana@1.0.0', 'mcp', null, 7])
	})

	it('skips a non-string argument while looking for the specifier', () => {
		expect(pinRunnerArgs([null, 'cyber-asana'], '1.0.0')?.args).toEqual([null, 'cyber-asana@1.0.0'])
	})
})
