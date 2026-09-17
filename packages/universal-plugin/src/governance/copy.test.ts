import { describe, expect, it } from 'vitest'
import {
	governanceName,
	loadInstruction,
	referencedGovernances,
	rewriteGovernancePointers,
	unlistedGovernanceCopies,
} from './copy.js'

describe('governanceName', () => {
	it('keeps a plain name', () => {
		expect(governanceName('skill-design')).toBe('skill-design')
	})

	it('drops the plugin prefix of a namespaced lookup', () => {
		expect(governanceName('universal-plugin/plugin-design')).toBe('plugin-design')
	})

	it('drops a trailing .md', () => {
		expect(governanceName('plugin-design.md')).toBe('plugin-design')
	})
})

describe('referencedGovernances', () => {
	it('finds a pinned npx pointer', () => {
		expect(referencedGovernances('npx universal-plugin@0.8.0 governance show skill-design')).toEqual(['skill-design'])
	})

	it('finds a bare pointer in prose', () => {
		expect(referencedGovernances('`governance show plugin-design` is the authority on that call.')).toEqual([
			'plugin-design',
		])
	})

	it('returns each name once, in first-appearance order', () => {
		const body = [
			'npx cyberplace@1 governance show skill-design',
			'npx cyberplace@1 governance show agent-tool-output',
			'see `governance show skill-design` again',
		].join('\n')
		expect(referencedGovernances(body)).toEqual(['skill-design', 'agent-tool-output'])
	})

	it('finds nothing in a body with no pointer', () => {
		expect(referencedGovernances('# Plugin Design\n\nAuthor plugin.json at the plugin root.')).toEqual([])
	})
})

describe('rewriteGovernancePointers', () => {
	it('replaces a prose pointer with the load instruction', () => {
		const out = rewriteGovernancePointers('See `governance show skill-design` for the rules.')
		expect(out).toBe(loadInstruction('skill-design'))
	})

	it('unwraps a fence that held nothing but pointers', () => {
		const body = [
			'## References',
			'',
			'```bash',
			'npx universal-plugin@<version> governance show skill-design',
			'npx universal-plugin@<version> governance show agent-tool-output',
			'```',
			'',
			'Spec: https://example.invalid/spec',
		].join('\n')
		expect(rewriteGovernancePointers(body)).toBe(
			[
				'## References',
				'',
				loadInstruction('skill-design'),
				loadInstruction('agent-tool-output'),
				'',
				'Spec: https://example.invalid/spec',
			].join('\n'),
		)
	})

	it('keeps a fence that mixes a pointer with a real command', () => {
		const body = ['```bash', 'universal-plugin plugin build', 'governance show skill-design', '```'].join('\n')
		expect(rewriteGovernancePointers(body)).toBe(
			['```bash', 'universal-plugin plugin build', loadInstruction('skill-design'), '```'].join('\n'),
		)
	})

	it('preserves indentation, so a pointer inside a list stays in its list', () => {
		const out = rewriteGovernancePointers('- Governance: `npx cyberplace@1 governance show skill-design`')
		expect(out).toBe(`- ${loadInstruction('skill-design')}`)
	})

	it('rewrites a namespaced pointer to the sibling copy', () => {
		expect(rewriteGovernancePointers('governance show universal-plugin/plugin-design')).toBe(
			loadInstruction('plugin-design'),
		)
	})

	it('leaves a body with no pointer byte-for-byte alone', () => {
		const body = '# Plugin Design\n\nAuthor `plugin.json` at the plugin root.\n'
		expect(rewriteGovernancePointers(body)).toBe(body)
	})

	it('keeps CRLF line endings', () => {
		expect(rewriteGovernancePointers('a\r\ngovernance show skill-design\r\nb')).toBe(
			`a\r\n${loadInstruction('skill-design')}\r\nb`,
		)
	})
})

describe('unlistedGovernanceCopies', () => {
	const skill = (references: string) => `---\nname: demo\n---\n\n# Demo\n\nBody.\n\n## References\n\n${references}\n`

	it('accepts a bullet naming the copy', () => {
		const md = skill('- Governance: `references/governances/plugin-design.md`')
		expect(unlistedGovernanceCopies(md, ['plugin-design'])).toEqual([])
	})

	it('accepts a markdown link to the copy', () => {
		const md = skill('- [Plugin design](references/governances/plugin-design.md)')
		expect(unlistedGovernanceCopies(md, ['plugin-design'])).toEqual([])
	})

	it('reports a copy the References section never names', () => {
		const md = skill('- Governance: `references/governances/plugin-design.md`')
		expect(unlistedGovernanceCopies(md, ['plugin-design', 'skill-design'])).toEqual(['skill-design'])
	})

	it('reports every copy when the skill has no References section', () => {
		expect(unlistedGovernanceCopies('---\nname: demo\n---\n\n# Demo\n', ['plugin-design'])).toEqual(['plugin-design'])
	})

	it('does not count a mention outside the References section', () => {
		const md =
			'# Demo\n\nRead `references/governances/plugin-design.md`.\n\n## References\n\n- Spec: https://x.invalid\n'
		expect(unlistedGovernanceCopies(md, ['plugin-design'])).toEqual(['plugin-design'])
	})

	it('stops the section at the next heading of the same level', () => {
		const md = '## References\n\n- Spec\n\n## Appendix\n\n- `references/governances/plugin-design.md`\n'
		expect(unlistedGovernanceCopies(md, ['plugin-design'])).toEqual(['plugin-design'])
	})
})
