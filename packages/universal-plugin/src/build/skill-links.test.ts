import { describe, expect, it } from 'vitest'
import { escapingLinks } from './skill-links.js'

describe('escapingLinks', () => {
	it('finds a link that climbs above the skill folder', () => {
		expect(escapingLinks('See [the readme](../../readme.md#upx).', 'SKILL.md')).toEqual([
			{ target: '../../readme.md#upx', line: 1 },
		])
	})

	it('keeps a link that climbs and stays inside', () => {
		expect(escapingLinks('[frontmatter](../frontmatter.md)', 'references/vendors/claude-code.md')).toEqual([])
	})

	it('finds a link from a nested file that climbs one level too many', () => {
		expect(escapingLinks('[adr](../../../spec.md)', 'references/vendors/a.md')).toEqual([
			{ target: '../../../spec.md', line: 1 },
		])
	})

	it('ignores URLs, absolute paths and anchors', () => {
		const content = ['[a](https://example.com/x)', '[b](/abs/path.md)', '[c](#section)', '[d](mailto:x@y.z)'].join('\n')
		expect(escapingLinks(content, 'SKILL.md')).toEqual([])
	})

	it('finds an image and a reference definition', () => {
		const content = ['![diagram](../shared/d.png "title")', '', '[spec]: ../../spec.md'].join('\n')
		expect(escapingLinks(content, 'SKILL.md')).toEqual([
			{ target: '../shared/d.png', line: 1 },
			{ target: '../../spec.md', line: 3 },
		])
	})

	it('skips fenced code and inline code', () => {
		const content = ['```md', '[x](../../x.md)', '```', 'Write `[y](../y.md)` like this.'].join('\n')
		expect(escapingLinks(content, 'SKILL.md')).toEqual([])
	})

	it('reports the line of each link', () => {
		expect(escapingLinks('intro\n\n[a](../a.md) and [b](../b.md)', 'SKILL.md')).toEqual([
			{ target: '../a.md', line: 3 },
			{ target: '../b.md', line: 3 },
		])
	})
})
