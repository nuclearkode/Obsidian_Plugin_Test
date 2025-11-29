import esbuild from 'esbuild';
import process from 'process';
import { readFileSync } from 'fs';

const banner = `/*
THIS IS A GENERATED FILE.
*/`;

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

const context = await esbuild.context({
  entryPoints: ['main.ts'],
  bundle: true,
  outfile: 'main.js',
  sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
  banner: {
    js: banner,
  },
  external: ['obsidian'],
  format: 'cjs',
  target: 'es2018',
  platform: 'browser',
  watch: process.argv.includes('--watch'),
  define: {
    'process.env.BUILD_VERSION': `'${manifest.version}'`
  }
});

if (process.argv.includes('--watch')) {
  await context.watch();
  console.log('watching...');
} else {
  await context.rebuild();
  await context.dispose();
}
