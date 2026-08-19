/** Hook translation: one canonical hooks declaration derived into the form each vendor reads.
 *
 *  The canonical form is PascalCase event names over Claude Code's three-level shape
 *  (event → matcher group → handlers), with four handler types. Vendors diverge on all three axes,
 *  and a handler a vendor cannot run is dropped with a warning rather than emitted or failed on
 *  (ADR-0010). Pure domain code — reading and writing the files belongs to the build. */

/** Handler types the canonical schema admits. `mcp_tool` is Claude Code-only and not canonical. */
type HookHandlerType = 'command' | 'http' | 'prompt' | 'agent'

interface HookHandler {
	type?: string
	[key: string]: unknown
}

/** A matcher group: the middle level of the canonical shape. */
interface HookRule {
	matcher?: string
	hooks: HookHandler[]
}

export interface CanonicalHooksFile {
	hooks: Record<string, HookRule[]>
}

/** What a vendor's hooks file looks like: matcher groups like the canonical form, or a flat handler
 *  list where each handler carries its own matcher. */
interface VendorHooksFile {
	version?: number
	hooks: Record<string, HookRule[] | HookHandler[]>
}

export interface HookDrop {
	event: string
	type: string
}

export interface HookTranslation {
	/** The vendor's hooks file, or null when nothing survived the handler filter. */
	hooks: VendorHooksFile | null
	drops: HookDrop[]
	/** Whether the vendor's form differs from the canonical file. When it does not, the vendor reads
	 *  the canonical file and the build derives nothing. */
	changed: boolean
}

interface VendorHookProfile {
	casing: 'pascal' | 'camel'
	shape: 'matcher-groups' | 'flat'
	handlers: HookHandlerType[]
	/** Top-level schema version the vendor's hooks file carries, when it has one. */
	schemaVersion?: number
}

/** Per-vendor hook support. Source: `.research/hook-event-survey/conclusion.md`, re-verified against
 *  vendor documentation August 2026. A vendor fact decays — re-verify before trusting this table. */
const VENDOR_HOOK_PROFILE: Record<string, VendorHookProfile> = {
	'claude-code': { casing: 'pascal', shape: 'matcher-groups', handlers: ['command', 'http', 'prompt', 'agent'] },
	codex: { casing: 'pascal', shape: 'matcher-groups', handlers: ['command'] },
	cursor: { casing: 'camel', shape: 'flat', handlers: ['command', 'prompt'], schemaVersion: 1 },
	// Copilot CLI accepts either casing, and PascalCase selects the Claude-compatible payload format —
	// so the canonical file reaches it unchanged.
	'copilot-cli': { casing: 'pascal', shape: 'matcher-groups', handlers: ['command', 'http', 'prompt'] },
}

export function translateHooks(canonical: CanonicalHooksFile, vendor: string): HookTranslation {
	const profile = VENDOR_HOOK_PROFILE[vendor]
	if (!profile) return { hooks: canonical, drops: [], changed: false }

	const drops: HookDrop[] = []
	const events: Record<string, HookRule[] | HookHandler[]> = {}

	for (const [event, rules] of Object.entries(canonical.hooks ?? {})) {
		const kept: HookRule[] = []
		for (const rule of rules) {
			const handlers = rule.hooks.filter((handler) => {
				const type = handlerType(handler)
				if (profile.handlers.includes(type as HookHandlerType)) return true
				drops.push({ event, type })
				return false
			})
			if (handlers.length > 0) kept.push({ ...rule, hooks: handlers })
		}
		if (kept.length === 0) continue
		events[eventName(event, profile.casing)] = profile.shape === 'flat' ? flatten(kept) : kept
	}

	if (Object.keys(events).length === 0) return { hooks: null, drops, changed: true }

	const hooks: VendorHooksFile =
		profile.schemaVersion === undefined ? { hooks: events } : { version: profile.schemaVersion, hooks: events }
	return { hooks, drops, changed: JSON.stringify(hooks) !== JSON.stringify(canonical) }
}

/** A handler with no declared type is a command — the canonical schema's only required-by-default shape. */
function handlerType(handler: HookHandler): string {
	return handler.type ?? 'command'
}

function eventName(event: string, casing: VendorHookProfile['casing']): string {
	return casing === 'camel' ? event.charAt(0).toLowerCase() + event.slice(1) : event
}

/** Cursor has no matcher-group level: one group of N handlers becomes N entries, each repeating the
 *  group's matcher. */
function flatten(rules: HookRule[]): HookHandler[] {
	return rules.flatMap((rule) =>
		rule.hooks.map((handler) => (rule.matcher === undefined ? handler : { ...handler, matcher: rule.matcher })),
	)
}
