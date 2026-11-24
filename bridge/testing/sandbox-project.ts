/**
 * Sandbox project for L4 integration tests.
 *
 * Creates a throwaway copy of the blueprint in a temp directory so the
 * codegen CLI can run against a real filesystem without ever touching the
 * repository's own `src/domain`.
 *
 * Layout of the sandbox (per "Open point" in implementation-steps.md):
 * - `bin/`, `codegen/`, `lib/`, `blueprint/`, `tsconfig.json`, `package.json`
 *   are copied. `tsconfig.json` carries the `@lib/*` paths alias, which tsx
 *   resolves from the sandbox cwd.
 * - `node_modules` is a symlink to the repository's installed modules, so
 *   `<cwd>/node_modules/.bin/tsx` exists for the codegen runner.
 * - `src/domain/` starts empty; all generated files land there.
 */

import {cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export interface SandboxProject {
  /** Absolute path of the sandbox root (the fake blueprint repo). */
  root: string;
  /** Absolute path of the sandbox's domain output directory. */
  domainPath: string;
  /** Remove the whole sandbox directory tree. Safe to call twice. */
  cleanup(): void;
}

/** Items the codegen CLI needs to run in the sandbox. */
const COPY_ITEMS = [
  'bin',
  'codegen',
  'lib',
  'blueprint',
  'tsconfig.json',
  'package.json'
];

export function createSandboxProject(repoRoot: string): SandboxProject {
  const root = mkdtempSync(join(tmpdir(), 'bridge-sandbox-'));

  for (const item of COPY_ITEMS) {
    const src = join(repoRoot, item);
    if (existsSync(src)) {
      cpSync(src, join(root, item), {recursive: true});
    }
  }

  // node_modules via symlink: resolves <cwd>/node_modules/.bin/tsx for the
  // runner and keeps the sandbox cheap to create.
  const nodeModules = join(repoRoot, 'node_modules');
  if (existsSync(nodeModules)) {
    symlinkSync(nodeModules, join(root, 'node_modules'), 'dir');
  }

  // Empty domain output - codegen must never run against the real src/domain.
  const domainPath = join(root, 'src', 'domain');
  mkdirSync(domainPath, {recursive: true});

  let cleaned = false;
  return {
    root,
    domainPath,
    cleanup() {
      if (!cleaned) {
        cleaned = true;
        rmSync(root, {recursive: true, force: true});
      }
    }
  };
}
