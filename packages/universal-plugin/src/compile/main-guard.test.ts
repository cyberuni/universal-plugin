import { describe, expect, it } from 'vitest'

import { neutralizeMainGuards } from './main-guard.js'

describe('neutralizeMainGuards', () => {
	it.each([
		[
			'if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main()',
			'if (process.argv[1] && false) main()',
		],
		['if (pathToFileURL(process.argv[1]).href == import.meta.url) main()', 'if (false) main()'],
		['if (url.pathToFileURL(process.argv[1]).href === import.meta.url) main()', 'if (false) main()'],
		['if (fileURLToPath(import.meta.url) === process.argv[1]) main()', 'if (false) main()'],
		['if (process.argv[1] === fileURLToPath(import.meta.url)) main()', 'if (false) main()'],
		['if (fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) main()', 'if (false) main()'],
		['if (fileURLToPath(import.meta.url) === path.resolve(realpathSync(process.argv[1]))) main()', 'if (false) main()'],
		['if (import.meta.main) main()', 'if (false) main()'],
	])('turns %s off', (code, expected) => {
		expect(neutralizeMainGuards(code)).toBe(expected)
	})

	it('leaves other uses of import.meta.url alone', () => {
		expect(neutralizeMainGuards("const here = new URL('.', import.meta.url)")).toBeUndefined()
	})
})
