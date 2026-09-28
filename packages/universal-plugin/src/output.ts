import { encode } from '@toon-format/toon'

function printJson(data: unknown) {
	console.log(JSON.stringify(data, null, 2))
}

function getFormat(): string | undefined {
	const argv = process.argv
	const fmtIdx = argv.indexOf('--format')
	if (fmtIdx !== -1) return argv[fmtIdx + 1]
	if (argv.includes('--json')) return 'json'
	return undefined
}

function isJsonOutput(): boolean {
	return getFormat() === 'json'
}

/** Print the machine result on stdout: JSON when asked for, TOON otherwise (AXI #1).
 *
 * `view` is the default format's payload, carrying the minimal row schema and the
 * pre-computed aggregates a reader needs (AXI #2, #4). It defaults to `data`, which
 * suits a command whose full result is already minimal. */
export function output(data: unknown, view?: unknown) {
	if (isJsonOutput()) printJson(data)
	else console.log(encode(view ?? data))
}
