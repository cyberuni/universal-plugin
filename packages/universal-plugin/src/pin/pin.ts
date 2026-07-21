/** A `npx <pkg>@<pin>` or `upx <pkg>@<pin>` reference detected in a skill file. */
export interface Pin {
	pkg: string
	current: string
	file: string
	/** Which runner word this reference used — `npx` or `upx`. */
	runner: 'npx' | 'upx'
}

const PIN_PATTERN = /(npx|upx)\s+(?:--yes\s+|-y\s+)?([@a-z0-9/._-]+)@(\S+)/g

/** Strips a trailing backtick, quote, or paren that isn't part of the version token. */
function stripTrailing(raw: string): string {
	return raw.replace(/[`'")]+$/, '')
}

export function extractPins(text: string): Pin[] {
	const pins: Pin[] = []
	for (const match of text.matchAll(PIN_PATTERN)) {
		const runner = match[1]
		const pkg = match[2]
		const current = match[3]
		if (!runner || !pkg || !current) continue
		pins.push({ pkg, current: stripTrailing(current), file: '', runner: runner as 'npx' | 'upx' })
	}
	return pins
}
