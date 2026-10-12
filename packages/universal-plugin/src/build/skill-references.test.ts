import { describe, expect, it } from 'vitest'
import { addPnpmNames, pnpmSkillName } from './skill-references.js'

const target = (packageName: string) => ({ plugin: 'demo', packageName, skills: new Set(['doctor', 'init']) })

describe('pnpmSkillName', () => {
	it('names an unscoped package', () => {
		expect(pnpmSkillName('demo', 'doctor')).toBe('pnpm-demo-doctor')
	})

	it('turns the slash of a scoped package into a plus', () => {
		expect(pnpmSkillName('@scope/demo', 'doctor')).toBe('pnpm-@scope+demo-doctor')
	})
})

describe('addPnpmNames', () => {
	it('adds the pnpm name after an unscoped reference', () => {
		expect(addPnpmNames('Run /demo:doctor first.', target('demo'))).toBe(
			'Run `/demo:doctor` (pnpm install: `pnpm-demo-doctor`) first.',
		)
	})

	it('adds the scoped pnpm name after a reference already in code', () => {
		expect(addPnpmNames('Run `/demo:doctor` first.', target('@scope/demo'))).toBe(
			'Run `/demo:doctor` (pnpm install: `pnpm-@scope+demo-doctor`) first.',
		)
	})

	it('is idempotent', () => {
		const once = addPnpmNames('Run /demo:doctor, then /demo:init.', target('@scope/demo'))
		expect(addPnpmNames(once, target('@scope/demo'))).toBe(once)
	})

	it('leaves a reference to an unresolvable plugin or skill alone', () => {
		const content = 'See /other:doctor and /demo:missing.'
		expect(addPnpmNames(content, target('demo'))).toBe(content)
	})

	it('leaves fenced code alone', () => {
		const content = ['```sh', '/demo:doctor --fix', '```', '~~~', '/demo:init', '~~~'].join('\n')
		expect(addPnpmNames(content, target('demo'))).toBe(content)
	})

	it('rewrites after a fence closes, and keeps CRLF', () => {
		const out = addPnpmNames('```\r\n/demo:init\r\n```\r\n/demo:init\r\n', target('demo'))
		expect(out).toBe('```\r\n/demo:init\r\n```\r\n`/demo:init` (pnpm install: `pnpm-demo-init`)\r\n')
	})

	it('leaves a command example in an inline span, a path and a URL alone', () => {
		const content = 'Type `/demo:doctor --fix`, see /usr/demo:doctor or https://x.dev/demo:doctor.'
		expect(addPnpmNames(content, target('demo'))).toBe(content)
	})
})
