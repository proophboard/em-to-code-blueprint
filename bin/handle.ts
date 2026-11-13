#!/usr/bin/env tsx
import {scanDomain, getDomainPath} from './scanner';
import {existsSync} from 'fs';
import {join, resolve} from 'path';
import {fileURLToPath} from 'url';
import {createRequire} from 'module';
import {initializeMessageFactory, messageFactory} from "@lib/message-factory/message-factory";
import {MachineClock} from "@lib/system-clock/machine-clock";
import {CryptoUuidGenerator} from "@lib/uuid-generator/crypto-uuid-generator";
import {validatePayload, getPayloadTypePath} from './validator.js';

// Support both ESM (tsx) and CJS (node) contexts
const __filename = fileURLToPath(import.meta.url);
const require = createRequire(__filename);

// Initialize message factory
initializeMessageFactory(new MachineClock(), new CryptoUuidGenerator());

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: bin/run.ts <command-name> <json-payload>');
    console.error('Example: bin/run.ts TaskManagement.AddTodo \'{"title":"Test","description":"Test description"}\'');
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
  const domainScan = scanDomain(domainPath);
  
  // Find context for command
  const contextName = findContextForCommand(commandName, domainScan);
  if (!contextName) {
    console.error(`Command "${commandName}" not found in any context.`);
    console.error('\nAvailable commands:');
    for (const [ctx, {commands}] of Object.entries(domainScan)) {
      if (commands.length > 0) {
        console.error(`  ${ctx}:`);
        commands.forEach(cmd => console.error(`    - ${cmd}`));
      }
    }
    process.exit(1);
  }
  
  // Validate payload against TypeScript type
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
  
  // Load context module
  const contextModulePath = join(domainPath, contextName, 'index.ts');
  if (!existsSync(contextModulePath)) {
    console.error(`Context module not found: ${contextModulePath}`);
    process.exit(1);
  }
  
  // Dynamically import the context module
  const contextModulePathResolved = resolve(contextModulePath);
  const contextModule = await import(contextModulePathResolved);
  
  // Create command message using message factory
  const command = messageFactory().makeCommand(commandName, payload, undefined);
  
  // Invoke handle
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

function findContextForCommand(commandName: string, domainScan: Record<string, {commands: string[]}>) {
  for (const [context, {commands}] of Object.entries(domainScan)) {
    if (commands.includes(commandName)) {
      return context;
    }
  }
  return null;
}

main();
