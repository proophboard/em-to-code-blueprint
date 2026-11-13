#!/usr/bin/env tsx
import { scanDomain, getDomainPath, ScanResult } from './scanner';
import { printScanResult } from './formatter';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { initializeMessageFactory, messageFactory } from '@lib/message-factory/message-factory';
import { MachineClock } from '@lib/system-clock/machine-clock';
import { CryptoUuidGenerator } from '@lib/uuid-generator/crypto-uuid-generator';
import { validatePayload, getPayloadTypePath, getQueryTypePath } from './validator.js';
import { printCodegenHelp } from '../codegen/help.js';

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(__filename);

initializeMessageFactory(new MachineClock(), new CryptoUuidGenerator());

async function handleCommand(args: string[], scanResult: ScanResult): Promise<void> {
  if (args.length < 2) {
    console.error('Usage: app handle <command-name> <json-payload>');
    console.error('Example: app handle TaskManagement.AddTodo \'{"title":"Test","description":"Test description"}\'');
    process.exit(1);
  }

  const commandName = args[0];
  const payloadJson = args[1];

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadJson);
  } catch (e) {
    console.error('Invalid JSON payload:', e);
    process.exit(1);
  }

  const domainPath = getDomainPath();
  const contextName = findContextForCommand(commandName, scanResult);

  if (!contextName) {
    console.error(`Command "${commandName}" not found in any context.`);
    console.error('\nAvailable commands:');
    for (const [ctx, { commands }] of Object.entries(scanResult)) {
      if (commands.length > 0) {
        console.error(`  ${ctx}:`);
        commands.forEach(cmd => console.error(`    - ${cmd}`));
      }
    }
    process.exit(1);
  }

  const payloadTypePath = getPayloadTypePath(domainPath, contextName, commandName);
  if (existsSync(payloadTypePath)) {
    try {
      validatePayload(payload, payloadTypePath);
      console.log(`✓ Payload validation passed for command: ${commandName}`);
    } catch (e) {
      console.error('\nPayload validation failed:');
      console.error(e);
      process.exit(1);
    }
  } else {
    console.log(`⚠ No payload type definition found at: ${payloadTypePath}. Skipping validation.`);
  }

  const contextModulePath = join(domainPath, contextName, 'index.ts');
  if (!existsSync(contextModulePath)) {
    console.error(`Context module not found: ${contextModulePath}`);
    process.exit(1);
  }

  const contextModulePathResolved = resolve(contextModulePath);
  const contextModule = await import(contextModulePathResolved);

  const command = messageFactory().makeCommand(commandName, payload, undefined);

  console.log(`Executing command: ${command.name}`);
  console.log('Command message:', JSON.stringify(command, null, 2));

  try {
    const handle = contextModule.default?.handle || contextModule.handle;
    const result = await handle(command);
    console.log('\nCommand executed successfully');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('\nCommand execution failed:');
    console.error(e);
    process.exit(1);
  }
}

async function resolveQuery(args: string[], scanResult: ScanResult): Promise<void> {
  if (args.length < 2) {
    console.error('Usage: app resolve <query-name> <json-payload>');
    console.error('Example: app resolve TaskManagement.TodoList \'{"status": "open"}\'');
    process.exit(1);
  }

  const queryName = args[0];
  const payloadJson = args[1];

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadJson);
  } catch (e) {
    console.error('Invalid JSON payload:', e);
    process.exit(1);
  }

  const domainPath = getDomainPath();
  const contextName = findContextForQuery(queryName, scanResult);

  if (!contextName) {
    console.error(`Query "${queryName}" not found in any context.`);
    console.error('\nAvailable queries:');
    for (const [ctx, { queries }] of Object.entries(scanResult)) {
      if (queries.length > 0) {
        console.error(`  ${ctx}:`);
        queries.forEach(q => console.error(`    - ${q}`));
      }
    }
    process.exit(1);
  }

  const queryTypePath = getQueryTypePath(domainPath, contextName, queryName);
  if (existsSync(queryTypePath)) {
    try {
      validatePayload(payload, queryTypePath);
      console.log(`✓ Payload validation passed for query: ${queryName}`);
    } catch (e) {
      console.error('\nPayload validation failed:');
      console.error(e);
      process.exit(1);
    }
  } else {
    console.log(`⚠ No query type definition found at: ${queryTypePath}. Skipping validation.`);
  }

  const contextModulePath = join(domainPath, contextName, 'index.ts');
  if (!existsSync(contextModulePath)) {
    console.error(`Context module not found: ${contextModulePath}`);
    process.exit(1);
  }

  const contextModulePathResolved = resolve(contextModulePath);
  const contextModule = await import(contextModulePathResolved);

  const query = messageFactory().makeQuery(queryName, payload, undefined);

  console.log(`Executing query: ${query.name}`);
  console.log('Query message:', JSON.stringify(query, null, 2));

  try {
    const resolveFn = contextModule.default?.resolve || contextModule.resolve;
    const result = await resolveFn(query);
    console.log('\nQuery executed successfully');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('\nQuery execution failed:');
    console.error(e);
    process.exit(1);
  }
}

function findContextForCommand(commandName: string, scanResult: ScanResult): string | null {
  for (const [context, { commands }] of Object.entries(scanResult)) {
    if (commands.includes(commandName)) {
      return context;
    }
  }
  return null;
}

function findContextForQuery(queryName: string, scanResult: ScanResult): string | null {
  for (const [context, { queries }] of Object.entries(scanResult)) {
    if (queries.includes(queryName)) {
      return context;
    }
  }
  return null;
}

function printHelp() {
  console.log(`Usage: app <command> [arguments]

Commands:
  list                    List all available commands and queries
  handle <name> <payload> Execute a command with JSON payload
  resolve <name> <payload> Execute a query with JSON payload
  codegen                 Code generation commands

Examples:
  app list
  app handle TaskManagement.AddTodo '{"title":"Test"}'
  app resolve TaskManagement.TodoList '{"status": "open"}'
  app codegen --help
`);
}

async function main() {
  let args = process.argv.slice(2);

  // Handle --help flag
  if (args.includes('--help') || args.includes('-h')) {
    // Check if it's codegen --help
    if (args[0] === 'codegen') {
      printCodegenHelp();
    } else {
      printHelp();
    }
    return;
  }

  if (args.length === 0) {
    printHelp();
    process.exit(1);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  if (command === 'codegen') {
    const { handleCodegen } = await import('../codegen/command.js');
    handleCodegen(commandArgs);
    return;
  }

  const domainPath = getDomainPath();
  const scanResult = scanDomain(domainPath);

  switch (command) {
    case 'list':
      printScanResult(scanResult);
      break;

    case 'handle':
      handleCommand(commandArgs, scanResult);
      break;

    case 'resolve':
      resolveQuery(commandArgs, scanResult);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main();
