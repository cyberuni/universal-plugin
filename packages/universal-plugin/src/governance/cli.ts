import { Command } from 'commander'

// `buddy-agent-harness reference` resolves these documents now (ADR-0017). For one release every
// form of this command says so and fails; the release after that removes it.
const RETIRED = 'universal-plugin governance is retired; buddy-agent-harness reference reads the same documents.\n'
const IN_A_SKILL = 'In a skill, load a document with the load-reference skill in the buddy-agent-harness plugin.\n'

function retire(replacement: string): never {
	process.stderr.write(`${RETIRED}${IN_A_SKILL}→ ${replacement}\n`)
	process.exit(1)
}

/** The flags `governance show` took that carried a value, so the value is not read as the name. */
const VALUE_FLAGS = new Set(['--root', '--format'])

function documentName(args: readonly string[]): string {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i] as string
		if (VALUE_FLAGS.has(arg)) i++
		else if (!arg.startsWith('-')) return arg
	}
	return '<name>'
}

/** Takes any argument or flag, so a caller still passing `--root` or `--format json` is told where
 *  to go instead of what it typed wrong. */
function retiredCommand(name: string): Command {
	return new Command(name).allowUnknownOption().allowExcessArguments().helpOption(false)
}

export function governanceCommand(): Command {
	const cmd = retiredCommand('governance')
		.description('Retired: use buddy-agent-harness reference')
		.helpOption('-h, --help', 'Show help')
		.helpCommand(false)
		.addHelpText(
			'after',
			'\nThis command is retired. buddy-agent-harness reference show|list|search reads the same documents.\n' +
				'Example:\n  $ buddy-agent-harness reference show plugin-design\n',
		)
		.action(() => retire('buddy-agent-harness reference list'))

	cmd.addCommand(
		retiredCommand('show').action((_opts: unknown, command: Command) =>
			retire(`buddy-agent-harness reference show ${documentName(command.args)}`),
		),
	)
	cmd.addCommand(retiredCommand('list').action(() => retire('buddy-agent-harness reference list')))

	return cmd
}
