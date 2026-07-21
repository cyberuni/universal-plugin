import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: { cli: 'src/cli.ts', run: 'src/run/cli.ts' },
	outDir: 'dist',
	format: 'esm',
	platform: 'node',
	clean: true,
	copy: 'src/vendor-registry/data',
})
