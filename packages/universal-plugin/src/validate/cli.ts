import { Command } from 'commander'

import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { type ValidateResult, validatePlugin } from './validate.js'
import type { Violation } from './validation.js'

const TRUNCATE_THRESHOLD = 20
const NEXT_STEP_VALID = '→ universal-plugin plugin build\n'

interface ValidateCliOptions {
	vendor?: string
	strict?: boolean
	full?: boolean
	format?: string
	root?: string
}

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function rows(violations: Violation[], full: boolean) {
	return (full ? violations : violations.slice(0, TRUNCATE_THRESHOLD)).map(({ field, rule, message }) => ({
		field,
		rule,
		message,
	}))
}

/** Runs validate and prints its result. Shared by `plugin validate` and the bare `plugin` group, which
 *  also reports the declared harnesses (the content-first group, AXI #7). */
export function runValidate(opts: ValidateCliOptions, { withHarnesses }: { withHarnesses: boolean }): void {
	try {
		if (opts.format !== undefined && opts.format !== 'toon' && opts.format !== 'json') {
			throw new Error('error: --format must be "toon" or "json"')
		}
		const result = validatePlugin(resolveRoot(opts.root), { vendor: opts.vendor, strict: opts.strict })
		const { valid, schemaViolations, vendorViolations, warnings, harnesses } = result

		for (const warning of warnings) process.stderr.write(`warn: ${warning}\n`)

		const full = opts.full === true
		const hidden = full
			? 0
			: Math.max(0, schemaViolations.length - TRUNCATE_THRESHOLD) +
				Math.max(0, vendorViolations.length - TRUNCATE_THRESHOLD)
		const summary = `${plural(schemaViolations.length, 'schema violation')}, ${plural(vendorViolations.length, 'vendor violation')}`
		output(
			withHarnesses
				? { valid, schemaViolations, vendorViolations, harnesses }
				: { valid, schemaViolations, vendorViolations },
			{
				valid,
				...(withHarnesses ? { harnesses } : {}),
				summary,
				schemaViolations: rows(schemaViolations, full),
				vendorViolations: rows(vendorViolations, full),
				...(hidden > 0 ? { truncated: `… +${hidden} more — rerun with --full` } : {}),
			},
		)

		process.stderr.write(valid ? NEXT_STEP_VALID : fixHint(result))
		if (!valid) process.exitCode = 1
	} catch (err) {
		process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
		if (err instanceof Error && err.message.startsWith('No plugin.json found')) {
			process.stderr.write('→ universal-plugin plugin init\n')
		}
		process.exitCode = 1
	}
}

/** Points at the first violation to fix; the full list is already on stdout. */
function fixHint({ schemaViolations, vendorViolations }: ValidateResult): string {
	const first = schemaViolations[0] ?? vendorViolations[0]
	if (!first) return ''
	const target = first.field === '' ? 'plugin.json' : first.field
	return `→ fix ${target} in plugin.json: ${first.message}, then rerun universal-plugin plugin validate\n`
}

/** Options shared by `plugin validate` and the bare `plugin` group. */
export function addValidateOptions(cmd: Command): Command {
	return cmd
		.option('--vendor <id>', 'Check vendor rules for the named vendor only')
		.option('--strict', 'Treat unknown vendor keys as violations')
		.option('--full', 'Show every violation row without truncation')
		.option('--format <format>', 'Output format: toon or json (default: toon)')
		.addOption(ROOT_OPTION)
}

export function validateCommand(): Command {
	return addValidateOptions(
		new Command('validate').description(
			'Check plugin.json against the Agent Plugins schema and the declared vendors’ rules',
		),
	)
		.addHelpText('after', '\nExample:\n  $ universal-plugin plugin validate --vendor codex\n')
		.action((opts: ValidateCliOptions) => runValidate(opts, { withHarnesses: false }))
}
