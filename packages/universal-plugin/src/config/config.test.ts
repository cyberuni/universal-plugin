import { describe, expect, it } from 'vitest'
import { addEntry, getEntries, isReservedKey } from './config.js'

describe('isReservedKey', () => {
	it('treats packagePath as reserved and plugin keys as not', () => {
		expect(isReservedKey('packagePath')).toBe(true)
		expect(isReservedKey('sdd-plugins')).toBe(false)
		expect(isReservedKey('vendors')).toBe(false)
	})
})

describe('getEntries', () => {
	it('returns the array at a key', () => {
		expect(getEntries({ 'sdd-plugins': [{ name: 'aces' }] }, 'sdd-plugins')).toEqual([{ name: 'aces' }])
	})

	it('returns an empty array for an absent key', () => {
		expect(getEntries({}, 'sdd-plugins')).toEqual([])
	})

	it('returns an empty array when the key is present but not an array', () => {
		expect(getEntries({ 'sdd-plugins': 'oops' }, 'sdd-plugins')).toEqual([])
	})
})

describe('addEntry', () => {
	it('appends when no entry shares the name', () => {
		const r = addEntry({ 'sdd-plugins': [{ name: 'quill' }] }, 'sdd-plugins', { name: 'aces' })
		expect(r.action).toBe('appended')
		expect(r.config['sdd-plugins']).toEqual([{ name: 'quill' }, { name: 'aces' }])
	})

	it('creates the key when absent', () => {
		const r = addEntry({}, 'sdd-plugins', { name: 'aces' })
		expect(r.action).toBe('appended')
		expect(r.config['sdd-plugins']).toEqual([{ name: 'aces' }])
	})

	it('replaces a same-name entry in place, preserving array position', () => {
		const r = addEntry(
			{ 'sdd-plugins': [{ name: 'quill' }, { name: 'aces', handles: ['old'] }, { name: 'cyberplace' }] },
			'sdd-plugins',
			{ name: 'aces', handles: ['new'] },
		)
		expect(r.action).toBe('replaced')
		expect(r.config['sdd-plugins']).toEqual([
			{ name: 'quill' },
			{ name: 'aces', handles: ['new'] },
			{ name: 'cyberplace' },
		])
	})

	it('preserves every other top-level key', () => {
		const r = addEntry(
			{ packagePath: 'packages/universal-plugin', 'other-plugins': [{ name: 'x' }], future: 42 },
			'sdd-plugins',
			{ name: 'aces' },
		)
		expect(r.config.packagePath).toBe('packages/universal-plugin')
		expect(r.config['other-plugins']).toEqual([{ name: 'x' }])
		expect(r.config.future).toBe(42)
	})

	it('does not mutate the input config', () => {
		const input = { 'sdd-plugins': [{ name: 'quill' }] }
		addEntry(input, 'sdd-plugins', { name: 'aces' })
		expect(input['sdd-plugins']).toEqual([{ name: 'quill' }])
	})

	it('throws when the entry has no name', () => {
		expect(() => addEntry({}, 'sdd-plugins', { handles: ['x'] })).toThrow(/name/)
	})

	it('throws when the entry is not an object', () => {
		expect(() => addEntry({}, 'sdd-plugins', 'just a string')).toThrow(/JSON object/)
		expect(() => addEntry({}, 'sdd-plugins', [1, 2])).toThrow(/JSON object/)
	})
})
