#!/usr/bin/env tsx
/**
 * bridge/index.ts — entry point for the prooph board -> blueprint bridge.
 *
 * Invoked by spec-stream (or manually):
 *   tsx bridge/index.ts <sliceId>
 *   SPEC_STREAM_SLICE_ID=... SPEC_STREAM_CHAPTER_ID=... tsx bridge/index.ts
 *   cat event.json | tsx bridge/index.ts
 *   tsx bridge/index.ts --dry-run --slice-id=abc --chapter-id=xyz
 *
 * Exit codes:
 *   0  all actions ok / skipped (or dry-run)
 *   1  at least one action failed; others may have succeeded
 *   2  invalid invocation (missing required arg/env); no API calls were made
 *
 * Environment variables (see .env.example):
 *   PROOPHBOARD_API_KEY          Required. Write-enabled API key (see docs/bridge.md).
 *   PROOPHBOARD_API_ENDPOINT     API base URL (default: https://flow.prooph-board.com/api).
 *   SPEC_STREAM_SLICE_ID         Slice ID injected by spec-stream.
 *   SPEC_STREAM_CHAPTER_ID       Chapter ID injected by spec-stream.
 *   BRIDGE_DRY_RUN               Set to "true" to print the plan without executing.
 *   BRIDGE_EVENT_SOURCED         Set to "true" to pass --event-sourced to `codegen context`.
 */

import { createProophClient } from './prooph-client.js';
import { createCodegenRunner } from './codegen-runner.js';
import { parseInvocation, printHelp } from './config.js';
import { run } from './run.js';
import { readRegistrySnapshot } from '../lib/helpers/registry-reader.js';
import { getDomainPath } from '../bin/scanner.js';
import type { Logger, RegistryReader } from './model.js';

// ---------------------------------------------------------------------------
// Logger (stdout info/warn, stderr error; redact API keys)
// ---------------------------------------------------------------------------

function redact(text: string): string {
  return text.replace(/pb_[A-Za-z0-9_-]+/g, '[REDACTED]');
}

const logger: Logger = {
  info(msg: string) {
    process.stdout.write(redact(msg) + '\n');
  },
  warn(msg: string) {
    process.stdout.write('[warn] ' + redact(msg) + '\n');
  },
  error(msg: string) {
    process.stderr.write('[error] ' + redact(msg) + '\n');
  },
};

// ---------------------------------------------------------------------------
// Registry reader (lazy; reads <cwd>/src/domain, the same path the codegen uses)
// ---------------------------------------------------------------------------

function makeRegistryReader(): RegistryReader {
  return {
    read() {
      return readRegistrySnapshot(getDomainPath());
    },
  };
}

// ---------------------------------------------------------------------------
// stdin reader (non-blocking: only read if data is available)
// ---------------------------------------------------------------------------

async function readStdin(): Promise<string | undefined> {
  if (process.stdin.isTTY) {
    return undefined; // interactive terminal; nothing to read
  }
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
    // Give stdin a moment to arrive; spec-stream always pipes synchronously.
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const rawArgv = process.argv.slice(2);

  // Handle --help / -h before attempting to parse the full invocation.
  if (rawArgv.includes('--help') || rawArgv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // spec-stream passes the sliceId as the first positional argument per
  // api-contracts.md section 1:  run: "npx tsx bridge/index.ts \"$SPEC_STREAM_SLICE_ID\""
  // parseInvocation resolves it from argv positionals, --slice-id, or env.

  let stdinText: string | undefined;
  try {
    stdinText = await readStdin();
  } catch {
    // stdin read failure is non-fatal; chapter/slice may come from env vars.
  }

  let invocation;
  try {
    invocation = parseInvocation(rawArgv, process.env as Record<string, string | undefined>, stdinText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(msg);
    process.exit(2);
  }

  const prooph = createProophClient(invocation.apiKey, invocation.endpoint);
  const codegen = createCodegenRunner({ cwd: process.cwd() });
  const registry = makeRegistryReader();

  try {
    const result = await run(invocation, { prooph, codegen, registry, logger });
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Unhandled error: ${msg}`);
    process.exit(1);
  }
}

main();
