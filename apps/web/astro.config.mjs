// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
	site: 'https://cyberuni.github.io',
	base: '/universal-plugin',
	integrations: [
		starlight({
			title: 'universal-plugin',
			description:
				'Universal AI agent plugin build tool — write once, build for Claude Code, Cursor, Codex, and Copilot CLI.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/cyberuni/universal-plugin' }],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Installation', slug: 'getting-started/installation' },
					],
				},
				{
					label: 'Concepts',
					items: [{ label: 'Choosing a runner', slug: 'concepts/npx-and-upx' }],
				},
				{
					label: 'Skills',
					items: [
						{ label: 'Overview', slug: 'skills/overview' },
						{ label: 'init-universal-plugin', slug: 'skills/init-universal-plugin' },
						{ label: 'doctor-universal-plugin', slug: 'skills/doctor-universal-plugin' },
						{ label: 'version', slug: 'skills/version' },
						{ label: 'remove-plugin', slug: 'skills/remove-plugin' },
						{ label: 'marketplace', slug: 'skills/marketplace' },
						{ label: 'migrate-plugin', slug: 'skills/migrate-plugin' },
						{ label: 'publish-plugin', slug: 'skills/publish-plugin' },
						{ label: 'upgrade-plugin', slug: 'skills/upgrade-plugin' },
						{ label: 'adopt-upx', slug: 'skills/adopt-upx' },
					],
				},
				{
					label: 'CLI Reference',
					items: [
						{ label: 'Overview', slug: 'cli/overview' },
						{ label: 'plugin build', slug: 'cli/build' },
						{ label: 'plugin install', slug: 'cli/install' },
						{ label: 'Local marketplace', slug: 'cli/marketplace' },
						{ label: 'config', slug: 'cli/config' },
					],
				},
			],
		}),
	],
})
