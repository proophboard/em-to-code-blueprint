#!/usr/bin/env tsx
import {scanDomain, getDomainPath} from './scanner';
import {existsSync, readFileSync} from 'fs';
import {join, resolve, dirname} from 'path';
import {fileURLToPath} from 'url';
import {createRequire} from 'module';
import {initializeMessageFactory} from "@lib/message-factory/message-factory";
import {MachineClock} from "@lib/system-clock/machine-clock";
import {CryptoUuidGenerator} from "@lib/uuid-generator/crypto-uuid-generator";

// Support both ESM (tsx) and CJS (node) contexts
const __filename = fileURLToPath(import.meta.url);
const require = createRequire(__filename);

// Initialize message factory
initializeMessageFactory(new MachineClock(), new CryptoUuidGenerator());

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: bin/run-query.ts <query-name> <json-payload>');
    console.error('Example: bin/run-query.ts TaskManagement.TodoList \'{}\'');
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
  const domainScan = scanDomain(domainPath);
  
  // Find context for query
  const contextName = findContextForQuery(queryName, domainScan);
  if (!contextName) {
    console.error(`Query "${queryName}" not found in any context.`);
    console.error('\nAvailable queries:');
    for (const [ctx, {queries}] of Object.entries(domainScan)) {
      if (queries.length > 0) {
        console.error(`  ${ctx}:`);
        queries.forEach(q => console.error(`    - ${q}`));
      }
    }
    process.exit(1);
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
  
  // Create query message object
  const query = {
    name: queryName,
    payload,
    timestamp: new Date().toISOString(),
    id: `query-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  };
  
  // Invoke resolve
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

function findContextForQuery(queryName: string, domainScan: Record<string, {queries: string[]}>) {
  for (const [context, {queries}] of Object.entries(domainScan)) {
    if (queries.includes(queryName)) {
      return context;
    }
  }
  return null;
}

main();
