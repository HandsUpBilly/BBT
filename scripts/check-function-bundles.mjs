#!/usr/bin/env node
// Bundles every Netlify function exactly as the deploy does, so a resolution
// failure is caught locally instead of on Netlify.
//
// This exists because of a real break: moving the `google-auth-library` import
// into shared/ passed lint, tsc, and every test, then failed the deploy with
// "Could not resolve google-auth-library". esbuild resolves bare imports
// relative to the *importing file*, and shared/ is not an ancestor of
// netlify/functions/node_modules.
//
// Nothing in shared/ may import a package for this reason — inject the
// dependency from the target instead (see makeGoogleTokenVerifier).
//
// Run: npm run check:functions   (included in npm run verify)

import { readdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const functionsDir = join(root, 'netlify/functions');

const BUILTINS = new Set([...builtinModules, ...builtinModules.map(name => `node:${name}`)]);

/** "@scope/pkg/sub" -> "@scope/pkg"; "pkg/sub" -> "pkg" */
function packageNameOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * Restricts package resolution to node_modules *inside the repo*.
 *
 * Node walks up past the repo root, so a stray package in a parent directory
 * (e.g. a global-ish install in the user's home) makes an import resolve
 * locally that cannot resolve in Netlify's clean /opt/build/repo checkout.
 * That is exactly how the google-auth-library break reached the deploy.
 */
function repoScopedResolution() {
  return {
    name: 'repo-scoped-resolution',
    setup(build) {
      build.onResolve({ filter: /^[^.\/]/ }, args => {
        if (args.kind === 'entry-point') return undefined;
        if (BUILTINS.has(args.path)) return undefined;
        // Only police our own source. A dependency's internal requires (notably
        // debug's optional `supports-color`) are the bundler's business, and
        // Netlify tolerates them.
        if (args.importer.includes('node_modules')) return undefined;

        const pkg = packageNameOf(args.path);
        let dir = args.resolveDir;
        while (dir.startsWith(root)) {
          if (existsSync(join(dir, 'node_modules', pkg))) return undefined;
          const parent = dirname(dir);
          if (parent === dir) break;
          dir = parent;
        }

        return {
          errors: [{
            text: `Could not resolve "${args.path}" from within the repository. `
              + 'Resolution walks up from the importing file, and no node_modules '
              + 'between it and the repo root provides it. Netlify will fail the same way. '
              + 'Nothing in shared/ may import a package — inject it from the target instead.',
          }],
        };
      });
    },
  };
}

async function loadEsbuild() {
  // esbuild is a devDependency of netlify/functions — the same bundler Netlify
  // uses, resolved from the same directory, so this check matches the deploy.
  const requireFromFunctions = createRequire(join(functionsDir, 'package.json'));
  try {
    return await import(pathToFileURL(requireFromFunctions.resolve('esbuild')).href);
  } catch {
    console.error('Could not load esbuild — run: cd netlify/functions && npm install');
    process.exit(1);
  }
}

try {
  await access(join(functionsDir, 'node_modules'));
} catch {
  console.error('netlify/functions/node_modules is missing — run: cd netlify/functions && npm install');
  process.exit(1);
}

const esbuild = await loadEsbuild();

const functionFiles = await readdir(functionsDir);
const testFiles = functionFiles.filter(file => file.endsWith('.test.js'));

if (testFiles.length > 0) {
  console.error(
    `Netlify would deploy test files as functions: ${testFiles.join(', ')}. `
    + 'Move them to netlify/tests/ instead.',
  );
  process.exit(1);
}

const entries = functionFiles
  .filter(file => file.endsWith('.js'))
  // Generated data module, not a function.
  .filter(file => file !== 'scenarioSeed.js')
  .sort();

let failed = 0;
for (const entry of entries) {
  try {
    await esbuild.build({
      entryPoints: [join(functionsDir, entry)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      write: false,
      logLevel: 'silent',
      plugins: [repoScopedResolution()],
    });
  } catch (error) {
    failed += 1;
    console.error(`\n✘ ${entry}`);
    for (const message of error.errors ?? []) {
      const where = message.location ? ` (${message.location.file}:${message.location.line})` : '';
      console.error(`  ${message.text}${where}`);
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} function(s) failed to bundle. The Netlify deploy will fail the same way.`);
  process.exit(1);
}

console.log(`All ${entries.length} Netlify functions bundle cleanly.`);
