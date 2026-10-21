/** A script's main guard runs its CLI only when the script is the process's main module. Once a
 *  compile inlines one script into another, every inlined module shares the output file's
 *  `import.meta.url`, so every inlined guard would pass and every inlined CLI would run (issue #192).
 *  The compile keeps the entry's guard and turns the others to `false`.
 *
 *  Recognized forms:
 *  - `import.meta.main`
 *  - `import.meta.url === pathToFileURL(…).href`, either side, `==` or `===`
 *  - `fileURLToPath(import.meta.url) === …` or `… === fileURLToPath(import.meta.url)` where `…` is
 *    `process.argv[1]` or a call around it, such as `realpathSync(process.argv[1])` */

// A call's arguments, up to three levels of nested parentheses.
const ARGS = String.raw`\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)`
const META_URL = String.raw`import\.meta\.url`
const EQ = String.raw`\s*===?\s*`
const TO_FILE_URL = String.raw`(?<!\w)(?:\w+\.)?pathToFileURL${ARGS}\.href`
const FROM_META_URL = String.raw`(?<!\w)(?:\w+\.)?fileURLToPath\(\s*${META_URL}\s*\)`
// `process.argv[1]`, bare or wrapped in up to two calls; each wrapper's parentheses must balance,
// so the guard's own `if (…)` is never consumed.
const ARGV = String.raw`process\.argv\[1\]`
// Anchored at the start of an identifier run, so a long run of `[\w.]` is scanned once, not once per
// start position.
const CALL = String.raw`(?<![\w.])[\w.]+\(\s*`
const ARGV1 = String.raw`(?:${CALL}${CALL}${ARGV}\s*\)\s*\)|${CALL}${ARGV}\s*\)|${ARGV})`

const GUARDS = new RegExp(
	[
		`${META_URL}${EQ}${TO_FILE_URL}`,
		`${TO_FILE_URL}${EQ}${META_URL}`,
		`${FROM_META_URL}${EQ}${ARGV1}`,
		`${ARGV1}${EQ}${FROM_META_URL}`,
		String.raw`import\.meta\.main\b`,
	].join('|'),
	'g',
)

/** The code with every recognized main guard replaced by `false`, or `undefined` when it has none. */
export function neutralizeMainGuards(code: string): string | undefined {
	if (!code.includes('import.meta')) return undefined
	const out = code.replace(GUARDS, 'false')
	return out === code ? undefined : out
}
